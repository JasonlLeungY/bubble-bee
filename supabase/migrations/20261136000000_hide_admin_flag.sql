-- =============================================================================
-- Nobody can read the admin flag directly, and profiles are no longer readable
-- with every column by anonymous visitors.
--
-- Admin checks go through public.is_admin() (security definer), which the app
-- calls with supabase.rpc("is_admin"). Run after 20261135000000_listing_filters.sql.
-- =============================================================================

revoke select on public.profiles from anon, authenticated;

grant select (id, first_name, last_name, role, is_smoker, is_shift_worker, tolerates_noise)
  on public.profiles to anon, authenticated;
