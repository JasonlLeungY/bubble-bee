-- =============================================================================
-- Who can see which listings.
--
--   * The first page (the newest 10 listings) is public. A view exposes only
--     the details shown on a listing card.
--   * Full listing details, and any page after the first, need a signed-in
--     account: a landlord, an administrator, or a tenant who has finished their
--     profile.
--
-- Enforced here, not only in the pages, so the data API follows the same rules.
-- Run after 20261130000000_remove_lease_term.sql (it needs tenant_profiles from
-- 20261128000000_tenant_intake.sql).
-- =============================================================================

-- 1. Remove the earlier rules, so the new ones below are the only ones.
drop policy if exists "Listings are publicly readable" on public.listings;
drop policy if exists "Listings are visible to guests, landlords and tenants with a finished profile" on public.listings;
drop function if exists public.viewer_can_see_listings();

-- 2. Full listing details: landlords, administrators, and finished tenants.
--    Security definer, so the check reads profiles and tenant_profiles without
--    their own policies (see the note in 20261129000000_gender_preference.sql).
create function public.viewer_can_see_listing_details()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (
           select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'landlord'
         )
      or exists (
           select 1
             from public.profiles p
             join public.tenant_profiles tp on tp.tenant_id = p.id
            where p.id = (select auth.uid())
              and p.role = 'tenant'
              and tp.profile_completed_at is not null
         );
$$;

revoke all on function public.viewer_can_see_listing_details() from public, anon;
grant execute on function public.viewer_can_see_listing_details() to authenticated;

create policy "Listing details: landlords, administrators and finished tenants"
  on public.listings for select
  to authenticated
  using ((select public.viewer_can_see_listing_details()));

-- 3. The first page for everyone: the newest 10 listings, card details only.
--    The view's owner reads the table, so guests can see these rows without
--    any policy on the table itself.
create view public.first_page_listings as
  select id, title, suburb, price_per_week, image_urls,
         is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
         gender_preference, created_at
    from public.listings
   order by created_at desc, id desc
   limit 10;

grant select on public.first_page_listings to anon, authenticated;
