-- =============================================================================
-- Block 4: gated messaging.
-- Paste into the Supabase SQL Editor and run once (after Blocks 1 and 2).
--
-- A conversation is one tenant enquiring about one listing. Only a tenant can
-- open one, and only when their lifestyle fits the house rules. That gate is
-- enforced here, in the database, so it cannot be skipped by calling the API
-- directly. The app repeats the same check to show a friendly message.
-- =============================================================================

-- 1. Conversations -----------------------------------------------------------
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null
                constraint conversations_listing_id_fkey
                references public.listings (id) on delete cascade,
  tenant_id   uuid not null
                constraint conversations_tenant_id_fkey
                references public.profiles (id) on delete cascade,
  landlord_id uuid not null
                constraint conversations_landlord_id_fkey
                references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  -- Kept up to date by a trigger below; the inbox sorts on it.
  last_message_at timestamptz not null default now(),

  constraint conversations_one_per_tenant_per_listing unique (listing_id, tenant_id),
  constraint conversations_distinct_parties check (tenant_id <> landlord_id)
);

create index conversations_tenant_inbox_idx
  on public.conversations (tenant_id, last_message_at desc);
create index conversations_landlord_inbox_idx
  on public.conversations (landlord_id, last_message_at desc);

-- 2. Messages ----------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
                    constraint messages_conversation_id_fkey
                    references public.conversations (id) on delete cascade,
  sender_id       uuid not null
                    constraint messages_sender_id_fkey
                    references public.profiles (id) on delete cascade,
  content         text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- Bump the conversation when a message arrives, so the inbox can sort by
-- latest activity. Definer rights: users cannot update conversations directly.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- 3. Row Level Security ------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Conversations: each side sees only their own.
create policy "Participants can read their conversations"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) in (tenant_id, landlord_id));

-- THE GATE. A conversation can only be created
--   * by the tenant, as themself,
--   * from a tenant account,
--   * against a real listing, addressed to that listing's real landlord,
--   * when no trait the tenant has is one the house does not accept.
-- Keep the three lifestyle lines in step with utils/lifestyle.ts.
create policy "Tenants can open a conversation when their lifestyle fits"
  on public.conversations for insert
  to authenticated
  with check (
    (select auth.uid()) = tenant_id
    and exists (
      select 1
      from public.profiles p
      cross join public.listings l
      where p.id = (select auth.uid())
        and p.role = 'tenant'
        and l.id = conversations.listing_id
        and l.landlord_id = conversations.landlord_id
        and (not p.is_smoker       or l.is_smoker_allowed)
        and (not p.is_shift_worker or l.is_shift_worker_friendly)
        and (not p.tolerates_noise or l.tolerates_noise)
    )
  );

-- No update or delete policies: a conversation cannot be reassigned or removed
-- by either side.

-- Messages: only the two people in the conversation, and only as themselves.
create policy "Participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.tenant_id, c.landlord_id)
    )
  );

create policy "Participants can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.tenant_id, c.landlord_id)
    )
  );

-- No update or delete policies: messages cannot be edited or unsent.

-- Explicit grants. Signed-out visitors get nothing. Inserts are limited to
-- the columns a client should set, so timestamps cannot be faked.
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages      from anon, authenticated;
grant select on public.conversations to authenticated;
grant insert (listing_id, tenant_id, landlord_id) on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, content) on public.messages to authenticated;
