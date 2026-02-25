-- RESTORE ONBOARD BATCH TILE
-- This script restores 'onboard_batch' as a separate functionality from 'manage_batch'.

-- 1. Restore the tile in t102
insert into public.t102_dashboard_tiles 
  (tile_key, tile_label, tile_description, route_path, icon_key, sort_order, is_enabled)
values 
  ('onboard_batch', 'Onboard Batch', 'Create new batches and perform initial student onboarding', '/onboard-batch', 'users', 10, true)
on conflict (tile_key) do update 
set 
  tile_label = excluded.tile_label,
  tile_description = excluded.tile_description,
  route_path = excluded.route_path,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  is_enabled = excluded.is_enabled;

-- 2. Grant role access in t104
-- Program Office and Developer should see this.
insert into public.t104_role_tile_access (role_code, tile_id, tile_key, tile_label, can_view, all_subtiles)
select 
  r.role_code,
  t.id,
  t.tile_key,
  t.tile_label,
  true,
  true -- Onboarding usually needs all subtiles related to it
from public.t102_dashboard_tiles t
join public.t101_application_roles r on r.role_code in ('program_office', 'developer')
where t.tile_key = 'onboard_batch'
on conflict (role_code, tile_id) do update set can_view = true, all_subtiles = true;

-- 3. Ensure manage_batch still exists and is correctly labeled
update public.t102_dashboard_tiles 
set tile_label = 'Manage Batch', sort_order = 30
where tile_key = 'manage_batch';
