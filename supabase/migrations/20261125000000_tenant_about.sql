-- =============================================================================
-- Tenant "about me": a description a tenant writes for landlords, up to 2,000
-- words. Kept in its own table so it is private: only the tenant, and landlords
-- they have a conversation with, can read it.
-- =============================================================================

create table public.tenant_profiles (
  tenant_id  uuid primary key references public.profiles (id) on delete cascade,
  about      text not null default '',
  updated_at timestamptz not null default now(),
  constraint tenant_profiles_about_length check (char_length(about) <= 20000),
  -- Words are split on whitespace, the same way the app counts them.
  constraint tenant_profiles_about_max_words check (
    array_length(regexp_split_to_array(btrim(about), '\s+'), 1) <= 2000
  )
);

alter table public.tenant_profiles enable row level security;

create policy "Tenants read their own description" on public.tenant_profiles
  for select to authenticated
  using ((select auth.uid()) = tenant_id);

create policy "Landlords read descriptions of tenants who messaged them" on public.tenant_profiles
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
     where c.tenant_id = tenant_profiles.tenant_id
       and c.landlord_id = (select auth.uid())
  ));

create policy "Tenants write their own description" on public.tenant_profiles
  for insert to authenticated
  with check (
    (select auth.uid()) = tenant_id
    and exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'tenant'
    )
  );

create policy "Tenants update their own description" on public.tenant_profiles
  for update to authenticated
  using ((select auth.uid()) = tenant_id)
  with check ((select auth.uid()) = tenant_id);

revoke all on public.tenant_profiles from anon, authenticated;
grant select on public.tenant_profiles to authenticated;
grant insert (tenant_id, about, updated_at) on public.tenant_profiles to authenticated;
grant update (about, updated_at) on public.tenant_profiles to authenticated;
