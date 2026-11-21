-- =============================================================================
-- Gender preference on listings (replaces the ladies-only switch), and the
-- contact gate now also checks the tenant's gender and that their profile is
-- complete. Run after 20261128000000_tenant_intake.sql.
-- =============================================================================

-- 1. Replace ladies_only with gender_preference.
alter table public.listings
  add column gender_preference text check (gender_preference in ('female_only', 'male_only', 'no_preference'));

update public.listings
   set gender_preference = case when ladies_only then 'female_only' else 'no_preference' end;

alter table public.listings alter column gender_preference set not null;
alter table public.listings drop column ladies_only;

revoke insert, update on public.listings from authenticated;

grant insert (
  landlord_id, title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
  gender_preference, lease_term, bedrooms, bathrooms, parking, parking_other
) on public.listings to authenticated;

grant update (
  title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
  gender_preference, lease_term, bedrooms, bathrooms, parking, parking_other
) on public.listings to authenticated;

-- 2. The contact gate: lifestyle, gender and a completed profile.
--
-- The gender and completeness check is a security definer function. Reading
-- tenant_profiles straight from this policy loops back through that table's
-- own policies (they read conversations), and PostgreSQL reports the loop as
-- infinite recursion. The function reads the tenant's own row, nothing else.
create function public.tenant_fits_listing_gender(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.listings l
      join public.tenant_profiles tp on tp.tenant_id = (select auth.uid())
     where l.id = p_listing_id
       and tp.profile_completed_at is not null
       and (
         l.gender_preference = 'no_preference'
         or (l.gender_preference = 'female_only' and tp.gender = 'female')
         or (l.gender_preference = 'male_only' and tp.gender = 'male')
       )
  );
$$;

revoke all on function public.tenant_fits_listing_gender(uuid) from public, anon;
grant execute on function public.tenant_fits_listing_gender(uuid) to authenticated;

-- Replace the lifestyle-only gate. Insert policies are combined with OR, so the
-- old one must go, or it would still allow contact.
drop policy "Tenants can open a conversation when their lifestyle fits" on public.conversations;

create policy "Tenants can open a conversation when their profile and the house fit"
  on public.conversations for insert
  to authenticated
  with check (
    (select auth.uid()) = tenant_id
    and exists (
      select 1
      from public.profiles p
      join public.listings l on l.id = conversations.listing_id
      where p.id = (select auth.uid())
        and p.role = 'tenant'
        and l.landlord_id = conversations.landlord_id
        and (not p.is_smoker       or l.is_smoker_allowed)
        and (not p.is_shift_worker or l.is_shift_worker_friendly)
        and (not p.tolerates_noise or l.tolerates_noise)
    )
    and public.tenant_fits_listing_gender(conversations.listing_id)
  );
