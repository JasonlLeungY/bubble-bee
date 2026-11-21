-- =============================================================================
-- Search listings and jobs within a distance of a suburb.
--
--   * Job posts get coordinates, set from the suburb table the same way listings
--     already do.
--   * listings_near and jobs_near return the newest rows within a distance of a
--     point, with the distance in kilometres. Everyone may read the first 10.
--     Further pages need a finished profile, as for every other listing.
--
-- Listings and jobs only appear in a search when their suburb has coordinates
-- (suburb_locations). The app saves a suburb there when it is first checked.
--
-- Run after 20261133000000_suburb_browsing.sql. The suburb-only functions from
-- that migration are removed here.
-- =============================================================================

-- 1. Coordinates on job posts, set from suburb_locations on insert and suburb change.
alter table public.job_posts
  add column latitude  double precision,
  add column longitude double precision;

create function public.set_job_coordinates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  centre record;
begin
  select s.latitude, s.longitude into centre
    from public.suburb_locations s
   where s.suburb_key = lower(btrim(new.suburb));

  new.latitude  := centre.latitude;   -- null when the suburb is not mapped yet
  new.longitude := centre.longitude;
  return new;
end;
$$;

create trigger job_posts_set_coordinates
  before insert or update of suburb on public.job_posts
  for each row execute function public.set_job_coordinates();

-- 2. Fill in coordinates for rows saved before this migration.
update public.listings l
   set latitude = s.latitude, longitude = s.longitude
  from public.suburb_locations s
 where s.suburb_key = lower(btrim(l.suburb))
   and l.latitude is null;

update public.job_posts j
   set latitude = s.latitude, longitude = s.longitude
  from public.suburb_locations s
 where s.suburb_key = lower(btrim(j.suburb))
   and j.latitude is null;

-- 3. Distance between two points, in kilometres (great-circle distance).
create function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- 4. Listings within a distance of a point, newest first.
--    Guests get the first 10 and nothing more. Others may page.
create function public.listings_near(
  p_lat double precision,
  p_lng double precision,
  p_km double precision,
  p_home_type text,
  p_offset integer,
  p_limit integer
)
returns table (
  id uuid,
  title text,
  suburb text,
  price_per_week numeric,
  image_urls text[],
  is_smoker_allowed boolean,
  is_shift_worker_friendly boolean,
  tolerates_noise boolean,
  gender_preference text,
  home_type text,
  created_at timestamptz,
  distance_km double precision
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
  if p_home_type not in ('entire_home', 'share_house') then
    raise exception 'Unknown home type.' using errcode = '22023';
  end if;
  if not v_full and p_offset > 0 then
    raise exception 'Sign in to see more rooms.' using errcode = '42501';
  end if;
  v_limit := case when v_full then least(greatest(p_limit, 1), 500) else 10 end;

  return query
    select l.id, l.title, l.suburb, l.price_per_week, l.image_urls,
           l.is_smoker_allowed, l.is_shift_worker_friendly, l.tolerates_noise,
           l.gender_preference, l.home_type, l.created_at,
           round(public.km_between(p_lat, p_lng, l.latitude, l.longitude)::numeric, 1)::double precision
    from public.listings l
    where l.home_type = p_home_type
      and l.latitude is not null
      and public.km_between(p_lat, p_lng, l.latitude, l.longitude) <= p_km
    order by l.created_at desc, l.id desc
    offset greatest(p_offset, 0)
    limit v_limit;
end;
$$;

-- 5. Jobs within a distance of a point, newest first. Same rule for pages.
create function public.jobs_near(
  p_lat double precision,
  p_lng double precision,
  p_km double precision,
  p_offset integer,
  p_limit integer
)
returns table (
  id uuid,
  title text,
  employer text,
  suburb text,
  pay text,
  hours text,
  created_at timestamptz,
  distance_km double precision
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
    select j.id, j.title, j.employer, j.suburb, j.pay, j.hours, j.created_at,
           round(public.km_between(p_lat, p_lng, j.latitude, j.longitude)::numeric, 1)::double precision
    from public.job_posts j
    where j.latitude is not null
      and public.km_between(p_lat, p_lng, j.latitude, j.longitude) <= p_km
    order by j.created_at desc, j.id desc
    offset greatest(p_offset, 0)
    limit v_limit;
end;
$$;

-- 6. Remove the suburb-name-only functions, now replaced by the distance search.
drop function if exists public.first_page_listings_in_suburb(text, text);
drop function if exists public.first_page_jobs_in_suburb(text);

revoke all on function public.km_between(double precision, double precision, double precision, double precision) from public;
grant execute on function public.km_between(double precision, double precision, double precision, double precision) to anon, authenticated;

revoke all on function public.listings_near(double precision, double precision, double precision, text, integer, integer) from public;
grant execute on function public.listings_near(double precision, double precision, double precision, text, integer, integer) to anon, authenticated;

revoke all on function public.jobs_near(double precision, double precision, double precision, integer, integer) from public;
grant execute on function public.jobs_near(double precision, double precision, double precision, integer, integer) to anon, authenticated;
