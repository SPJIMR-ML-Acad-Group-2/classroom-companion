-- ============================================================
-- Rename "Onboard Batch" → "Manage Batch" in t102 + t104
-- Also add tile_key alias 'manage_batch' for t105 joins
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Update tile label in t102
update public.t102_dashboard_tiles
set
  tile_label       = 'Manage Batch',
  tile_description = 'View and manage academic batches'
where tile_key = 'onboard_batch';

-- 2. Sync the denormalised tile_label column in t104
update public.t104_role_tile_access
set tile_label = 'Manage Batch'
where tile_key = 'onboard_batch';

-- 3. (Optional) If you want to also rename the key itself:
--    Skip this block if you prefer keeping tile_key = 'onboard_batch'
--    and just want the display label changed.
--
-- update public.t102_dashboard_tiles set tile_key = 'manage_batch' where tile_key = 'onboard_batch';
-- update public.t104_role_tile_access set tile_key = 'manage_batch' where tile_key = 'onboard_batch';
-- update public.t103_dashboard_subtiles set tile_key = 'manage_batch' where tile_key = 'onboard_batch';
-- update public.t105_role_subtile_access set tile_key = 'manage_batch' where tile_key = 'onboard_batch';
