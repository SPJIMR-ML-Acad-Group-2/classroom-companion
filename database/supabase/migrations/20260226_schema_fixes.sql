-- ============================================================
-- Schema Fix Patch — Run in Supabase SQL Editor
-- Fixes: t205 missing application_number, division_id nullable,
--        t106 trigger not attached, and t201/t202/t205 FK mismatches
-- ============================================================

-- 1. Add application_number to t205_student_profile (if missing)
alter table public.t205_student_profile
  add column if not exists application_number text;

-- 2. Make division_id nullable in t205 (division is assigned later)
alter table public.t205_student_profile
  alter column division_id drop not null;

-- 3. Fix batch_id FK in t205: t201_batch PK is 'batch_id', not 'id'
--    Drop the broken FK and add the correct one
alter table public.t205_student_profile
  drop constraint if exists t205_student_profile_batch_id_fkey;

alter table public.t205_student_profile
  add constraint t205_student_profile_batch_id_fkey
  foreign key (batch_id) references public.t201_batch(batch_id) on delete cascade;

-- 4. Fix batch_id FK in t202_specialization (same issue)
alter table public.t202_specialization
  drop constraint if exists t202_specialization_batch_id_fkey;

alter table public.t202_specialization
  add constraint t202_specialization_batch_id_fkey
  foreign key (batch_id) references public.t201_batch(batch_id) on delete cascade;

-- 5. Fix batch_id FK in t203_division (same issue)
alter table public.t203_division
  drop constraint if exists t203_division_batch_id_fkey;

alter table public.t203_division
  add constraint t203_division_batch_id_fkey
  foreign key (batch_id) references public.t201_batch(batch_id) on delete cascade;

-- 6. Patch seeded t202 rows that have null batch_id (from FK mismatch during seeding)
update public.t202_specialization
set batch_id = (
  select batch_id from public.t201_batch order by created_at desc limit 1
)
where batch_id is null;

-- 7. Ensure the t106 auth trigger is registered (handle_new_user)
--    The function exists but the trigger on auth.users may be missing.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Open RLS on t205 for dev (in case the restrictive policy blocks inserts)
drop policy if exists "Dev full access t205" on public.t205_student_profile;
create policy "Dev full access t205"
  on public.t205_student_profile
  for all to authenticated using (true) with check (true);

-- 9. Verify
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 't205_student_profile'
  and column_name in ('application_number', 'division_id', 'batch_id')
order by column_name;

-- Check the trigger exists
select trigger_name, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';

-- Check t106 rows exist for current auth users
select u.email, p.id, p.primary_role, p.created_at
from auth.users u
left join public.t106_user_profile p on p.user_id = u.id
order by u.created_at desc
limit 10;
