-- =============================================================================
-- Listing editing: availability, bond and bills, and column-level permissions
-- for the details an owner can insert and update.
-- =============================================================================

-- 1. New details. Existing listings get "available now", no bond, bills not included.
alter table public.listings
  add column available_from date,
  add column bond_amount    integer check (bond_amount >= 0),
  add column bills_included boolean not null default false;

-- 2. Owners may insert and update only the listing's details. Coordinates and
--    promotion columns are not in these lists, so the app cannot set them.
--    The existing "owners can update their own listings" policy still checks
--    that the row belongs to the signed-in user.
revoke insert, update on public.listings from authenticated;

grant insert (
  landlord_id, title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise
) on public.listings to authenticated;

grant update (
  title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise
) on public.listings to authenticated;
