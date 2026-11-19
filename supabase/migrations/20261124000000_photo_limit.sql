-- =============================================================================
-- Photo limit: a listing can have up to 9 photos (was 5).
-- The old check constraint is found by its definition, so its name does not matter.
-- =============================================================================
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.listings'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%cardinality(image_urls)%'
  loop
    execute format('alter table public.listings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.listings
  add constraint listings_image_urls_max_nine check (cardinality(image_urls) <= 9);
