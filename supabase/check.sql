-- Setup check: shows which of this app's tables exist and their columns.
-- Read-only; changes nothing.
select
  t.name as "table",
  coalesce(
    (select string_agg(c.column_name, ', ' order by c.ordinal_position)
       from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t.name),
    '(not created yet)'
  ) as columns
from (values
  (1, 'profiles'), (2, 'listings'), (3, 'listing_images'),
  (4, 'conversations'), (5, 'messages')
) as t(n, name)
order by t.n;
