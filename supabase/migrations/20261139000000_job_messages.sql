-- =============================================================================
-- Messages about jobs. A finished tenant can message a job's employer (the
-- poster) from the job page. Jobs reuse the conversations and messages tables:
-- a conversation is about either one listing or one job, never both.
--
-- Job conversations have no house-rules gate. The gate is a finished tenant
-- profile, the same as Quick Apply. Gender and lifestyle rules belong to rooms.
--
-- Run after 20261138000000_job_cards.sql.
-- =============================================================================

-- 1. A conversation is about a listing or a job.
alter table public.conversations
  alter column listing_id drop not null,
  add column job_id uuid
    constraint conversations_job_id_fkey
    references public.job_posts (id) on delete cascade;

alter table public.conversations
  add constraint conversations_one_subject check (num_nonnulls(listing_id, job_id) = 1),
  add constraint conversations_one_per_tenant_per_job unique (job_id, tenant_id);

-- 2. Gate for job conversations. A security definer function keeps the check
--    off the table's own policies, so no policy loop can form.
create function public.can_message_job(p_job_id uuid, p_poster_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.job_posts j
      join public.profiles p on p.id = (select auth.uid())
      join public.tenant_profiles tp on tp.tenant_id = p.id
     where j.id = p_job_id
       and j.poster_id = p_poster_id
       and p.role = 'tenant'
       and tp.profile_completed_at is not null
  );
$$;

revoke all on function public.can_message_job(uuid, uuid) from public, anon;
grant execute on function public.can_message_job(uuid, uuid) to authenticated;

-- 3. The insert policy for job conversations. It sits beside the listing one;
--    insert policies combine with OR, and each only matches its own kind.
create policy "Finished tenants can message a job's employer"
  on public.conversations for insert
  to authenticated
  with check (
    (select auth.uid()) = tenant_id
    and listing_id is null
    and public.can_message_job(conversations.job_id, conversations.landlord_id)
  );

-- Column grant for the new column. Inserts still cannot set timestamps.
grant insert (job_id) on public.conversations to authenticated;
