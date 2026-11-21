-- =============================================================================
-- Tenants see listings only after they finish their profile (the sign-up
-- questions). Guests and landlords are not affected.
--
-- Enforced here, not just in the pages, so the data API cannot be used to read
-- listings around the rule. Run after 20261130000000_remove_lease_term.sql.
-- =============================================================================

-- True unless the signed-in user is a tenant who has not finished their profile.
-- Security definer, so the check reads tenant_profiles without that table's own
-- policies (see the note in 20261129000000_gender_preference.sql).
create function public.viewer_can_see_listings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
      from public.profiles p
     where p.id = (select auth.uid())
       and p.role = 'tenant'
       and not exists (
         select 1
           from public.tenant_profiles tp
          where tp.tenant_id = p.id
            and tp.profile_completed_at is not null
       )
  );
$$;

revoke all on function public.viewer_can_see_listings() from public;
grant execute on function public.viewer_can_see_listings() to anon, authenticated;

drop policy "Listings are publicly readable" on public.listings;

create policy "Listings are visible to guests, landlords and tenants with a finished profile"
  on public.listings for select
  to anon, authenticated
  using ((select public.viewer_can_see_listings()));
