-- =============================================================================
-- Guests see the job search without the employer's identity or room details.
--
-- The search (find_jobs) returned the poster's user id and the employer's
-- nearby room (id, title, price, distance) to everyone. Guests now get those
-- as empty values. The Work + Stay filter still works for guests, because it
-- is applied in the query, before these columns are chosen.
--
-- Same signature and return type as 20261138000000_job_cards.sql, so this
-- replaces the function in place and keeps its grants.
--
-- Run after 20261139000000_job_messages.sql.
-- =============================================================================

create or replace function public.find_jobs(
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
           case when v_full then j.poster_id else null end,
           j.created_at,
           case when p_lat is null then null
                else round(public.km_between(p_lat, p_lng, j.latitude, j.longitude)::numeric, 1)::double precision
           end,
           case when v_full then room.id else null end,
           case when v_full then room.title else null end,
           case when v_full then room.price_per_week else null end,
           case when v_full then room.km else null end
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
