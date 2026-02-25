-- ==============================================
-- EOD core modules hardening for batch/timetable/attendance
-- ==============================================

-- 1) Batch: add program type field required by onboarding spec
alter table if exists public.t201_batch
  add column if not exists program_type text;

-- Optional guard for date integrity if not already present
alter table if exists public.t201_batch
  drop constraint if exists chk_t201_dates_valid;

alter table if exists public.t201_batch
  add constraint chk_t201_dates_valid check (end_date > start_date);

-- 2) Academic groups + student assignment mapping
create table if not exists public.t209_acad_group (
  group_id         uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references public.t201_batch(batch_id) on delete cascade,
  group_code       text not null,
  group_name       text not null,
  group_type       text not null default 'acad' check (group_type in ('acad','elective','circle','project')),
  description      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  last_updated_at  timestamptz not null default now(),
  unique (batch_id, group_code)
);

create index if not exists idx_t209_batch on public.t209_acad_group(batch_id);
create index if not exists idx_t209_active on public.t209_acad_group(is_active);

create table if not exists public.t210_student_acad_group_map (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.t205_student_profile(id) on delete cascade,
  group_id         uuid not null references public.t209_acad_group(group_id) on delete cascade,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (student_id, group_id)
);

create index if not exists idx_t210_student on public.t210_student_acad_group_map(student_id);
create index if not exists idx_t210_group on public.t210_student_acad_group_map(group_id);

-- 3) Timetable events
create table if not exists public.t211_timetable_event (
  event_id         uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references public.t201_batch(batch_id) on delete cascade,
  division_id      uuid references public.t203_division(id) on delete set null,
  course_id        uuid references public.t206_course(id) on delete set null,
  faculty_id       uuid references public.t204_faculty_profile(id) on delete set null,
  event_date       date not null,
  start_time       time not null,
  end_time         time not null,
  venue            text,
  notes            text,
  is_published     boolean not null default false,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  last_updated_at  timestamptz not null default now(),
  constraint chk_t211_time_range check (end_time > start_time)
);

create index if not exists idx_t211_batch_date on public.t211_timetable_event(batch_id, event_date);
create index if not exists idx_t211_division on public.t211_timetable_event(division_id);
create index if not exists idx_t211_published on public.t211_timetable_event(is_published);

-- 4) Attendance records aligned to t2xx entities
create table if not exists public.t301_attendance_record (
  attendance_id    uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references public.t201_batch(batch_id) on delete cascade,
  division_id      uuid references public.t203_division(id) on delete set null,
  student_id       uuid not null references public.t205_student_profile(id) on delete cascade,
  course_id        uuid references public.t206_course(id) on delete set null,
  timetable_event_id uuid references public.t211_timetable_event(event_id) on delete set null,
  session_date     date not null,
  status           text not null check (status in ('Present','Absent')),
  source           text not null default 'manual' check (source in ('manual','excel','api')),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (student_id, course_id, session_date)
);

create index if not exists idx_t301_batch on public.t301_attendance_record(batch_id);
create index if not exists idx_t301_division on public.t301_attendance_record(division_id);
create index if not exists idx_t301_student on public.t301_attendance_record(student_id);
create index if not exists idx_t301_course on public.t301_attendance_record(course_id);
create index if not exists idx_t301_session_date on public.t301_attendance_record(session_date);

-- 5) RLS policy baseline
alter table if exists public.t209_acad_group enable row level security;
alter table if exists public.t210_student_acad_group_map enable row level security;
alter table if exists public.t211_timetable_event enable row level security;
alter table if exists public.t301_attendance_record enable row level security;

-- Read policies for authenticated users
drop policy if exists "Authenticated users can read t209 groups" on public.t209_acad_group;
create policy "Authenticated users can read t209 groups"
  on public.t209_acad_group for select to authenticated using (true);
drop policy if exists "Authenticated users can read t210 group maps" on public.t210_student_acad_group_map;
create policy "Authenticated users can read t210 group maps"
  on public.t210_student_acad_group_map for select to authenticated using (true);
drop policy if exists "Authenticated users can read t211 timetable" on public.t211_timetable_event;
create policy "Authenticated users can read t211 timetable"
  on public.t211_timetable_event for select to authenticated using (true);
drop policy if exists "Authenticated users can read t301 attendance" on public.t301_attendance_record;
create policy "Authenticated users can read t301 attendance"
  on public.t301_attendance_record for select to authenticated using (true);

-- Program office / developer write policies
drop policy if exists "Program office manages t209 groups" on public.t209_acad_group;
create policy "Program office manages t209 groups"
  on public.t209_acad_group for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office','developer')
    )
  );

drop policy if exists "Program office manages t210 maps" on public.t210_student_acad_group_map;
create policy "Program office manages t210 maps"
  on public.t210_student_acad_group_map for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office','developer')
    )
  );

drop policy if exists "Program office manages t211 timetable" on public.t211_timetable_event;
create policy "Program office manages t211 timetable"
  on public.t211_timetable_event for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office','developer')
    )
  );

drop policy if exists "Program office manages t301 attendance" on public.t301_attendance_record;
create policy "Program office manages t301 attendance"
  on public.t301_attendance_record for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office','developer')
    )
  );
