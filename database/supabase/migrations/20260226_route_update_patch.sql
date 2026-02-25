-- ============================================================
-- Route Update Patch — Run in Supabase SQL Editor
-- ============================================================

-- 1. Update manage_batch tile route
update public.t102_dashboard_tiles
set route_path = '/managebatch', last_updated_at = now()
where tile_key = 'manage_batch';

-- 2. Upsert onboard_batch tile
insert into public.t102_dashboard_tiles
  (tile_key, tile_label, tile_description, route_path, icon_key, sort_order, is_enabled)
values
  ('onboard_batch', 'Onboard Batch', 'Create a new batch and enrol students into the programme', '/onboardbatch', 'user-plus', 31, true)
on conflict (tile_key) do update
  set route_path       = excluded.route_path,
      tile_label       = excluded.tile_label,
      tile_description = excluded.tile_description,
      icon_key         = excluded.icon_key,
      sort_order       = excluded.sort_order,
      is_enabled       = excluded.is_enabled,
      last_updated_at  = now();

-- 3. Remove obsolete create_batch subtile
delete from public.t103_dashboard_subtiles where subtile_key = 'create_batch';

-- 4. Upsert all manage_batch subtiles (INSERT + UPDATE so it works whether rows exist or not)
insert into public.t103_dashboard_subtiles
  (tile_id, tile_key, subtile_key, subtile_label, subtile_description, route_path, icon_key, sort_order, is_enabled)
select
  t.id,
  'manage_batch',
  v.subtile_key,
  v.subtile_label,
  v.subtile_description,
  v.route_path,
  v.icon_key,
  v.sort_order,
  true
from public.t102_dashboard_tiles t
cross join (values
  ('manage_students',   'Manage Students',        'View and manage enrolled students',                '/managebatch/students',           'users',  10),
  ('manage_divisions',  'Manage Divisions',        'Create and manage batch divisions',                '/managebatch/manage-divisions',    'layout', 20),
  ('manage_acad_groups','Manage Academic Groups',  'Create and assign students to academic groups',    '/managebatch/manage-acad-groups',  'grid',   30)
) as v(subtile_key, subtile_label, subtile_description, route_path, icon_key, sort_order)
where t.tile_key = 'manage_batch'
on conflict (subtile_key) do update
  set tile_id             = excluded.tile_id,
      tile_key            = excluded.tile_key,
      subtile_label       = excluded.subtile_label,
      subtile_description = excluded.subtile_description,
      route_path          = excluded.route_path,
      icon_key            = excluded.icon_key,
      sort_order          = excluded.sort_order,
      is_enabled          = true,
      last_updated_at     = now();

-- 5. Grant program_office and developer access to onboard_batch tile
insert into public.t104_role_tile_access
  (role_code, tile_id, tile_key, tile_label, can_view, all_subtiles)
select
  v.role_code::public.t101_role_enum,
  t.id,
  t.tile_key,
  t.tile_label,
  true,
  true
from public.t102_dashboard_tiles t
cross join (values
  ('program_office'::text),
  ('developer'::text)
) as v(role_code)
where t.tile_key = 'onboard_batch'
on conflict (role_code, tile_key) do update
  set can_view        = true,
      all_subtiles    = true,
      last_updated_at = now();

-- 6. Grant program_office and developer access to all manage_batch subtiles
insert into public.t105_role_subtile_access
  (role_code, subtile_id, subtile_key, subtile_label, can_view)
select
  r.role_code::public.t101_role_enum,
  s.id,
  s.subtile_key,
  s.subtile_label,
  true
from public.t103_dashboard_subtiles s
cross join (values
  ('program_office'::text),
  ('developer'::text)
) as r(role_code)
where s.tile_key = 'manage_batch'
  and s.subtile_key in ('manage_students', 'manage_divisions', 'manage_acad_groups')
on conflict (role_code, subtile_key) do update
  set can_view        = true,
      last_updated_at = now();

-- 7. Ensure t203_division table exists
create table if not exists public.t203_division (
  id              uuid        primary key default gen_random_uuid(),
  batch_id        uuid        not null references public.t201_batch(batch_id) on delete cascade,
  division_code   text        not null,
  division_name   text        not null,
  max_strength    integer     not null default 60,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  unique (batch_id, division_code)
);

alter table public.t203_division enable row level security;
drop policy if exists "Authenticated full t203" on public.t203_division;
create policy "Authenticated full t203"
  on public.t203_division
  for all to authenticated using (true) with check (true);

-- 8. Fix t202_specialization batch_id linkage
-- The original migration FK referenced t201_batch(id) which doesn't exist;
-- t201_batch uses batch_id as PK. Patch the seeded rows to link to the latest batch.
update public.t202_specialization
set batch_id = (
  select batch_id from public.t201_batch order by created_at desc limit 1
)
where batch_id is null;

-- 9. Verify
select tile_key, route_path from public.t102_dashboard_tiles
where tile_key in ('manage_batch', 'onboard_batch')
order by sort_order;

select subtile_key, route_path, is_enabled
from public.t103_dashboard_subtiles
where tile_key = 'manage_batch'
order by sort_order;

select spec_code, spec_name, batch_id from public.t202_specialization;
