-- =============================================================================
-- Administrators can edit any listing. Owners can still edit their own.
-- Administrators are set by hand in the database; the app cannot grant it.
-- =============================================================================

-- 1. The flag. Default false, so nobody is an administrator by accident.
alter table public.profiles add column is_admin boolean not null default false;

-- 2. Users may update their profile's own details, never is_admin. The
--    previous grant allowed every column, which would have let anyone promote
--    themselves.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, role, is_smoker, is_shift_worker, tolerates_noise)
  on public.profiles to authenticated;

-- 3. Whether the signed-in user is an administrator. Security definer, so the
--    check works inside policies whatever the profile policies say.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- 4. Listings: owners and administrators may update.
drop policy "Landlords can update their own listings" on public.listings;

create policy "Owners and administrators can update listings" on public.listings
  for update to authenticated
  using ((select auth.uid()) = landlord_id or public.is_admin())
  with check ((select auth.uid()) = landlord_id or public.is_admin());

-- 5. Photos: administrators may replace and remove photos in any listing
--    folder, so they can edit a listing's photos.
create policy "Administrators manage listing photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'listing-images' and public.is_admin())
  with check (bucket_id = 'listing-images' and public.is_admin());
