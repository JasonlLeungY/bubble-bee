-- =============================================================================
-- Home types (entire home or share house) on listings, and job posts.
--
-- The first page of each category is public: the newest 10 listings of each
-- home type, and the newest 10 jobs. Opening full details, or any page after
-- the first, needs an account: a landlord, an administrator, or a tenant with a
-- finished profile (the same rule as listings, see 20261131000000).
--
-- Run after 20261131000000_listing_visibility.sql.
-- =============================================================================

-- 1. Home type on listings. Existing listings become share houses.
alter table public.listings
  add column home_type text not null default 'share_house'
    check (home_type in ('entire_home', 'share_house'));

revoke insert, update on public.listings from authenticated;

grant insert (
  landlord_id, title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
  gender_preference, home_type, bedrooms, bathrooms, parking, parking_other
) on public.listings to authenticated;

grant update (
  title, description, price_per_week, suburb, image_urls,
  available_from, bond_amount, bills_included,
  is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
  gender_preference, home_type, bedrooms, bathrooms, parking, parking_other
) on public.listings to authenticated;

-- 2. The first page of each home type: the newest 10 of each, card details only.
drop view if exists public.first_page_listings;

create view public.first_page_listings as
  select id, title, suburb, price_per_week, image_urls,
         is_smoker_allowed, is_shift_worker_friendly, tolerates_noise,
         gender_preference, home_type, created_at
    from (
      select l.id, l.title, l.suburb, l.price_per_week, l.image_urls,
             l.is_smoker_allowed, l.is_shift_worker_friendly, l.tolerates_noise,
             l.gender_preference, l.home_type, l.created_at,
             row_number() over (partition by l.home_type order by l.created_at desc, l.id desc) as rank_in_type
        from public.listings l
    ) ranked
   where rank_in_type <= 10;

grant select on public.first_page_listings to anon, authenticated;

-- 3. Job posts, posted by landlords.
create table public.job_posts (
  id          uuid primary key default gen_random_uuid(),
  poster_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  employer    text not null check (char_length(employer) between 2 and 80),
  suburb      text not null check (char_length(suburb) between 2 and 80),
  pay         text not null check (char_length(pay) between 2 and 80),
  hours       text check (char_length(hours) <= 120),
  description text not null default '' check (char_length(description) <= 5000),
  created_at  timestamptz not null default now()
);

alter table public.job_posts enable row level security;

-- Full job details: the same people who may see full listing details.
create policy "Job details: landlords, administrators and finished tenants"
  on public.job_posts for select
  to authenticated
  using ((select public.viewer_can_see_listing_details()));

create policy "Landlords post their own jobs"
  on public.job_posts for insert
  to authenticated
  with check (
    poster_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'landlord')
  );

create policy "Landlords edit their own jobs"
  on public.job_posts for update
  to authenticated
  using (poster_id = (select auth.uid()))
  with check (poster_id = (select auth.uid()));

create policy "Landlords delete their own jobs"
  on public.job_posts for delete
  to authenticated
  using (poster_id = (select auth.uid()));

revoke all on public.job_posts from anon, authenticated;
grant select on public.job_posts to authenticated;
grant insert (poster_id, title, employer, suburb, pay, hours, description) on public.job_posts to authenticated;
grant update (title, employer, suburb, pay, hours, description) on public.job_posts to authenticated;
grant delete on public.job_posts to authenticated;

-- 4. The first page of jobs for everyone: the newest 10, without the description.
create view public.first_page_jobs as
  select id, title, employer, suburb, pay, hours, created_at
    from public.job_posts
   order by created_at desc, id desc
   limit 10;

grant select on public.first_page_jobs to anon, authenticated;
