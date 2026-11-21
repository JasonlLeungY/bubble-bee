-- =============================================================================
-- Listing details (ladies only, lease term, bedrooms, bathrooms, parking),
-- page-view counting, and admin statistics (admins only).
-- =============================================================================

-- 1. Listing details. Existing listings keep these empty until the owner adds them.
alter table public.listings
  add column ladies_only   boolean not null default false,
  add column lease_term    text check (lease_term in ('1_month', '3_months', '6_months', '12_months', 'ongoing')),
  add column bedrooms      integer check (bedrooms between 1 and 20),
  add column bathrooms     integer check (bathrooms between 1 and 20),
  add column parking       text check (parking in ('street', 'garage', 'other')),
  add column parking_other text check (char_length(parking_other) <= 80);

-- Column grants: owners may insert and update these too.
revoke insert, update on public.listings from authenticated;

grant insert (
  landlord_id, title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
  ladies_only, lease_term, bedrooms, bathrooms, parking, parking_other
) on public.listings to authenticated;

grant update (
  title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
  ladies_only, lease_term, bedrooms, bathrooms, parking, parking_other
) on public.listings to authenticated;

-- 2. Page views: anyone may record one (the path only, no user), nobody may read them directly.
create table public.page_views (
  id         bigint generated always as identity primary key,
  path       text not null check (char_length(path) <= 300),
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

create policy "Anyone can record a page view" on public.page_views
  for insert to anon, authenticated
  with check (true);

revoke all on public.page_views from anon, authenticated;
grant insert (path) on public.page_views to anon, authenticated;

-- 3. Statistics for administrators. Refused for everyone else.
create function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can view statistics.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users',               (select count(*) from auth.users),
    'tenants',             (select count(*) from public.profiles where role = 'tenant'),
    'landlords',           (select count(*) from public.profiles where role = 'landlord'),
    'signups_7d',          (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d',         (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_30d',          (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'listings',            (select count(*) from public.listings),
    'conversations',       (select count(*) from public.conversations),
    'messages',            (select count(*) from public.messages),
    'paid',                0,
    'views_today',         (select count(*) from public.page_views where created_at >= date_trunc('day', now())),
    'views_7d',            (select count(*) from public.page_views where created_at > now() - interval '7 days'),
    'views_30d',           (select count(*) from public.page_views where created_at > now() - interval '30 days'),
    'top_pages_30d',       coalesce((
      select jsonb_agg(jsonb_build_object('path', t.path, 'views', t.views))
        from (
          select path, count(*) as views
            from public.page_views
           where created_at > now() - interval '30 days'
           group by path
           order by views desc
           limit 10
        ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
