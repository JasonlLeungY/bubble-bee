-- =============================================================================
-- Block 1: profiles, linked 1:1 to auth.users by a trigger.
-- Paste into the Supabase SQL Editor and run once.
-- =============================================================================

-- 1. Table -------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  first_name      text,
  last_name       text,
  role            text    not null default 'tenant'
                    check (role in ('tenant', 'landlord')),
  is_smoker       boolean not null default false,
  is_shift_worker boolean not null default false,
  tolerates_noise boolean not null default false
);

-- 2. Row Level Security ------------------------------------------------------
alter table public.profiles enable row level security;

-- 3. Policies ----------------------------------------------------------------
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using      ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Explicit grants so the table works through the Data API regardless of the
-- project's default privileges. RLS above still decides which rows.
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- 4. Create a profile automatically on sign-up --------------------------------
-- Reads first_name, last_name and role from the metadata sent by
-- supabase.auth.signUp({ options: { data: { ... } } }).
-- That metadata is client-supplied, so it is trimmed, length-capped, and any
-- role other than 'landlord' falls back to 'tenant' instead of failing sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), 80),
    left(nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''), 80),
    case when new.raw_user_meta_data ->> 'role' = 'landlord'
      then 'landlord'
      else 'tenant'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
