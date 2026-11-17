-- =============================================================================
-- RESET: removes everything this app has created in the database, so the three
-- migration scripts can be run again from scratch.
--
-- Run this ONLY if the setup check showed the old draft schema, or a half
-- finished setup. It permanently deletes every profile, listing, conversation
-- and message. User accounts (Authentication > Users) and uploaded photo files
-- are kept, but existing accounts will have no profile afterwards, so delete
-- your test users too and sign up again.
--
-- Safe to run more than once. Covers both the first draft schema and the
-- current one.
-- =============================================================================

-- Stop new sign-ups from writing into a table that is about to go.
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  public.messages,
  public.conversations,
  public.listing_images,
  public.listings,
  public.profiles
  cascade;

drop function if exists public.handle_new_user()    cascade;
drop function if exists public.touch_conversation() cascade;
drop function if exists public.set_updated_at()     cascade;

-- Types used only by the first draft schema.
drop type if exists public.user_role, public.listing_status, public.rent_period cascade;

-- Storage rules for the listing-images bucket (draft names and current names).
-- The bucket itself and any files in it are left alone.
drop policy if exists "Landlords upload listing images to their own folder" on storage.objects;
drop policy if exists "Landlords list their own listing images"             on storage.objects;
drop policy if exists "Landlords replace their own listing images"          on storage.objects;
drop policy if exists "Landlords delete their own listing images"           on storage.objects;
drop policy if exists "listing-images: signed-in users upload to their own folder" on storage.objects;
drop policy if exists "listing-images: users see their own files"           on storage.objects;
drop policy if exists "listing-images: users delete their own files"        on storage.objects;
