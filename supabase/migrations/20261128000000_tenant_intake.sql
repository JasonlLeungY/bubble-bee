-- =============================================================================
-- Tenant intake: the profile a tenant completes when they sign up. Shared with
-- a landlord only once they have a conversation (see tenant_profiles policies).
-- Phone and date of birth are kept in tenant_private and never shown to landlords.
-- The selfie lives in a private bucket and is shown to landlords through signed URLs.
-- =============================================================================

-- 1. Intake columns on tenant_profiles. Every choice list is enforced here too,
--    so the database rejects values the app would never offer.
alter table public.tenant_profiles
  -- Basic identity
  add column full_name            text check (char_length(btrim(full_name)) between 2 and 120),
  add column preferred_name       text check (char_length(preferred_name) <= 40),
  add column gender               text check (gender in ('female', 'male', 'other')),
  add column housemate_preference text check (housemate_preference in ('female_only', 'male_only', 'no_preference')),
  add column selfie_path          text check (char_length(selfie_path) <= 200),
  add column bio                  text check (char_length(bio) <= 300),
  -- Employment and job matching
  add column employment_status    text check (employment_status in ('full_time', 'part_time', 'self_employed', 'student', 'looking_for_work')),
  add column job_title            text check (char_length(job_title) <= 80),
  add column industries           text[] not null default '{}'
    check (cardinality(industries) <= 10 and industries <@ array[
      'Hospitality & Kitchen', 'Retail', 'Construction & Trades', 'Healthcare', 'Tech / IT',
      'Logistics', 'Admin', 'Cleaning', 'Education', 'Other']::text[]),
  add column open_to_job_offers   boolean not null default false,
  add column target_roles         text[] not null default '{}'
    check (cardinality(target_roles) <= 10 and char_length(array_to_string(target_roles, ',')) <= 600),
  add column preferred_shifts     text[] not null default '{}'
    check (cardinality(preferred_shifts) <= 4 and preferred_shifts <@ array[
      'Weekday days', 'Weekday evenings', 'Weekends', 'Overnight']::text[]),
  add column work_rights          text check (work_rights in ('full', 'student_visa', 'other')),
  add column income_verification  text check (income_verification in ('payslips', 'savings_guarantor', 'government_allowance')),
  -- Household lifestyle
  add column work_schedule        text check (work_schedule in ('day_shift', 'early_riser', 'late_night', 'rotating')),
  add column wfh                  text check (wfh in ('never', 'hybrid', 'full_time')),
  add column smoking              text check (smoking in ('non_smoker', 'vapes_outside', 'smokes_outside', 'social_only')),
  add column alcohol              text check (alcohol in ('rarely', 'with_dinner', 'socialising')),
  add column guests               text check (guests in ('rarely', 'daytime', 'partner_overnight')),
  add column cleanliness          text check (cleanliness in ('strict', 'weekly', 'relaxed')),
  add column dietary              text[] not null default '{}'
    check (cardinality(dietary) <= 5 and dietary <@ array[
      'cooks_daily', 'meal_preps', 'vegetarian_vegan', 'halal_kosher', 'none']::text[]),
  add column has_pets             boolean,
  add column pets_details         text check (char_length(pets_details) <= 120),
  add column allergies            text[] not null default '{}'
    check (cardinality(allergies) <= 3 and allergies <@ array['cats', 'dogs', 'none']::text[]),
  -- Rental preferences
  add column move_in_date         date,
  add column flexible_move_in     boolean not null default false,
  add column stay_length          text check (stay_length in ('3_months', '6_months', '12_plus_months', 'flexible')),
  add column max_weekly_budget    numeric(8, 2) check (max_weekly_budget > 0 and max_weekly_budget <= 10000),
  add column parking_needed       text check (parking_needed in ('no_vehicle', 'street_ok', 'off_street_required')),
  -- Set by the app once every required answer is valid. Contacting landlords needs it.
  add column profile_completed_at timestamptz;

-- 2. Private details: never readable by landlords.
create table public.tenant_private (
  tenant_id     uuid primary key references public.profiles (id) on delete cascade,
  phone         text not null check (phone ~ '^\+?[0-9 ()-]{8,20}$'),
  date_of_birth date not null check (date_of_birth <= current_date - interval '18 years'),
  updated_at    timestamptz not null default now()
);

alter table public.tenant_private enable row level security;

create policy "Tenants read their own private details" on public.tenant_private
  for select to authenticated
  using ((select auth.uid()) = tenant_id);

create policy "Tenants write their own private details" on public.tenant_private
  for insert to authenticated
  with check (
    (select auth.uid()) = tenant_id
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'tenant')
  );

create policy "Tenants update their own private details" on public.tenant_private
  for update to authenticated
  using ((select auth.uid()) = tenant_id)
  with check ((select auth.uid()) = tenant_id);

revoke all on public.tenant_private from anon, authenticated;
grant select on public.tenant_private to authenticated;
grant insert (tenant_id, phone, date_of_birth, updated_at) on public.tenant_private to authenticated;
grant update (phone, date_of_birth, updated_at) on public.tenant_private to authenticated;

-- 3. Column grants for the intake on tenant_profiles.
revoke insert, update on public.tenant_profiles from authenticated;

grant insert (
  tenant_id, about, updated_at,
  full_name, preferred_name, gender, housemate_preference, selfie_path, bio,
  employment_status, job_title, industries, open_to_job_offers, target_roles, preferred_shifts,
  work_rights, income_verification,
  work_schedule, wfh, smoking, alcohol, guests, cleanliness, dietary, has_pets, pets_details, allergies,
  move_in_date, flexible_move_in, stay_length, max_weekly_budget, parking_needed,
  profile_completed_at
) on public.tenant_profiles to authenticated;

grant update (
  about, updated_at,
  full_name, preferred_name, gender, housemate_preference, selfie_path, bio,
  employment_status, job_title, industries, open_to_job_offers, target_roles, preferred_shifts,
  work_rights, income_verification,
  work_schedule, wfh, smoking, alcohol, guests, cleanliness, dietary, has_pets, pets_details, allergies,
  move_in_date, flexible_move_in, stay_length, max_weekly_budget, parking_needed,
  profile_completed_at
) on public.tenant_profiles to authenticated;

-- 4. Selfies: a private bucket. Tenants manage files in their own folder.
--    Their landlords (people with a conversation with them) may read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-avatars', 'tenant-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "tenant-avatars: tenants upload to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tenant-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'tenant')
  );

create policy "tenant-avatars: tenants and their landlords view selfies"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tenant-avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.conversations c
         where c.tenant_id::text = (storage.foldername(storage.objects.name))[1]
           and c.landlord_id = (select auth.uid())
      )
    )
  );

create policy "tenant-avatars: tenants replace their own selfie"
  on storage.objects for update to authenticated
  using (bucket_id = 'tenant-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'tenant-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tenant-avatars: tenants delete their own selfies"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
