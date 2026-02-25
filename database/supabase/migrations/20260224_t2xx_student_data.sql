-- =============================================================
-- t2xx_student_data: Student-related master data tables
-- Follows the same conventions as t1xx_consolidated.sql
-- Run order: t201 → t202 → t203 → t204 → t205 → t206 → t207 → t208
-- =============================================================


-- ==========================================
-- t201: Batch
-- Academic batch / cohort (e.g. PGDM 2024-26)
-- ==========================================

create table if not exists public.t201_batch (
  batch_id              uuid        primary key default gen_random_uuid(),
  batch_code      text        not null unique,           -- e.g. 'PGDM-2024-26'
  batch_name      text        not null,                  -- e.g. 'PGDM 2024-26'
  batch_description text     null,
  programme_head    text     not null,                  -- e.g. 'PGDM', 'PGDM-B', 'MHRD'
  start_date     date         not null,
  end_date        date         not null,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),

  constraint chk_t201_date check (end_date > start_date)
);

create index if not exists idx_t201_active    on public.t201_batch (is_active);
create index if not exists idx_t201_program   on public.t201_batch (programme_head);

create or replace function public.fn_t201_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t201_set_updated_at on public.t201_batch;
create trigger trg_t201_set_updated_at
before update on public.t201_batch
for each row execute function public.fn_t201_set_updated_at();

alter table public.t201_batch enable row level security;

create policy "Authenticated users can read batches"
  on public.t201_batch for select to authenticated using (true);

create policy "Program office manages batches"
  on public.t201_batch for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ==========================================
-- t202: Specialization
-- Specialization streams (e.g. Finance, Marketing, Operations)
-- ==========================================

create table if not exists public.t202_specialization (
  id              uuid        primary key default gen_random_uuid(),
  batch_id        uuid        references public.t201_batch (id) on delete cascade,
  spec_code       text        not null unique,           -- e.g. 'FIN', 'MKT', 'OPS'
  spec_name       text        not null,                  -- e.g. 'Finance'
  spec_description     text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create index if not exists idx_t202_active on public.t202_specialization (is_active);
create index if not exists idx_t202_batch  on public.t202_specialization (batch_id);

create or replace function public.fn_t202_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t202_set_updated_at on public.t202_specialization;
create trigger trg_t202_set_updated_at
before update on public.t202_specialization
for each row execute function public.fn_t202_set_updated_at();

alter table public.t202_specialization enable row level security;

create policy "Authenticated users can read specializations"
  on public.t202_specialization for select to authenticated using (true);

create policy "Program office manages specializations"
  on public.t202_specialization for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );

-- Seed common specializations
-- Links these to the most recently created batch in t201
insert into public.t202_specialization (batch_id, spec_code, spec_name, spec_description)
select 
  b.id as batch_id,
  s.spec_code,
  s.spec_name,
  s.spec_description
from (values
  ('FIN',  'Finance Management',                    'Finance Specialisation'),
  ('MKT',  'Marketing Management',                  'Marketing Specialisation'),
  ('OPS',  'Operations and Supply Chain Management', 'Operations Specialisation'),
  ('IMA',  'Information Management and Analytics',   'Information Management and Analytics Specialisation')
) as s(spec_code, spec_name, spec_description)
left join (
  select id from public.t201_batch order by created_at desc limit 1
) as b on true
on conflict (spec_code) do update
  set spec_name = excluded.spec_name,
      spec_description = excluded.spec_description,
      batch_id = coalesce(excluded.batch_id, t202_specialization.batch_id),
      last_updated_at = now();


-- ==========================================
-- t203: Division
-- Division within a batch (e.g. Division A, Division B)
-- ==========================================

create table if not exists public.t203_division (
  id              uuid        primary key default gen_random_uuid(),
  batch_id        uuid        not null references public.t201_batch (id) on delete cascade,
  division_code   text        not null,                  -- e.g. 'A', 'B', 'C'
  division_name   text        not null,                  -- e.g. 'Division A'
  max_strength    int         not null default 60,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),

  unique (batch_id, division_code)
);

create index if not exists idx_t203_batch    on public.t203_division (batch_id);
create index if not exists idx_t203_active   on public.t203_division (is_active);

create or replace function public.fn_t203_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t203_set_updated_at on public.t203_division;
create trigger trg_t203_set_updated_at
before update on public.t203_division
for each row execute function public.fn_t203_set_updated_at();

alter table public.t203_division enable row level security;

create policy "Authenticated users can read divisions"
  on public.t203_division for select to authenticated using (true);

create policy "Program office manages divisions"
  on public.t203_division for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ==========================================
-- t204: Faculty Profile
-- Faculty-specific data linked to t106_user_profile
-- ==========================================

create table if not exists public.t204_faculty_profile (
  id                  uuid        primary key default gen_random_uuid(),
  profile_id          uuid        unique references public.t106_user_profile (id) on delete set null,
  employee_id         text        not null unique,       -- SPJIMR employee code
  first_name          text        not null,
  last_name           text        not null,
  email               text        not null unique,
  department          text,                              -- e.g. 'Finance Area'
  designation         text,                              -- e.g. 'Associate Professor'
  is_visiting         boolean     not null default false,
  is_active           boolean     not null default true,
  joined_on           date,
  created_at          timestamptz not null default now(),
  last_updated_at     timestamptz not null default now()
);

create index if not exists idx_t204_profile    on public.t204_faculty_profile (profile_id);
create index if not exists idx_t204_active     on public.t204_faculty_profile (is_active);
create index if not exists idx_t204_department on public.t204_faculty_profile (department);

create or replace function public.fn_t204_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t204_set_updated_at on public.t204_faculty_profile;
create trigger trg_t204_set_updated_at
before update on public.t204_faculty_profile
for each row execute function public.fn_t204_set_updated_at();

alter table public.t204_faculty_profile enable row level security;

create policy "Faculty can view their own profile"
  on public.t204_faculty_profile for select using (
    profile_id in (
      select id from public.t106_user_profile where user_id = auth.uid()
    )
    or exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );

create policy "Program office manages faculty profiles"
  on public.t204_faculty_profile for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ==========================================
-- t205: Student Profile
-- Student-specific data linked to t106_user_profile
-- ==========================================

create table if not exists public.t205_student_profile (
  id                  uuid        primary key default gen_random_uuid(),
  profile_id          uuid        unique references public.t106_user_profile (id) on delete set null,
  roll_number         text        not null unique,       -- e.g. 'PGDM-2024-001'
  first_name          text        not null,
  last_name           text        not null,
  email               text        not null unique,

  batch_id            uuid        not null references public.t201_batch (id),
  division_id         uuid        not null references public.t203_division (id),
  specialization_id   uuid        references public.t202_specialization (id),

  gender              text        check (gender in ('Male', 'Female', 'Other', 'Prefer not to say')),
  date_of_birth       date,
  contact_number      text,

  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  last_updated_at     timestamptz not null default now()
);

create index if not exists idx_t205_profile     on public.t205_student_profile (profile_id);
create index if not exists idx_t205_batch       on public.t205_student_profile (batch_id);
create index if not exists idx_t205_division    on public.t205_student_profile (division_id);
create index if not exists idx_t205_spec        on public.t205_student_profile (specialization_id);
create index if not exists idx_t205_active      on public.t205_student_profile (is_active);

create or replace function public.fn_t205_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t205_set_updated_at on public.t205_student_profile;
create trigger trg_t205_set_updated_at
before update on public.t205_student_profile
for each row execute function public.fn_t205_set_updated_at();

alter table public.t205_student_profile enable row level security;

create policy "Students can view their own profile"
  on public.t205_student_profile for select using (
    profile_id in (
      select id from public.t106_user_profile where user_id = auth.uid()
    )
    or exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer', 'faculty', 'ta')
    )
  );

create policy "Program office manages student profiles"
  on public.t205_student_profile for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ==========================================
-- t206: Course
-- Course / subject catalogue
-- ==========================================

create table if not exists public.t206_course (
  id              uuid        primary key default gen_random_uuid(),
  course_code     text        not null unique,           -- e.g. 'FIN-301'
  course_name     text        not null,                  -- e.g. 'Corporate Finance'
  course_type     text        not null default 'core'
                  check (course_type in ('core', 'elective', 'audit', 'lab')),
  credits         numeric(3,1) not null default 3.0,
  total_sessions  int         not null default 30,
  description     text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create index if not exists idx_t206_active     on public.t206_course (is_active);
create index if not exists idx_t206_type       on public.t206_course (course_type);

create or replace function public.fn_t206_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t206_set_updated_at on public.t206_course;
create trigger trg_t206_set_updated_at
before update on public.t206_course
for each row execute function public.fn_t206_set_updated_at();

alter table public.t206_course enable row level security;

create policy "Authenticated users can read courses"
  on public.t206_course for select to authenticated using (true);

create policy "Program office manages courses"
  on public.t206_course for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ==========================================
-- t207: Course-Faculty Mapping
-- Which faculty (primary or secondary) teaches which course
-- ==========================================

create table if not exists public.t207_course_faculty_mapping (
  id              uuid        primary key default gen_random_uuid(),
  course_id       uuid        not null references public.t206_course (id) on delete cascade,
  faculty_id      uuid        not null references public.t204_faculty_profile (id) on delete cascade,
  role            text        not null default 'primary'
                  check (role in ('primary', 'co-instructor', 'ta', 'guest')),
  academic_year   text        not null,                  -- e.g. '2024-25', 'T1 2024-25'
  term            text,                                  -- e.g. 'Term 1', 'Term 2'
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),

  unique (course_id, faculty_id, academic_year, term)
);

create index if not exists idx_t207_course    on public.t207_course_faculty_mapping (course_id);
create index if not exists idx_t207_faculty   on public.t207_course_faculty_mapping (faculty_id);
create index if not exists idx_t207_year      on public.t207_course_faculty_mapping (academic_year);
create index if not exists idx_t207_active    on public.t207_course_faculty_mapping (is_active);

create or replace function public.fn_t207_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t207_set_updated_at on public.t207_course_faculty_mapping;
create trigger trg_t207_set_updated_at
before update on public.t207_course_faculty_mapping
for each row execute function public.fn_t207_set_updated_at();

alter table public.t207_course_faculty_mapping enable row level security;

create policy "Faculty can view their own mappings"
  on public.t207_course_faculty_mapping for select using (
    faculty_id in (
      select id from public.t204_faculty_profile fp
      join public.t106_user_profile up on up.id = fp.profile_id
      where up.user_id = auth.uid()
    )
    or exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer', 'student', 'ta')
    )
  );

create policy "Program office manages course-faculty mappings"
  on public.t207_course_faculty_mapping for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );


-- ==========================================
-- t208: Batch × Specialization × Division × Course Mapping
-- The central scheduling table: which course is taught to which
-- batch / specialization / division combination
-- ==========================================

create table if not exists public.t208_batch_spec_div_course_mapping (
  id                  uuid        primary key default gen_random_uuid(),
  batch_id            uuid        not null references public.t201_batch (id) on delete cascade,
  specialization_id   uuid        references public.t202_specialization (id) on delete set null,
                                  -- null = applicable to all specializations in this batch/div
  division_id         uuid        references public.t203_division (id) on delete set null,
                                  -- null = applicable to all divisions in this batch
  course_id           uuid        not null references public.t206_course (id) on delete cascade,
  term                text,                              -- e.g. 'Term 1', 'Term 3'
  academic_year       text        not null,              -- e.g. '2024-25'
  is_active           boolean     not null default true,
  notes               text,
  created_at          timestamptz not null default now(),
  last_updated_at     timestamptz not null default now(),

  -- A course should appear once per batch + spec + division + term combination
  unique (batch_id, specialization_id, division_id, course_id, academic_year, term)
);

create index if not exists idx_t208_batch    on public.t208_batch_spec_div_course_mapping (batch_id);
create index if not exists idx_t208_spec     on public.t208_batch_spec_div_course_mapping (specialization_id);
create index if not exists idx_t208_div      on public.t208_batch_spec_div_course_mapping (division_id);
create index if not exists idx_t208_course   on public.t208_batch_spec_div_course_mapping (course_id);
create index if not exists idx_t208_year     on public.t208_batch_spec_div_course_mapping (academic_year);
create index if not exists idx_t208_active   on public.t208_batch_spec_div_course_mapping (is_active);

create or replace function public.fn_t208_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_t208_set_updated_at on public.t208_batch_spec_div_course_mapping;
create trigger trg_t208_set_updated_at
before update on public.t208_batch_spec_div_course_mapping
for each row execute function public.fn_t208_set_updated_at();

alter table public.t208_batch_spec_div_course_mapping enable row level security;

create policy "Authenticated users can read batch-course mappings"
  on public.t208_batch_spec_div_course_mapping for select to authenticated using (true);

create policy "Program office manages batch-course mappings"
  on public.t208_batch_spec_div_course_mapping for all using (
    exists (
      select 1 from public.t106_user_profile p
      where p.user_id = auth.uid()
        and p.primary_role in ('program_office', 'developer')
    )
  );
