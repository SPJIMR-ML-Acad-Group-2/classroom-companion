-- =============================================================
-- Timetable + Biometric Attendance Engine
-- Migration: 20260226_timetable_biometric_attendance.sql
--
-- Tables created (all idempotent):
--   t211_timetable_event      — Class session timetable
--   t301_attendance_record    — Manual / Excel attendance
--   t302_biometric_log        — Raw biometric punch logs
--   t303_session_attendance   — Biometric-derived processed attendance
--   t401_attendance_config    — Grace window + low-attendance threshold
--
-- NOT in scope: t209_acad_group, t210_student_acad_group_map
--
-- Biometric machine Excel columns mapped:
--   Roll No          → roll_no
--   Swipe TIme       → punch_datetime  (note: typo in column name is from machine)
--   Error Code       → error_code      (frontend filters for 'success' only)
--   Controller Name  → device_id       (optional)
-- =============================================================


-- ============================================================
-- 1. t211: Timetable Events
-- ============================================================

create table if not exists public.t211_timetable_event (
  event_id        uuid        primary key default gen_random_uuid(),
  batch_id        uuid        not null references public.t201_batch(batch_id)     on delete cascade,
  division_id     uuid        references public.t203_division(id)                 on delete set null,
  course_id       uuid        references public.t206_course(id)                   on delete set null,
  faculty_id      uuid        references public.t204_faculty_profile(id)          on delete set null,
  event_date      date        not null,
  start_time      time        not null,
  end_time        time        not null,
  venue           text,
  notes           text,
  is_published    boolean     not null default false,
  created_by      uuid        references auth.users(id)                           on delete set null,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  constraint chk_t211_time_range check (end_time > start_time)
);

-- Add status column if table already existed without it
alter table public.t211_timetable_event
  add column if not exists status text not null default 'scheduled';

alter table public.t211_timetable_event
  drop constraint if exists t211_timetable_event_status_check;
alter table public.t211_timetable_event
  add constraint t211_timetable_event_status_check
  check (status in ('scheduled', 'completed', 'cancelled'));

create index if not exists idx_t211_batch_date on public.t211_timetable_event (batch_id, event_date);
create index if not exists idx_t211_division   on public.t211_timetable_event (division_id);
create index if not exists idx_t211_faculty    on public.t211_timetable_event (faculty_id);
create index if not exists idx_t211_published  on public.t211_timetable_event (is_published);
create index if not exists idx_t211_status     on public.t211_timetable_event (status);

create or replace function public.fn_t211_set_updated_at()
returns trigger language plpgsql as $$
begin new.last_updated_at = now(); return new; end; $$;

drop trigger if exists trg_t211_set_updated_at on public.t211_timetable_event;
create trigger trg_t211_set_updated_at
before update on public.t211_timetable_event
for each row execute function public.fn_t211_set_updated_at();

alter table public.t211_timetable_event enable row level security;

drop policy if exists "Authenticated read t211" on public.t211_timetable_event;
create policy "Authenticated read t211"
  on public.t211_timetable_event for select to authenticated using (true);

drop policy if exists "Program office manages t211" on public.t211_timetable_event;
create policy "Program office manages t211"
  on public.t211_timetable_event for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ============================================================
-- 2. t301: Manual / Excel Attendance
-- ============================================================

create table if not exists public.t301_attendance_record (
  attendance_id      uuid        primary key default gen_random_uuid(),
  batch_id           uuid        not null references public.t201_batch(batch_id)       on delete cascade,
  division_id        uuid        references public.t203_division(id)                   on delete set null,
  student_id         uuid        not null references public.t205_student_profile(id)   on delete cascade,
  course_id          uuid        references public.t206_course(id)                     on delete set null,
  timetable_event_id uuid        references public.t211_timetable_event(event_id)      on delete set null,
  session_date       date        not null,
  status             text        not null check (status in ('Present', 'Absent')),
  source             text        not null default 'manual'
                     check (source in ('manual', 'excel', 'api')),
  created_by         uuid        references auth.users(id)                             on delete set null,
  created_at         timestamptz not null default now(),
  unique (student_id, course_id, session_date)
);

create index if not exists idx_t301_batch        on public.t301_attendance_record (batch_id);
create index if not exists idx_t301_division     on public.t301_attendance_record (division_id);
create index if not exists idx_t301_student      on public.t301_attendance_record (student_id);
create index if not exists idx_t301_course       on public.t301_attendance_record (course_id);
create index if not exists idx_t301_session_date on public.t301_attendance_record (session_date);

alter table public.t301_attendance_record enable row level security;

drop policy if exists "Authenticated read t301" on public.t301_attendance_record;
create policy "Authenticated read t301"
  on public.t301_attendance_record for select to authenticated using (true);

drop policy if exists "Program office manages t301" on public.t301_attendance_record;
create policy "Program office manages t301"
  on public.t301_attendance_record for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer', 'faculty', 'ta')
    )
  );


-- ============================================================
-- 3. t302: Biometric Raw Punch Logs
-- ============================================================

create table if not exists public.t302_biometric_log (
  log_id          uuid        primary key default gen_random_uuid(),
  roll_no         text        not null,
  punch_datetime  timestamptz not null,
  device_id       text,        -- from Controller Name column
  error_code      text,        -- raw value from Error Code column (frontend filters 'success')
  import_batch_id text        not null,  -- e.g. 'bio-2026-02-25T0900'
  created_at      timestamptz not null default now()
);

create index if not exists idx_t302_roll_punch   on public.t302_biometric_log (roll_no, punch_datetime);
create index if not exists idx_t302_import_batch on public.t302_biometric_log (import_batch_id);
create index if not exists idx_t302_punch_time   on public.t302_biometric_log (punch_datetime);

alter table public.t302_biometric_log enable row level security;

drop policy if exists "Program office manages t302" on public.t302_biometric_log;
create policy "Program office manages t302"
  on public.t302_biometric_log for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ============================================================
-- 4. t303: Session Attendance (Biometric-processed)
--    One row per (event_id, student_id) — no duplicates.
-- ============================================================

create table if not exists public.t303_session_attendance (
  attendance_id    uuid        primary key default gen_random_uuid(),
  event_id         uuid        not null references public.t211_timetable_event(event_id) on delete cascade,
  student_id       uuid        not null references public.t205_student_profile(id)       on delete cascade,
  status           text        not null check (status in ('present', 'absent', 'late')),
  first_punch_time timestamptz,
  last_punch_time  timestamptz,
  marked_by        text        not null default 'system' check (marked_by in ('system', 'faculty')),
  marked_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  last_updated_at  timestamptz not null default now(),
  unique (event_id, student_id)
);

create index if not exists idx_t303_event   on public.t303_session_attendance (event_id);
create index if not exists idx_t303_student on public.t303_session_attendance (student_id);
create index if not exists idx_t303_status  on public.t303_session_attendance (status);

create or replace function public.fn_t303_set_updated_at()
returns trigger language plpgsql as $$
begin new.last_updated_at = now(); return new; end; $$;

drop trigger if exists trg_t303_set_updated_at on public.t303_session_attendance;
create trigger trg_t303_set_updated_at
before update on public.t303_session_attendance
for each row execute function public.fn_t303_set_updated_at();

alter table public.t303_session_attendance enable row level security;

drop policy if exists "Program office manages t303" on public.t303_session_attendance;
create policy "Program office manages t303"
  on public.t303_session_attendance for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );

drop policy if exists "Faculty views t303 own sessions" on public.t303_session_attendance;
create policy "Faculty views t303 own sessions"
  on public.t303_session_attendance for select using (
    exists (
      select 1
      from public.t211_timetable_event ev
      join public.t204_faculty_profile fp on fp.id = ev.faculty_id
      join public.t106_user_profile up    on up.id = fp.profile_id
      where ev.event_id = t303_session_attendance.event_id
        and up.user_id = auth.uid()
    )
  );

drop policy if exists "Students view t303 own attendance" on public.t303_session_attendance;
create policy "Students view t303 own attendance"
  on public.t303_session_attendance for select using (
    student_id in (
      select sp.id
      from public.t205_student_profile sp
      join public.t106_user_profile up on up.id = sp.profile_id
      where up.user_id = auth.uid()
    )
  );

drop policy if exists "Exam office reads t303" on public.t303_session_attendance;
create policy "Exam office reads t303"
  on public.t303_session_attendance for select using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role = 'exam_office'
    )
  );


-- ============================================================
-- 5. t401: Attendance Configuration
-- ============================================================

create table if not exists public.t401_attendance_config (
  config_key   text        primary key,
  config_value text        not null,
  description  text,
  updated_at   timestamptz not null default now()
);

insert into public.t401_attendance_config (config_key, config_value, description) values
  ('grace_minutes',      '10', 'Grace window in minutes applied to session start/end times'),
  ('low_attendance_pct', '75', 'Attendance % below which a student is flagged as low attendance')
on conflict (config_key) do nothing;

alter table public.t401_attendance_config enable row level security;

drop policy if exists "Authenticated read t401" on public.t401_attendance_config;
create policy "Authenticated read t401"
  on public.t401_attendance_config for select to authenticated using (true);

drop policy if exists "Program office manages t401" on public.t401_attendance_config;
create policy "Program office manages t401"
  on public.t401_attendance_config for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('developer', 'program_office')
    )
  );


-- ============================================================
-- 6. RPC: fn_process_attendance_for_event
--
-- For each active student in the session's division:
--   1. Count biometric punches within the grace window
--   2. If at least one punch → present
--   3. If no punch → absent
--   4. Upsert one row into t303_session_attendance
--   5. Mark session status = 'completed'
--
-- Validation examples:
--   Session 9:00–10:10, grace 10min → window 8:50–10:20
--   Student A punches 9:10, 9:50, 10:50 → 9:10 & 9:50 in window → present
--   Student B punches 9:20, 9:40         → present
--   Student C punches 11:00              → outside window → absent
-- ============================================================

create or replace function public.fn_process_attendance_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event     record;
  v_grace     int;
  v_win_start timestamp;
  v_win_end   timestamp;
  v_student   record;
  v_punch     record;
  v_status    text;
  v_present   int := 0;
  v_absent    int := 0;
begin
  -- 1. Load session
  select * into v_event
  from t211_timetable_event
  where event_id = p_event_id;

  if not found then
    return jsonb_build_object('error', 'Session not found', 'event_id', p_event_id);
  end if;

  if v_event.division_id is null then
    return jsonb_build_object('error', 'Session has no division assigned', 'event_id', p_event_id);
  end if;

  -- 2. Grace window from config
  select coalesce(config_value::int, 10)
  into v_grace
  from t401_attendance_config
  where config_key = 'grace_minutes';

  if v_grace is null then v_grace := 10; end if;

  -- 3. Build effective attendance window (timestamp without timezone)
  --    punch_datetime is compared by casting to timestamp for same-timezone consistency
  v_win_start := (v_event.event_date::text || ' ' || v_event.start_time::text)::timestamp
                 - (v_grace || ' minutes')::interval;
  v_win_end   := (v_event.event_date::text || ' ' || v_event.end_time::text)::timestamp
                 + (v_grace || ' minutes')::interval;

  -- 4. Process each active student in the division
  for v_student in
    select sp.id as student_id, sp.roll_number
    from t205_student_profile sp
    where sp.division_id = v_event.division_id
      and sp.is_active = true
  loop
    -- 5. Find earliest and latest punch within window
    select
      min(punch_datetime) as first_punch,
      max(punch_datetime) as last_punch
    into v_punch
    from t302_biometric_log
    where roll_no = v_student.roll_number
      and punch_datetime::timestamp between v_win_start and v_win_end;

    if v_punch.first_punch is not null then
      v_status  := 'present';
      v_present := v_present + 1;
    else
      v_status := 'absent';
      v_absent := v_absent + 1;
    end if;

    -- 6. Upsert: enforce unique (event_id, student_id)
    insert into t303_session_attendance
      (event_id, student_id, status, first_punch_time, last_punch_time, marked_by, marked_at)
    values
      (p_event_id, v_student.student_id, v_status,
       v_punch.first_punch, v_punch.last_punch, 'system', now())
    on conflict (event_id, student_id) do update
      set status           = excluded.status,
          first_punch_time = excluded.first_punch_time,
          last_punch_time  = excluded.last_punch_time,
          marked_by        = 'system',
          marked_at        = now(),
          last_updated_at  = now();
  end loop;

  -- 7. Mark session as completed
  update t211_timetable_event
  set status          = 'completed',
      last_updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object(
    'event_id',     p_event_id,
    'present',      v_present,
    'absent',       v_absent,
    'total',        v_present + v_absent,
    'window_start', v_win_start,
    'window_end',   v_win_end,
    'grace_minutes', v_grace
  );
end;
$$;

grant execute on function public.fn_process_attendance_for_event(uuid) to authenticated;


-- ============================================================
-- Verify
-- ============================================================
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    't211_timetable_event',
    't301_attendance_record',
    't302_biometric_log',
    't303_session_attendance',
    't401_attendance_config'
  )
order by table_name;

select config_key, config_value from public.t401_attendance_config;
