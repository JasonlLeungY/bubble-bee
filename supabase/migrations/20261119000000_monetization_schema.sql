-- =============================================================================
-- Monetization schema (DRAFT). Not yet approved: do NOT run this in Supabase
-- until the open decisions are confirmed. Runs after the three existing migrations.
-- =============================================================================

-- 0. Listing status and permissions.
--    New listings start as drafts; only published listings are public.
--    Owners can edit content and publish or unpublish, but cannot touch the
--    promotion columns added below. Publishing is limited by the plan's
--    listing cap, which is checked in the server code (Step 2).
alter table public.listings add column status text not null default 'published'
  check (status in ('draft', 'published'));
-- Listings created before this migration were already public, so they stay published.
alter table public.listings alter column status set default 'draft';

drop policy "Listings are publicly readable" on public.listings;
create policy "Published listings are public; owners see their own" on public.listings
  for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = landlord_id);

revoke update on public.listings from authenticated;
grant update (
  title, description, price_per_week, suburb, image_urls,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise, status
) on public.listings to authenticated;

-- 1. Catalogue: what can be bought, and at what price. Prices live here, not
--    in code, so they can change without a deployment.
create table public.products (
  code              text primary key,        -- 'highlight_7d', 'highlight_14d', 'highlight_28d'
  kind              text not null check (kind in ('boost', 'highlight')),
  name              text not null,
  price_cents       integer not null check (price_cents > 0),
  currency          char(3) not null default 'AUD',
  duration_days     integer check (duration_days > 0),   -- null = permanent
  provider_price_id text unique,                          -- Stripe price id, added when created in Stripe
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint products_only_highlight_is_permanent
    check (duration_days is not null or kind = 'highlight')
);

-- Boost option: AUD 0.70 per boost, active for 1 day.
insert into public.products (code, kind, name, price_cents, duration_days) values
  ('boost_1d', 'boost', 'Boost, 1 day', 70, 1);

-- Highlight options.
insert into public.products (code, kind, name, price_cents, duration_days) values
  ('highlight_7d',  'highlight', 'Highlight, 7 days',   499,  7),
  ('highlight_14d', 'highlight', 'Highlight, 14 days',  999,  14),
  ('highlight_28d', 'highlight', 'Highlight, 4 weeks', 1599, 28);

create table public.plans (
  code                text not null,                       -- 'basic', 'pro'
  billing_interval    text not null check (billing_interval in ('month', 'year')),
  name                text not null,
  price_cents         integer not null check (price_cents >= 0),
  currency            char(3) not null default 'AUD',
  max_active_listings integer check (max_active_listings > 0),  -- null = unlimited
  boosts_per_period   integer not null default 0 check (boosts_per_period >= 0),
  provider_price_id   text unique,
  is_active           boolean not null default true,
  primary key (code, billing_interval)
);

-- Subscription plans, monthly, AUD. Yearly prices are not set yet.
-- boosts_per_period is the free boosts included each billing period.
insert into public.plans (code, billing_interval, name, price_cents, max_active_listings, boosts_per_period) values
  ('basic', 'month', 'Basic', 799,  3,  3),
  ('pro',   'month', 'Pro',   2499, 10, 10);

-- 2. Billing identity: one payment-provider customer per user.
create table public.billing_customers (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  provider_customer_id text not null unique,
  created_at           timestamptz not null default now()
);

-- 3. One-off purchases. Kept after an account is deleted, for records.
--    No refunds are offered. 'refunded' is only for chargebacks and corrections.
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles (id) on delete set null,
  listing_id          uuid references public.listings (id) on delete set null,
  product_code        text not null references public.products (code),
  amount_cents        integer not null check (amount_cents >= 0),
  currency            char(3) not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  provider_session_id text unique,      -- Stripe checkout session id: the webhook's idempotency key
  provider_payment_id text unique,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  refunded_at         timestamptz
);

-- 4. Recurring subscriptions. Status values mirror Stripe's.
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  plan_code                text not null,
  billing_interval         text not null,
  provider_subscription_id text not null unique,
  status                   text not null
                             check (status in ('incomplete', 'incomplete_expired', 'trialing',
                                               'active', 'past_due', 'unpaid', 'canceled', 'paused')),
  current_period_start     timestamptz not null,
  current_period_end       timestamptz not null,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (plan_code, billing_interval) references public.plans (code, billing_interval)
);

-- A user can hold only one live subscription at a time.
create unique index subscriptions_one_live_per_user
  on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');

-- 5. Promotion ledger: every boost or highlight ever granted.
--    Stacking: a new boost starts at the later of now() and the end of the
--    listing's current boost, so purchases add up.
--    Removal: an owner can end a promotion early. That sets canceled_at and
--    ends it now. Whether a removal is refunded is not decided yet.
create table public.listing_promotions (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,   -- owner when granted
  kind            text not null check (kind in ('boost', 'highlight')),
  source          text not null check (source in ('purchase', 'subscription_allowance', 'admin')),
  order_id        uuid references public.orders (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,                 -- 'infinity' = permanent highlight
  canceled_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  check (canceled_at is null or canceled_at >= starts_at),
  check (source <> 'purchase' or order_id is not null),
  check (source <> 'subscription_allowance' or subscription_id is not null)
);

-- One promotion per paid order: a repeated webhook cannot grant it twice.
create unique index listing_promotions_one_per_order
  on public.listing_promotions (order_id) where order_id is not null;

create index listing_promotions_listing_idx
  on public.listing_promotions (listing_id, kind, ends_at desc);

-- Counts a user's free boosts for the current billing period.
create index listing_promotions_allowance_idx
  on public.listing_promotions (user_id, starts_at)
  where source = 'subscription_allowance';

-- 6. Denormalised flags on listings, so the search grid needs no join. Both
--    are updated only by the server. '-infinity' means "never", so a plain
--    "> now()" comparison works without NULL handling.
alter table public.listings
  add column promoted_until    timestamptz not null default '-infinity',
  add column highlighted_until timestamptz not null default '-infinity';

-- 7. Webhook log: every provider event received, processed once. Server only.
create table public.webhook_events (
  id           text primary key,              -- provider event id, e.g. 'evt_...'
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  payload      jsonb not null
);

-- 8. Row Level Security. Clients read their own rows and the public catalogue.
--    Nothing on the client side can write to these tables.
alter table public.products          enable row level security;
alter table public.plans             enable row level security;
alter table public.billing_customers enable row level security;
alter table public.orders            enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.listing_promotions enable row level security;
alter table public.webhook_events    enable row level security;   -- no policies: no client access

create policy "Active products are public" on public.products
  for select to anon, authenticated using (is_active);
create policy "Active plans are public" on public.plans
  for select to anon, authenticated using (is_active);
create policy "Users read their own billing customer" on public.billing_customers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read their own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read their own subscriptions" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read their own promotions" on public.listing_promotions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.products, public.plans, public.billing_customers, public.orders,
  public.subscriptions, public.listing_promotions, public.webhook_events
  from anon, authenticated;
grant select on public.products, public.plans to anon, authenticated;
grant select on public.billing_customers, public.orders,
  public.subscriptions, public.listing_promotions to authenticated;
