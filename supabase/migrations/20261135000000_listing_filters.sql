-- =============================================================================
-- Listing search with a price range and a sort order.
--
-- find_listings replaces listings_near. It can filter by:
--   * a distance from a point (optional),
--   * a minimum and maximum weekly price (optional),
-- and sort by newest, lowest price or highest price.
--
-- Everyone may read the first 10 results. Pages after the first need a finished
-- profile, as for every other listing.
--
-- Run after 20261134000000_radius_search.sql.
-- =============================================================================

create function public.find_listings(
  p_home_type text,
  p_lat double precision,
  p_lng double precision,
  p_km double precision,
  p_min_price numeric,
  p_max_price numeric,
  p_sort text,
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
  if p_sort not in ('newest', 'price_asc', 'price_desc') then
    raise exception 'Unknown sort order.' using errcode = '22023';
  end if;
  if not v_full and p_offset > 0 then
    raise exception 'Sign in to see more rooms.' using errcode = '42501';
  end if;
  v_limit := case when v_full then least(greatest(p_limit, 1), 500) else 10 end;

  return query
    select l.id, l.title, l.suburb, l.price_per_week, l.image_urls,
           l.is_smoker_allowed, l.is_shift_worker_friendly, l.tolerates_noise,
           l.gender_preference, l.home_type, l.created_at,
           case when p_lat is null then null
                else round(public.km_between(p_lat, p_lng, l.latitude, l.longitude)::numeric, 1)::double precision
           end
    from public.listings l
    where l.home_type = p_home_type
      and (p_lat is null or (l.latitude is not null
           and public.km_between(p_lat, p_lng, l.latitude, l.longitude) <= p_km))
      and (p_min_price is null or l.price_per_week >= p_min_price)
      and (p_max_price is null or l.price_per_week <= p_max_price)
    order by
      case when p_sort = 'price_asc' then l.price_per_week end asc,
      case when p_sort = 'price_desc' then l.price_per_week end desc,
      l.created_at desc,
      l.id desc
    offset greatest(p_offset, 0)
    limit v_limit;
end;
$$;

drop function if exists public.listings_near(double precision, double precision, double precision, text, integer, integer);

revoke all on function public.find_listings(text, double precision, double precision, double precision, numeric, numeric, text, integer, integer) from public;
grant execute on function public.find_listings(text, double precision, double precision, double precision, numeric, numeric, text, integer, integer) to anon, authenticated;
