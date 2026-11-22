-- =============================================================================
-- Rate limits against spam.
--
--   * Messages: a person may send at most 10 messages a minute.
--   * Page views: at most 600 are recorded a minute across the site. Extra
--     views are dropped quietly, so the table cannot be filled by a bot.
--
-- Run after 20261136000000_hide_admin_flag.sql.
-- =============================================================================

create function public.limit_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.messages m
       where m.sender_id = new.sender_id
         and m.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'You are sending messages too quickly. Wait a minute and try again.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.limit_message_rate();

create function public.cap_page_views()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.page_views v
       where v.created_at > now() - interval '1 minute') >= 600 then
    return null;
  end if;
  return new;
end;
$$;

create trigger page_views_cap
  before insert on public.page_views
  for each row execute function public.cap_page_views();
