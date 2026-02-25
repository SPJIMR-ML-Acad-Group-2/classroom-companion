-- ============================================================
-- RLS Policies for Dashboard Tile / Role-Access Tables
-- These tables hold non-sensitive configuration data (which
-- tiles are visible to which roles). We allow anonymous read
-- access so the Dashboard can fetch tiles without relying on
-- auth.uid() being set (supports mock-auth dev mode and also
-- future public/unauthenticated landing pages).
-- ============================================================

-- t101: Application Roles  (already public-readable for role switcher)
alter table public.t101_application_roles enable row level security;
drop policy if exists "t101 public read" on public.t101_application_roles;
create policy "t101 public read"
  on public.t101_application_roles
  for select
  using (true);

-- t102: Dashboard Tiles
alter table public.t102_dashboard_tiles enable row level security;
drop policy if exists "t102 public read" on public.t102_dashboard_tiles;
create policy "t102 public read"
  on public.t102_dashboard_tiles
  for select
  using (true);

-- t103: Dashboard Subtiles
alter table public.t103_dashboard_subtiles enable row level security;
drop policy if exists "t103 public read" on public.t103_dashboard_subtiles;
create policy "t103 public read"
  on public.t103_dashboard_subtiles
  for select
  using (true);

-- t104: Role → Tile Access matrix
alter table public.t104_role_tile_access enable row level security;
drop policy if exists "t104 public read" on public.t104_role_tile_access;
create policy "t104 public read"
  on public.t104_role_tile_access
  for select
  using (true);

-- t105: Role → Subtile Access matrix
alter table public.t105_role_subtile_access enable row level security;
drop policy if exists "t105 public read" on public.t105_role_subtile_access;
create policy "t105 public read"
  on public.t105_role_subtile_access
  for select
  using (true);


-- ============================================================
-- DEV-MODE: Permissive DML policies for t2xx tables
-- The existing "Program office manages ..." policies all use
-- auth.uid() → t106_user_profile lookups, which fail when
-- mock auth is active (auth.uid() = null).
-- These "anon bypass" policies allow all DML from any role
-- (authenticated OR anon) so development can proceed before
-- real Supabase Auth is wired up.
-- ⚠ Remove or tighten these before going to production.
-- ============================================================

-- t201: Batch
drop policy if exists "dev allow all on t201" on public.t201_batch;
create policy "dev allow all on t201"
  on public.t201_batch
  for all
  using (true)
  with check (true);

-- t202: Specialization
drop policy if exists "dev allow all on t202" on public.t202_specialization;
create policy "dev allow all on t202"
  on public.t202_specialization
  for all
  using (true)
  with check (true);

-- t203: Division
drop policy if exists "dev allow all on t203" on public.t203_division;
create policy "dev allow all on t203"
  on public.t203_division
  for all
  using (true)
  with check (true);

-- t204: Faculty Profile
drop policy if exists "dev allow all on t204" on public.t204_faculty_profile;
create policy "dev allow all on t204"
  on public.t204_faculty_profile
  for all
  using (true)
  with check (true);

-- t205: Student Profile
drop policy if exists "dev allow all on t205" on public.t205_student_profile;
create policy "dev allow all on t205"
  on public.t205_student_profile
  for all
  using (true)
  with check (true);

-- t206: Course
drop policy if exists "dev allow all on t206" on public.t206_course;
create policy "dev allow all on t206"
  on public.t206_course
  for all
  using (true)
  with check (true);

-- t207: Course-Faculty Mapping
drop policy if exists "dev allow all on t207" on public.t207_course_faculty_mapping;
create policy "dev allow all on t207"
  on public.t207_course_faculty_mapping
  for all
  using (true)
  with check (true);

-- t208: Batch × Spec × Division × Course Mapping
drop policy if exists "dev allow all on t208" on public.t208_batch_spec_div_course_mapping;
create policy "dev allow all on t208"
  on public.t208_batch_spec_div_course_mapping
  for all
  using (true)
  with check (true);

