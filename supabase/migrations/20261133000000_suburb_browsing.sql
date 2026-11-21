-- =============================================================================
-- Browse listings and jobs by suburb.
--
-- Everyone may see the list of suburbs, and the first 10 listings or jobs in a
-- suburb. The functions return card details only, never descriptions, and never
-- more than 10 rows. Pages after the first still need a finished profile, as
-- before (the listings table itself stays closed to guests).
--
-- Run after 20261132000000_home_types_and_jobs.sql.
-- =============================================================================

-- 1. Every suburb with a listing or a job, once each, in alphabetical order.
create function public.browse_suburbs()
returns table (suburb text)
language sql
stable
security definer
set search_path = ''
as $$
  select min(s.suburb)
    from (
      select l.suburb from public.listings l
      union all
      select j.suburb from public.job_posts j
    ) s
   group by lower(btrim(s.suburb))
   order by lower(btrim(min(s.suburb)));
$$;

-- 2. The newest 10 listings of one home type in one suburb.
create function public.first_page_listings_in_suburb(p_suburb text, p_home_type text)
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
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.title, l.suburb, l.price_per_week, l.image_urls,
         l.is_smoker_allowed, l.is_shift_worker_friendly, l.tolerates_noise,
         l.gender_preference, l.home_type, l.created_at
    from public.listings l
   where lower(btrim(l.suburb)) = lower(btrim(p_suburb))
     and l.home_type = p_home_type
   order by l.created_at desc, l.id desc
   limit 10;
$$;

-- 3. The newest 10 jobs in one suburb, without the description.
create function public.first_page_jobs_in_suburb(p_suburb text)
returns table (
  id uuid,
  title text,
  employer text,
  suburb text,
  pay text,
  hours text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title, j.employer, j.suburb, j.pay, j.hours, j.created_at
    from public.job_posts j
   where lower(btrim(j.suburb)) = lower(btrim(p_suburb))
   order by j.created_at desc, j.id desc
   limit 10;
$$;

revoke all on function public.browse_suburbs() from public;
revoke all on function public.first_page_listings_in_suburb(text, text) from public;
revoke all on function public.first_page_jobs_in_suburb(text) from public;

grant execute on function public.browse_suburbs() to anon, authenticated;
grant execute on function public.first_page_listings_in_suburb(text, text) to anon, authenticated;
grant execute on function public.first_page_jobs_in_suburb(text) to anon, authenticated;
