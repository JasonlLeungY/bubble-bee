-- =============================================================================
-- Remove the "Available for" option (lease term) from listings. Landlords no
-- longer choose it, and the listing page no longer shows it. The available-from
-- date is unchanged. Run after 20261129000000_gender_preference.sql.
-- Dropping the column also drops the column grants and the check constraint.
-- =============================================================================

alter table public.listings drop column lease_term;
