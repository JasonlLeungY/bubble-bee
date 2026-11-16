-- =============================================================================
-- Block 2: listings + the listing-images storage bucket.
-- Paste into the Supabase SQL Editor and run once (after the Block 1 script).
-- =============================================================================

-- 1. Table -------------------------------------------------------------------
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 3 and 120),
  description    text not null default '' check (char_length(description) <= 5000),
  price_per_week numeric(10, 2) not null check (price_per_week > 0),
  suburb         text not null check (char_length(suburb) between 1 and 80),
  -- Public URLs of files in the listing-images bucket. Max 5 per listing.
  image_urls     text[] not null default '{}' check (cardinality(image_urls) <= 5),

  -- 2. Behavioural rules, matched against the tenant's profile flags.
  is_smoker_allowed        boolean not null default false,
  is_shift_worker_friendly boolean not null default false,
  tolerates_noise          boolean not null default false,

  created_at     timestamptz not null default now()
);

-- "My listings" on the landlord dashboard, newest first.
create index listings_landlord_idx
  on public.listings (landlord_id, created_at desc);

-- 3. Row Level Security ------------------------------------------------------
alter table public.listings enable row level security;

create policy "Listings are publicly readable"
  on public.listings for select
  to anon, authenticated
  using (true);

-- Only as yourself, and only if your profile says you are a landlord.
create policy "Landlords can create their own listings"
  on public.listings for insert
  to authenticated
  with check (
    (select auth.uid()) = landlord_id
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'landlord'
    )
  );

create policy "Landlords can update their own listings"
  on public.listings for update
  to authenticated
  using      ((select auth.uid()) = landlord_id)
  with check ((select auth.uid()) = landlord_id);

create policy "Landlords can delete their own listings"
  on public.listings for delete
  to authenticated
  using ((select auth.uid()) = landlord_id);

grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

-- 4. Storage bucket ----------------------------------------------------------
-- Public: anyone can read or download a file through its public URL, with no
-- policy needed. The bucket itself rejects anything that is not a JPEG, PNG
-- or WebP of 5 MB or less.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5. Storage policies --------------------------------------------------------
-- Uploads: signed-in users only, and only into a folder named after their own
-- user id ({user_id}/{file}), so nobody can write into someone else's folder.
create policy "listing-images: signed-in users upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Lets an uploader see and remove their own files (needed by the "remove"
-- button in the uploader). Reading by public URL does not go through this.
create policy "listing-images: users see their own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "listing-images: users delete their own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
