import { supabase } from "@/integrations/supabase/client";

export interface SubtileAccess {
  subtile_key: string;
  subtile_label: string;
  subtile_description: string | null;
  route_path: string | null;
  icon_key: string | null;
}

interface RoleTileAccessRow {
  all_subtiles?: boolean;
  tile_id?: string | number;
}

interface RoleSubtileAccessRow {
  t103_dashboard_subtiles?: {
    subtile_key: string;
    subtile_label: string;
    subtile_description: string | null;
    route_path: string | null;
    icon_key: string | null;
    is_enabled: boolean;
  } | {
    subtile_key: string;
    subtile_label: string;
    subtile_description: string | null;
    route_path: string | null;
    icon_key: string | null;
    is_enabled: boolean;
  }[];
}

export function normalizeRoleCode(role: string | null | undefined): string {
  return (role ?? "user").toLowerCase();
}

export async function hasTileAccess(roleCode: string, tileKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("t104_role_tile_access")
    .select("id")
    .eq("role_code", roleCode)
    .eq("tile_key", tileKey)
    .eq("can_view", true)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function hasSubtileAccess(roleCode: string, tileKey: string, subtileKey: string): Promise<boolean> {
  const { data: tileAccess } = await supabase
    .from("t104_role_tile_access")
    .select("all_subtiles")
    .eq("role_code", roleCode)
    .eq("tile_key", tileKey)
    .eq("can_view", true)
    .maybeSingle();

  if (tileAccess && (tileAccess as RoleTileAccessRow).all_subtiles) {
    return true;
  }

  const { data, error } = await supabase
    .from("t105_role_subtile_access")
    .select("id")
    .eq("role_code", roleCode)
    .eq("tile_key", tileKey)
    .eq("subtile_key", subtileKey)
    .eq("can_view", true)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function fetchAllowedSubtiles(roleCode: string, tileKey: string): Promise<SubtileAccess[]> {
  const { data: tileAccess } = await supabase
    .from("t104_role_tile_access")
    .select("all_subtiles,tile_id")
    .eq("role_code", roleCode)
    .eq("tile_key", tileKey)
    .eq("can_view", true)
    .maybeSingle();

  if (!tileAccess) return [];

  if ((tileAccess as RoleTileAccessRow).all_subtiles) {
    const { data } = await supabase
      .from("t103_dashboard_subtiles")
      .select("subtile_key,subtile_label,subtile_description,route_path,icon_key")
      .eq("tile_id", (tileAccess as RoleTileAccessRow).tile_id as string | number)
      .eq("is_enabled", true)
      .order("sort_order");

    return (data ?? []) as SubtileAccess[];
  }

  const { data } = await supabase
    .from("t105_role_subtile_access")
    .select(`
      subtile_key,
      t103_dashboard_subtiles!inner(
        subtile_key,
        subtile_label,
        subtile_description,
        route_path,
        icon_key,
        is_enabled
      )
    `)
    .eq("role_code", roleCode)
    .eq("tile_key", tileKey)
    .eq("can_view", true);

  return ((data as unknown as RoleSubtileAccessRow[]) ?? [])
    .map((r) => {
      const sub = Array.isArray(r.t103_dashboard_subtiles)
        ? r.t103_dashboard_subtiles[0]
        : r.t103_dashboard_subtiles;
      return sub;
    })
    .filter((sub): sub is NonNullable<typeof sub> & { is_enabled: boolean } => !!sub && !!(sub as any).is_enabled)
    .map((sub: any) => ({
      subtile_key: sub.subtile_key,
      subtile_label: sub.subtile_label,
      subtile_description: sub.subtile_description,
      route_path: sub.route_path,
      icon_key: sub.icon_key,
    }));
}
