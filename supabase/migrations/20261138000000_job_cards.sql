-- =============================================================================
-- Job cards: the fields a job seeker scans (pay, employment type, start date,
-- shifts, hours, visa and experience), job applications (Quick Apply), and a
-- job search that takes the new filters.
--
-- Old jobs keep their free-text pay and get empty new fields. The older
-- functions (jobs_near) stay, so the current site keeps working until the
-- new code is deployed.
--
-- Run after 20261137000000_rate_limits.sql.
-- =============================================================================

-- 1. New job fields.
alter table public.job_posts
  add column employment_type text check (employment_type in ('casual', 'part_time', 'full_time')),
  add column pay_rate_min    numeric(8, 2) check (pay_rate_min > 0 and pay_rate_min <= 500000),
  add column pay_rate_max    numeric(8, 2) check (pay_rate_max > 0 and pay_rate_max <= 500000),
  add column pay_unit        text not null default 'hour' check (pay_unit in ('hour', 'year')),
  add column super_included  boolean not null default false,
  add column start_date      date,
  add column immediate_start boolean not null default false,
  add column shift_windows   text[] not null default '{}'
    check (shift_windows <@ array['day', 'evening', 'weekends']::text[]),
  add column hours_per_week  integer check (hours_per_week between 1 and 80),
  add column no_experience   boolean not null default false,
  add column visa_friendly   boolean not null default false,
  add column postcode        text check (postcode ~ '^[0-9]{4}$');

alter table public.job_posts
  add constraint job_pay_range_order check (
    pay_rate_min is null or pay_rate_max is null or pay_rate_min <= pay_rate_max
  );

-- Column grants: posters may set the new fields too.
grant insert (
  poster_id, title, employer, suburb, pay, hours, description,
  employment_type, pay_rate_min, pay_rate_max, pay_unit, super_included,
  start_date, immediate_start, shift_windows, hours_per_week,
  no_experience, visa_friendly, postcode
) on public.job_posts to authenticated;

grant update (
  title, employer, suburb, pay, hours, description,
  employment_type, pay_rate_min, pay_rate_max, pay_unit, super_included,
  start_date, immediate_start, shift_windows, hours_per_week,
  no_experience, visa_friendly, postcode
) on public.job_posts to authenticated;

-- 2. Job applications (Quick Apply). A finished tenant applies once per job.
create table public.job_applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.job_posts (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (job_id, applicant_id)
);

alter table public.job_applications enable row level security;

create policy "Applicants see their own applications"
  on public.job_applications for select to authenticated
  using (applicant_id = (select auth.uid()));

create policy "Posters see applications to their jobs"
  on public.job_applications for select to authenticated
  using (exists (
    select 1 from public.job_posts j
     where j.id = job_applications.job_id and j.poster_id = (select auth.uid())
  ));

create policy "Finished tenants apply to jobs"
  on public.job_applications for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and exists (
      select 1
        from public.profiles p
        join public.tenant_profiles tp on tp.tenant_id = p.id
       where p.id = (select auth.uid())
         and p.role = 'tenant'
         and tp.profile_completed_at is not null
    )
  );

revoke all on public.job_applications from anon, authenticated;
grant select on public.job_applications to authenticated;
grant insert (job_id, applicant_id) on public.job_applications to authenticated;

-- 3. Job search with the card filters. Guests get the first 10 and nothing more.
create function public.find_jobs(
  p_lat double precision,
  p_lng double precision,
  p_km double precision,
  p_types text[],
  p_min_rate numeric,
  p_immediate boolean,
  p_shifts text[],
  p_bundle boolean,
  p_offset integer,
  p_limit integer
)
returns table (
  id uuid,
  title text,
  employer text,
  suburb text,
  postcode text,
  pay text,
  pay_rate_min numeric,
  pay_rate_max numeric,
  pay_unit text,
  super_included boolean,
  employment_type text,
  immediate_start boolean,
  start_date date,
  shift_windows text[],
  hours_per_week integer,
  no_experience boolean,
  visa_friendly boolean,
  hours text,
  description text,
  poster_id uuid,
  created_at timestamptz,
  distance_km double precision,
  room_id uuid,
  room_title text,
  room_price numeric,
  room_km double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_full boolean := public.viewer_can_see_listing_details();
  v_limit integer;
begin
  if not v_full and p_offset > 0 then
    raise exception 'Sign in to see more jobs.' using errcode = '42501';
  end if;
  v_limit := case when v_full then least(greatest(p_limit, 1), 500) else 10 end;

  return query
    select j.id, j.title, j.employer, j.suburb, j.postcode, j.pay,
           j.pay_rate_min, j.pay_rate_max, j.pay_unit, j.super_included,
           j.employment_type, j.immediate_start, j.start_date, j.shift_windows,
           j.hours_per_week, j.no_experience, j.visa_friendly, j.hours,
           case when v_full then j.description else null end,
           j.poster_id, j.created_at,
           case when p_lat is null then null
                else round(public.km_between(p_lat, p_lng, j.latitude, j.longitude)::numeric, 1)::double precision
           end,
           room.id, room.title, room.price_per_week, room.km
      from public.job_posts j
      left join lateral (
        select l.id, l.title, l.price_per_week,
               round(public.km_between(j.latitude, j.longitude, l.latitude, l.longitude)::numeric, 1)::double precision as km
          from public.listings l
         where l.landlord_id = j.poster_id
           and l.latitude is not null
           and j.latitude is not null
           and public.km_between(j.latitude, j.longitude, l.latitude, l.longitude) <= 25
         order by public.km_between(j.latitude, j.longitude, l.latitude, l.longitude)
         limit 1
      ) room on true
     where (p_lat is null or (j.latitude is not null
            and public.km_between(p_lat, p_lng, j.latitude, j.longitude) <= p_km))
       and (p_types is null or cardinality(p_types) = 0 or j.employment_type = any(p_types))
       and (p_min_rate is null or (j.pay_unit = 'hour' and j.pay_rate_max >= p_min_rate))
       and (not coalesce(p_immediate, false) or j.immediate_start)
       and (p_shifts is null or cardinality(p_shifts) = 0 or j.shift_windows && p_shifts)
       and (not coalesce(p_bundle, false) or room.id is not null)
     order by j.created_at desc, j.id desc
     offset greatest(p_offset, 0)
     limit v_limit;
end;
$$;

-- 4. Only signed-in users may call the job search with the bundle filter
--    (the function itself enforces the guest limits).
revoke all on function public.find_jobs(double precision, double precision, double precision, text[], numeric, boolean, text[], boolean, integer, integer) from public;
grant execute on function public.find_jobs(double precision, double precision, double precision, text[], numeric, boolean, text[], boolean, integer, integer) to anon, authenticated;
