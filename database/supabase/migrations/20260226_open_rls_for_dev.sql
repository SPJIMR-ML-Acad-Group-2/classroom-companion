-- ============================================================
-- Open RLS: Full read + write for all authenticated users
-- Run this in Supabase SQL Editor.
-- Purpose: During development with mock auth, the role-check
--   policies (p.primary_role in (...)) fail because auth.uid()
--   may not have a matching t106_user_profile row.
--   This replaces those policies with open authenticated access.
-- ============================================================

-- t211_timetable_event
drop policy if exists "Program office manages t211"    on public.t211_timetable_event;
drop policy if exists "Program office manages t211 timetable" on public.t211_timetable_event;
drop policy if exists "Authenticated read t211"        on public.t211_timetable_event;

create policy "Authenticated full t211"
  on public.t211_timetable_event
  for all to authenticated using (true) with check (true);

-- t301_attendance_record
drop policy if exists "Program office manages t301"    on public.t301_attendance_record;
drop policy if exists "Program office manages t301 attendance" on public.t301_attendance_record;
drop policy if exists "Authenticated read t301"        on public.t301_attendance_record;

create policy "Authenticated full t301"
  on public.t301_attendance_record
  for all to authenticated using (true) with check (true);

-- t302_biometric_log
drop policy if exists "Program office manages t302"    on public.t302_biometric_log;

create policy "Authenticated full t302"
  on public.t302_biometric_log
  for all to authenticated using (true) with check (true);

-- t303_session_attendance
drop policy if exists "Program office manages t303"       on public.t303_session_attendance;
drop policy if exists "Faculty views t303 own sessions"   on public.t303_session_attendance;
drop policy if exists "Students view t303 own attendance" on public.t303_session_attendance;
drop policy if exists "Exam office reads t303"            on public.t303_session_attendance;

create policy "Authenticated full t303"
  on public.t303_session_attendance
  for all to authenticated using (true) with check (true);

-- t401_attendance_config
drop policy if exists "Program office manages t401"    on public.t401_attendance_config;
drop policy if exists "Authenticated read t401"        on public.t401_attendance_config;

create policy "Authenticated full t401"
  on public.t401_attendance_config
  for all to authenticated using (true) with check (true);

-- t209_acad_group
drop policy if exists "Program office manages t209 groups" on public.t209_acad_group;
drop policy if exists "Authenticated users can read t209 groups" on public.t209_acad_group;

create policy "Authenticated full t209"
  on public.t209_acad_group
  for all to authenticated using (true) with check (true);

-- t210_student_acad_group_map
drop policy if exists "Program office manages t210 maps" on public.t210_student_acad_group_map;
drop policy if exists "Authenticated users can read t210 group maps" on public.t210_student_acad_group_map;

create policy "Authenticated full t210"
  on public.t210_student_acad_group_map
  for all to authenticated using (true) with check (true);

-- Confirm
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in (
    't209_acad_group','t210_student_acad_group_map',
    't211_timetable_event','t301_attendance_record',
    't302_biometric_log','t303_session_attendance','t401_attendance_config'
  )
order by tablename, policyname;
