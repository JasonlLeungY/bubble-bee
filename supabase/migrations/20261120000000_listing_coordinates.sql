-- =============================================================================
-- Listing map: suburb centres and listing coordinates.
--
-- Coordinates are always the centre of a suburb, never a street address.
-- The database sets them from suburb_locations whenever a listing's suburb is
-- written, so a landlord cannot place a listing somewhere else on the map.
-- =============================================================================

-- 1. Suburb centres. Filled by an admin (or scripts/suburb-coordinates.mjs).
create table public.suburb_locations (
  suburb_key text primary key,                 -- lower-case, trimmed name, e.g. 'marleston'
  suburb     text not null,                    -- display name, e.g. 'Marleston'
  state      text,                             -- e.g. 'South Australia'
  latitude   double precision not null check (latitude between -44 and -10),
  longitude  double precision not null check (longitude between 112 and 154),
  source     text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.suburb_locations enable row level security;

create policy "Suburb centres are public" on public.suburb_locations
  for select to anon, authenticated using (true);

revoke all on public.suburb_locations from anon, authenticated;
grant select on public.suburb_locations to anon, authenticated;

-- 2. Coordinates on listings. Not writable by clients: the column grants from
--    the earlier migrations never include them, and the trigger sets them.
alter table public.listings
  add column latitude  double precision,
  add column longitude double precision;

create function public.set_listing_coordinates()
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

create trigger listings_set_coordinates
  before insert or update of suburb on public.listings
  for each row execute function public.set_listing_coordinates();

-- After adding a suburb to suburb_locations, refresh its listings:
--   update public.listings set suburb = suburb where lower(btrim(suburb)) = 'marleston';
