-- ============================================================
-- MASTER DASHBOARD SEED: t102, t103, t104, t105
-- Consolidates all tiles, subtiles, and role access matrix.
-- Safe to re-run multiple times (truncate + re-insert).
-- ============================================================

-- Step 1: Clear old metadata (keeping t102 as base)
truncate table public.t105_role_subtile_access restart identity cascade;
truncate table public.t104_role_tile_access restart identity cascade;
truncate table public.t103_dashboard_subtiles restart identity cascade;

-- Step 2: Seed t102 (DASHBOARD TILES)
insert into public.t102_dashboard_tiles
  (tile_key, tile_label, tile_description, route_path, icon_key, sort_order, is_enabled)
values
  ('request_access',   'Request Access',    'Submit a request to be assigned a role',                    '/request-access',  'lock',            10,  true),
  ('request_history',  'Request History',   'View the status of your previous access requests',           '/request-history', 'clock',           20,  true),
  ('manage_batch',     'Manage Batch',      'View and manage academic batches and cohorts',               '/batches',         'graduation-cap',  30,  true),
  ('manage_courses',   'Manage Courses',    'Configure courses, syllabi, and academic schedules',         '/courses',         'book-open',       40,  true),
  ('manage_faculty',   'Manage Faculty',    'Onboard and manage faculty and teaching assistants',         '/faculty',         'users',           50,  true),
  ('manage_students',  'Manage Students',   'View and manage student profiles across batches',            '/students',        'user-check',      60,  true),
  ('attendance_hub',   'Attendance Hub',    'Upload, view, and manage session attendance records',        '/attendance',      'bar-chart-3',     70,  true),
  ('acad_groups',      'Academic Groups',   'Manage elective groups, study circles and cohort clusters',  '/acad-groups',     'layout-grid',     80,  true),
  ('timetable',        'Timetable',         'View and publish term timetables',                           '/timetable',       'calendar',        90,  true),
  ('exam_schedule',    'Exam Schedule',     'Configure and publish exam schedules',                       '/exams',           'file-text',       100, true),
  ('reports',          'Reports',           'Generate academic, attendance, and performance reports',     '/reports',         'bar-chart-3',     110, true),
  ('meal_attendance',  'Meal Attendance',   'Track and manage student meal attendance',                   '/meal-attendance', 'utensils',        120, true),
  ('system_settings',  'System Settings',  'Manage platform configuration and system parameters',        '/settings',        'settings',        200, true),
  ('user_management',  'User Management',  'View all users, manage roles and access approvals',          '/users',           'shield',          210, true),
  ('audit_logs',       'Audit Logs',       'View system audit logs and user activity',                   '/audit',           'file-text',       220, true)
on conflict (tile_key) do update
  set tile_label       = excluded.tile_label,
      tile_description = excluded.tile_description,
      route_path       = excluded.route_path,
      icon_key         = excluded.icon_key,
      sort_order       = excluded.sort_order,
      is_enabled       = excluded.is_enabled,
      last_updated_at  = now();

-- Step 3: Seed t103 (DASHBOARD SUBTILES)
insert into public.t103_dashboard_subtiles
  (tile_id, subtile_key, subtile_label, subtile_description, route_path, icon_key, sort_order, is_enabled)
select t.id, v.subtile_key, v.subtile_label, v.subtile_description, v.route_path, v.icon_key, v.sort_order, true
from public.t102_dashboard_tiles t
join (values
  ('manage_batch', 'create_batch',         'Create Batch',       'Create a new academic batch or cohort',             '/batches/create',          'plus',            10),
  ('manage_batch', 'manage_divisions',     'Manage Divisions',   'Create and configure divisions within a batch',     '/batches/divisions',       'layout-grid',     20),
  ('manage_batch', 'manage_students',      'Manage Students',    'Onboard and manage students within a batch',        '/batches/students',        'users',           30),
  ('manage_batch', 'manage_acad_groups',   'Manage Acad Groups', 'Configure academic groups, electives and circles',  '/batches/acad-groups',     'book-open',       40),
  ('manage_courses', 'create_course',      'Create Course',      'Add a new course to the course catalogue',          '/courses/create',          'plus',            10),
  ('attendance_hub', 'upload_attendance',  'Upload Attendance',  'Upload session attendance from Excel',              '/attendance/upload',       'upload',          10),
  ('attendance_hub', 'view_attendance',    'View Attendance',    'Browse and filter attendance records',              '/attendance/view',         'bar-chart-3',     20),
  ('user_management', 'approve_requests',  'Approve Requests',   'Review and act on pending role access requests',    '/users/approve',           'shield-check',    10)
) as v(tile_key, subtile_key, subtile_label, subtile_description, route_path, icon_key, sort_order)
  on t.tile_key = v.tile_key;

-- Step 4: Seed t104 (ROLE → TILE ACCESS)
-- Using join on t101 to avoid enum cast issues
insert into public.t104_role_tile_access
  (role_code, tile_id, tile_key, tile_label, can_view, all_subtiles)
select
  r.role_code,
  t.id,
  t.tile_key,
  t.tile_label,
  true,
  v.all_subtiles
from public.t102_dashboard_tiles t
join (values
  ('user',           'request_access',   false),
  ('user',           'request_history',  false),
  ('student',        'request_access',   false),
  ('student',        'request_history',  false),
  ('student',        'timetable',        false),
  ('student',        'exam_schedule',    false),
  ('faculty',        'request_access',   false),
  ('faculty',        'request_history',  false),
  ('faculty',        'timetable',        false),
  ('faculty',        'attendance_hub',   false),
  ('program_office', 'manage_batch',     true),
  ('program_office', 'manage_courses',   true),
  ('program_office', 'manage_faculty',   true),
  ('program_office', 'manage_students',  true),
  ('program_office', 'attendance_hub',   true),
  ('program_office', 'timetable',        true),
  ('program_office', 'exam_schedule',    true),
  ('sodoxo_office',  'meal_attendance',  true),
  ('sodoxo_office',  'timetable',        false),
  ('sodoxo_office',  'exam_schedule',    false),
  ('developer',      'manage_batch',     true),
  ('developer',      'manage_courses',   true),
  ('developer',      'attendance_hub',   true),
  ('developer',      'system_settings',  true),
  ('developer',      'user_management',  true)
) as v(role_code_text, tile_key, all_subtiles)
  on t.tile_key = v.tile_key
join public.t101_application_roles r
  on r.role_code::text = v.role_code_text;

-- Step 5: Seed t105 (ROLE → SUBTILE ACCESS)
insert into public.t105_role_subtile_access
  (role_code, subtile_id, subtile_key, subtile_label, tile_id, tile_key, tile_label, can_view)
select
  r.role_code,
  s.id,
  s.subtile_key,
  s.subtile_label,
  t.id,
  t.tile_key,
  t.tile_label,
  true
from public.t103_dashboard_subtiles s
join public.t102_dashboard_tiles t on t.id = s.tile_id
join (values
  ('program_office',  'manage_batch', 'create_batch'),
  ('program_office',  'manage_batch', 'manage_students'),
  ('faculty',         'attendance_hub', 'upload_attendance'),
  ('sodoxo_office',   'timetable', 'view_timetable') -- example mapping
) as v(role_code_text, tile_key, subtile_key)
  on t.tile_key = v.tile_key
  and s.subtile_key = v.subtile_key
join public.t101_application_roles r
  on r.role_code::text = v.role_code_text;
