-- ============================================================
-- Full Tile & Subtile Seed: t102, t103, t104, t105
-- Run in Supabase SQL Editor after the base schema migration
-- ============================================================


-- ============================================================
-- 1. t102: ALL DASHBOARD TILES
-- Every top-level module that can appear on any role's dashboard
-- ============================================================

insert into public.t102_dashboard_tiles
  (tile_key, tile_label, tile_description, route_path, icon_key, sort_order, is_enabled)
values
  -- ── Access & Onboarding ──────────────────────────────────
  ('request_access',   'Request Access',    'Submit a request to be assigned a role',                    '/request-access',  'lock',            10,  true),
  ('request_history',  'Request History',   'View the status of your previous access requests',           '/request-history', 'clock',           20,  true),

  -- ── Academic Administration (Program Office) ─────────────
  ('manage_batch',     'Manage Batch',      'View and manage academic batches and cohorts',               '/managebatch',     'graduation-cap',  30,  true),
  ('onboard_batch',    'Onboard Batch',     'Create a new batch and enrol students into the programme',   '/onboardbatch',    'user-plus',       31,  true),
  ('manage_courses',   'Manage Courses',    'Configure courses, syllabi, and academic schedules',         '/courses',         'book-open',       40,  true),
  ('manage_faculty',   'Manage Faculty',    'Onboard and manage faculty and teaching assistants',         '/faculty',         'users',           50,  true),
  ('manage_students',  'Manage Students',   'View and manage student profiles across batches',            '/students',        'user-check',      60,  true),

  -- ── Attendance ───────────────────────────────────────────
  ('attendance_hub',   'Attendance Hub',    'Upload, view, and manage session attendance records',        '/attendance',      'bar-chart-3',     70,  true),

  -- ── Academic Groups, Timetable & Exams ───────────────────
  ('acad_groups',      'Academic Groups',   'Manage elective groups, study circles and cohort clusters',  '/acad-groups',     'layout-grid',     80,  true),
  ('timetable',        'Timetable',         'View and publish term timetables',                           '/timetable',       'calendar',        90,  true),
  ('exam_schedule',    'Exam Schedule',     'Configure and publish exam schedules',                       '/exams',           'file-text',       100, true),

  -- ── Reports & Analytics ──────────────────────────────────
  ('reports',          'Reports',           'Generate academic, attendance, and performance reports',     '/reports',         'bar-chart-3',     110, true),

  -- ── Sodexo / Mess Office ─────────────────────────────────
  ('meal_attendance',  'Meal Attendance',   'Track and manage student meal attendance',                   '/meal-attendance', 'utensils',        120, true),

  -- ── System Administration (Developer / Admin only) ───────
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


-- ============================================================
-- 2. t103: ALL DASHBOARD SUBTILES
-- Actions/sub-pages beneath each tile, used to gate fine-grained access
-- ============================================================

insert into public.t103_dashboard_subtiles
  (tile_id, subtile_key, subtile_label, subtile_description, route_path, icon_key, sort_order, is_enabled)
select t.id, v.subtile_key, v.subtile_label, v.subtile_description, v.route_path, v.icon_key, v.sort_order, true
from public.t102_dashboard_tiles t
join (values

  -- manage_batch subtiles
  ('manage_batch', 'manage_divisions',     'Manage Divisions',   'Create and configure divisions within a batch',     '/managebatch/divisions',       'layout-grid',     20),
  ('manage_batch', 'manage_students',      'Manage Students',    'Onboard and manage students within a batch',        '/managebatch/students',        'users',           30),
  ('manage_batch', 'manage_acad_groups',   'Manage Acad Groups', 'Configure academic groups, electives and circles',  '/managebatch/acad-groups',     'book-open',       40),

  -- manage_courses subtiles
  ('manage_courses', 'create_course',      'Create Course',      'Add a new course to the course catalogue',          '/courses/create',          'plus',            10),
  ('manage_courses', 'assign_faculty',     'Assign Faculty',     'Map faculty members to courses',                    '/courses/assign-faculty',  'users',           20),
  ('manage_courses', 'course_schedule',    'Course Schedule',    'Set up the course delivery schedule',               '/courses/schedule',        'calendar',        30),

  -- manage_faculty subtiles
  ('manage_faculty', 'onboard_faculty',    'Onboard Faculty',    'Add new faculty and visiting faculty profiles',     '/faculty/onboard',         'user-plus',       10),
  ('manage_faculty', 'faculty_list',       'Faculty List',       'View and edit all faculty profiles',                '/faculty/list',            'users',           20),

  -- manage_students subtiles
  ('manage_students', 'student_list',      'Student List',       'Browse all student profiles across batches',        '/students/list',           'users',           10),
  ('manage_students', 'import_students',   'Import Students',    'Bulk import students via Excel upload',             '/students/import',         'upload',          20),

  -- attendance_hub subtiles
  ('attendance_hub', 'upload_attendance',  'Upload Attendance',  'Upload session attendance from Excel',              '/attendance/upload',       'upload',          10),
  ('attendance_hub', 'view_attendance',    'View Attendance',    'Browse and filter attendance records',              '/attendance/view',         'bar-chart-3',     20),
  ('attendance_hub', 'attendance_reports', 'Attendance Reports', 'Generate student and session attendance reports',   '/attendance/reports',      'file-text',       30),

  -- acad_groups subtiles
  ('acad_groups', 'create_group',          'Create Group',       'Create a new academic or elective group',           '/acad-groups/create',      'plus',            10),
  ('acad_groups', 'assign_students',       'Assign Students',    'Assign students to academic groups',                '/acad-groups/assign',      'user-check',      20),

  -- timetable subtiles
  ('timetable', 'publish_timetable',       'Publish Timetable',  'Publish the term timetable for students/faculty',   '/timetable/publish',       'calendar',        10),
  ('timetable', 'view_timetable',          'View Timetable',     'View the current published timetable',              '/timetable/view',          'calendar',        20),

  -- exam_schedule subtiles
  ('exam_schedule', 'create_exam',         'Create Exam',        'Add a new exam or assessment event',                '/exams/create',            'plus',            10),
  ('exam_schedule', 'view_exams',          'View Exams',         'View all scheduled exams and assessments',          '/exams/view',              'file-text',       20),

  -- reports subtiles
  ('reports', 'attendance_report',         'Attendance Report',  'Full attendance analytics by batch, course or div', '/reports/attendance',      'bar-chart-3',     10),
  ('reports', 'performance_report',        'Performance Report', 'Academic performance reports by student or batch',  '/reports/performance',     'bar-chart-3',     20),

  -- meal_attendance subtiles
  ('meal_attendance', 'upload_meal',       'Upload Meal Data',   'Upload daily meal attendance records',              '/meal-attendance/upload',  'upload',          10),
  ('meal_attendance', 'view_meal',         'View Meal Records',  'Browse meal attendance history',                    '/meal-attendance/view',    'bar-chart-3',     20),

  -- system_settings subtiles
  ('system_settings', 'role_config',       'Role Config',        'Manage application roles and permissions',          '/settings/roles',          'shield',          10),
  ('system_settings', 'tile_config',       'Tile Config',        'Configure dashboard tiles and subtiles',            '/settings/tiles',          'layout-grid',     20),
  ('system_settings', 'email_config',      'Email Config',       'Manage email templates and notification settings',  '/settings/email',          'file-text',       30),

  -- user_management subtiles
  ('user_management', 'approve_requests',  'Approve Requests',   'Review and act on pending role access requests',    '/users/approve',           'shield-check',    10),
  ('user_management', 'all_users',         'All Users',          'View and edit all user profiles',                   '/users/all',               'users',           20),

  -- audit_logs subtiles
  ('audit_logs', 'view_logs',              'View Logs',          'Browse all system and API audit logs',              '/audit/logs',              'file-text',       10)

) as v(tile_key, subtile_key, subtile_label, subtile_description, route_path, icon_key, sort_order)
  on t.tile_key = v.tile_key
on conflict (tile_id, subtile_key) do update
  set subtile_label       = excluded.subtile_label,
      subtile_description = excluded.subtile_description,
      route_path          = excluded.route_path,
      icon_key            = excluded.icon_key,
      sort_order          = excluded.sort_order,
      is_enabled          = excluded.is_enabled,
      last_updated_at     = now();


-- ============================================================
-- 3. t104: ROLE → TILE ACCESS MATRIX
-- Which tiles each role can see on their dashboard
-- ============================================================

insert into public.t104_role_tile_access
  (role_code, tile_id, tile_key, tile_label, can_view, all_subtiles)
select
  v.role_code::public.t101_role_enum,
  t.id,
  t.tile_key,
  t.tile_label,
  true,
  v.all_subtiles
from public.t102_dashboard_tiles t
join (values
  -- user: only access request flow
  ('user',           'request_access',   false),
  ('user',           'request_history',  false),

  -- student: access request + personal timetable/exam views
  ('student',        'request_access',   false),
  ('student',        'request_history',  false),
  ('student',        'timetable',        false),
  ('student',        'exam_schedule',    false),

  -- faculty: timetable + attendance upload for their sessions
  ('faculty',        'request_access',   false),
  ('faculty',        'request_history',  false),
  ('faculty',        'timetable',        false),
  ('faculty',        'attendance_hub',   false),

  -- ta (teaching assistant): attendance + student view
  ('ta',             'request_access',   false),
  ('ta',             'request_history',  false),
  ('ta',             'attendance_hub',   false),

  -- program_office: everything academic
  ('program_office', 'manage_batch',     true),
  ('program_office', 'manage_courses',   true),
  ('program_office', 'manage_faculty',   true),
  ('program_office', 'manage_students',  true),
  ('program_office', 'attendance_hub',   true),
  ('program_office', 'acad_groups',      true),
  ('program_office', 'timetable',        true),
  ('program_office', 'exam_schedule',    true),
  ('program_office', 'reports',          true),

  -- exam_office: exam schedule + attendance + reports
  ('exam_office',    'exam_schedule',    true),
  ('exam_office',    'attendance_hub',   false),
  ('exam_office',    'reports',          false),

  -- sodoxo_office: only meal attendance
  ('sodoxo_office',  'meal_attendance',  true),

  -- developer: everything
  ('developer',      'request_access',   true),
  ('developer',      'request_history',  true),
  ('developer',      'manage_batch',     true),
  ('developer',      'manage_courses',   true),
  ('developer',      'manage_faculty',   true),
  ('developer',      'manage_students',  true),
  ('developer',      'attendance_hub',   true),
  ('developer',      'acad_groups',      true),
  ('developer',      'timetable',        true),
  ('developer',      'exam_schedule',    true),
  ('developer',      'reports',          true),
  ('developer',      'meal_attendance',  true),
  ('developer',      'system_settings',  true),
  ('developer',      'user_management',  true),
  ('developer',      'audit_logs',       true)

) as v(role_code, tile_key, all_subtiles)
  on t.tile_key = v.tile_key
on conflict (role_code, tile_id) do update
  set can_view        = excluded.can_view,
      all_subtiles    = excluded.all_subtiles,
      tile_key        = excluded.tile_key,
      tile_label      = excluded.tile_label,
      last_updated_at = now();


-- ============================================================
-- 4. t105: ROLE → SUBTILE ACCESS MATRIX
-- Fine-grained access: which subtile actions each role can perform
-- ============================================================

insert into public.t105_role_subtile_access
  (role_code, subtile_id, subtile_key, subtile_label, tile_id, tile_key, tile_label, can_view)
select
  v.role_code::public.t101_role_enum,
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

  -- ── manage_batch subtiles ───────────────────────────────
  ('program_office',  'manage_batch', 'create_batch'),
  ('program_office',  'manage_batch', 'manage_divisions'),
  ('program_office',  'manage_batch', 'manage_students'),
  ('program_office',  'manage_batch', 'manage_acad_groups'),

  ('developer',       'manage_batch', 'create_batch'),
  ('developer',       'manage_batch', 'manage_divisions'),
  ('developer',       'manage_batch', 'manage_students'),
  ('developer',       'manage_batch', 'manage_acad_groups'),

  -- ── manage_courses subtiles ─────────────────────────────
  ('program_office',  'manage_courses', 'create_course'),
  ('program_office',  'manage_courses', 'assign_faculty'),
  ('program_office',  'manage_courses', 'course_schedule'),

  ('developer',       'manage_courses', 'create_course'),
  ('developer',       'manage_courses', 'assign_faculty'),
  ('developer',       'manage_courses', 'course_schedule'),

  -- ── manage_faculty subtiles ─────────────────────────────
  ('program_office',  'manage_faculty', 'onboard_faculty'),
  ('program_office',  'manage_faculty', 'faculty_list'),

  ('developer',       'manage_faculty', 'onboard_faculty'),
  ('developer',       'manage_faculty', 'faculty_list'),

  -- ── manage_students subtiles ────────────────────────────
  ('program_office',  'manage_students', 'student_list'),
  ('program_office',  'manage_students', 'import_students'),

  ('developer',       'manage_students', 'student_list'),
  ('developer',       'manage_students', 'import_students'),

  -- ── attendance_hub subtiles ─────────────────────────────
  ('program_office',  'attendance_hub', 'upload_attendance'),
  ('program_office',  'attendance_hub', 'view_attendance'),
  ('program_office',  'attendance_hub', 'attendance_reports'),

  ('faculty',         'attendance_hub', 'upload_attendance'),
  ('faculty',         'attendance_hub', 'view_attendance'),

  ('ta',              'attendance_hub', 'upload_attendance'),
  ('ta',              'attendance_hub', 'view_attendance'),

  ('exam_office',     'attendance_hub', 'view_attendance'),
  ('exam_office',     'attendance_hub', 'attendance_reports'),

  ('developer',       'attendance_hub', 'upload_attendance'),
  ('developer',       'attendance_hub', 'view_attendance'),
  ('developer',       'attendance_hub', 'attendance_reports'),

  -- ── acad_groups subtiles ────────────────────────────────
  ('program_office',  'acad_groups', 'create_group'),
  ('program_office',  'acad_groups', 'assign_students'),

  ('developer',       'acad_groups', 'create_group'),
  ('developer',       'acad_groups', 'assign_students'),

  -- ── timetable subtiles ──────────────────────────────────
  ('program_office',  'timetable', 'publish_timetable'),
  ('program_office',  'timetable', 'view_timetable'),

  ('student',         'timetable', 'view_timetable'),
  ('faculty',         'timetable', 'view_timetable'),

  ('developer',       'timetable', 'publish_timetable'),
  ('developer',       'timetable', 'view_timetable'),

  -- ── exam_schedule subtiles ──────────────────────────────
  ('program_office',  'exam_schedule', 'create_exam'),
  ('program_office',  'exam_schedule', 'view_exams'),

  ('exam_office',     'exam_schedule', 'create_exam'),
  ('exam_office',     'exam_schedule', 'view_exams'),

  ('student',         'exam_schedule', 'view_exams'),
  ('faculty',         'exam_schedule', 'view_exams'),

  ('developer',       'exam_schedule', 'create_exam'),
  ('developer',       'exam_schedule', 'view_exams'),

  -- ── reports subtiles ────────────────────────────────────
  ('program_office',  'reports', 'attendance_report'),
  ('program_office',  'reports', 'performance_report'),

  ('exam_office',     'reports', 'attendance_report'),

  ('developer',       'reports', 'attendance_report'),
  ('developer',       'reports', 'performance_report'),

  -- ── meal_attendance subtiles ────────────────────────────
  ('sodoxo_office',   'meal_attendance', 'upload_meal'),
  ('sodoxo_office',   'meal_attendance', 'view_meal'),

  ('developer',       'meal_attendance', 'upload_meal'),
  ('developer',       'meal_attendance', 'view_meal'),

  -- ── system_settings subtiles ────────────────────────────
  ('developer',       'system_settings', 'role_config'),
  ('developer',       'system_settings', 'tile_config'),
  ('developer',       'system_settings', 'email_config'),

  -- ── user_management subtiles ────────────────────────────
  ('program_office',  'user_management', 'approve_requests'),
  ('developer',       'user_management', 'approve_requests'),
  ('developer',       'user_management', 'all_users'),

  -- ── audit_logs subtiles ─────────────────────────────────
  ('developer',       'audit_logs', 'view_logs')

) as v(role_code, tile_key, subtile_key)
  on t.tile_key = v.tile_key
  and s.subtile_key = v.subtile_key
on conflict (role_code, subtile_id) do update
  set can_view        = excluded.can_view,
      subtile_key     = excluded.subtile_key,
      subtile_label   = excluded.subtile_label,
      tile_id         = excluded.tile_id,
      tile_key        = excluded.tile_key,
      tile_label      = excluded.tile_label,
      last_updated_at = now();


-- ============================================================
-- Verify
-- ============================================================
select tile_key, tile_label, route_path, sort_order from public.t102_dashboard_tiles order by sort_order;
select role_code, tile_key, can_view, all_subtiles from public.t104_role_tile_access order by role_code, tile_key;
