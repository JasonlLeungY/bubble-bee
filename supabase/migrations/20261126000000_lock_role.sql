-- =============================================================================
-- Lock the account type. Nothing in the app changes a profile's role after
-- sign-up, so users may not change it themselves. (Earlier migrations left
-- role editable.)
-- =============================================================================
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, is_smoker, is_shift_worker, tolerates_noise)
  on public.profiles to authenticated;
