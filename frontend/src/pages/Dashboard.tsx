import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  LogOut,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  ShieldCheck,
  ArrowRight,
  Clock,
  Lock,
  FileText,
  Building,
  Plus,
  Loader2,
  LayoutGrid,
  Calendar,
  Utensils,
  UserCheck,
  Upload,
  UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

type AppRole = string;

// ── Icon registry matching t102.icon_key values ──────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  "book-open": BookOpen,
  "bar-chart-3": BarChart3,
  settings: Settings,
  lock: Lock,
  shield: ShieldCheck,
  "shield-check": ShieldCheck,
  "file-text": FileText,
  building: Building,
  plus: Plus,
  clock: Clock,
  "graduation-cap": GraduationCap,
  "layout-grid": LayoutGrid,
  calendar: Calendar,
  utensils: Utensils,
  "user-check": UserCheck,
  upload: Upload,
  "user-plus": UserPlus,
};

function resolveIcon(iconKey: string | null): React.ElementType {
  if (!iconKey) return ArrowRight;
  return ICON_MAP[iconKey] ?? ArrowRight;
}

interface DashboardTile {
  tile_key: string;
  tile_label: string;
  tile_description: string;
  route_path: string;
  icon_key: string;
  sort_order: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, role, signOut, setRole } = useAuth();
  const navigate = useNavigate();

  const [tiles, setTiles] = React.useState<DashboardTile[]>([]);
  const [loadingTiles, setLoadingTiles] = React.useState(true);
  const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);

  // ── Fetch tiles for current role ─────────────────────────────────────────
  React.useEffect(() => {
    if (!role) {
      setTiles([]);
      setLoadingTiles(false);
      return;
    }

    const roleCode = role.toLowerCase();

    const fetchTiles = async () => {
      setLoadingTiles(true);

      // Step 1: get allowed tile_keys for this role from t104
      const { data: accessRows, error: accessError } = await supabase
        .from("t104_role_tile_access")
        .select("tile_key")
        .eq("role_code", roleCode)
        .eq("can_view", true);

      if (accessError || !accessRows || accessRows.length === 0) {
        console.warn("t104 returned empty for role:", roleCode, accessError?.message);
        setTiles([]);
        setLoadingTiles(false);
        return;
      }

      const allowedKeys = accessRows.map((r: { tile_key: string }) => r.tile_key);

      // Step 2: get tile metadata from t102
      const { data: tileRows, error: tileError } = await supabase
        .from("t102_dashboard_tiles")
        .select("tile_key, tile_label, tile_description, route_path, icon_key, sort_order")
        .in("tile_key", allowedKeys)
        .eq("is_enabled", true)
        .order("sort_order");

      if (tileError || !tileRows) {
        console.warn("t102 query failed:", tileError?.message);
        setTiles([]);
      } else {
        setTiles(tileRows as DashboardTile[]);
      }

      setLoadingTiles(false);
    };

    fetchTiles();
  }, [role]);

  // ── Fetch available roles for the role switcher ───────────────────────────
  React.useEffect(() => {
    const fetchRoles = async () => {
      const { data, error } = await supabase
        .from("t101_application_roles")
        .select("role_code");

      if (!error && data) {
        setAvailableRoles(data.map((r: { role_code: string }) => r.role_code.toUpperCase()));
      }
    };
    fetchRoles();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const roleLabel = role
    ? role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ")
    : "User";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => navigate("/dashboard")}
            >
              <div className="relative flex items-center justify-center w-9 h-9">
                <img
                  src="/cc-logo.png"
                  alt="Classroom Companion Logo"
                  className="h-9 w-9 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <div className="hidden absolute inset-0 flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
                  <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
              <span className="font-display font-bold text-lg tracking-tight">
                SPJIMR Classroom Companion
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Switcher — dev/testing tool */}
            {availableRoles.length > 0 && (
              <div className="hidden md:flex items-center gap-2 mr-4">
                <span className="text-xs text-muted-foreground">View as:</span>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={role?.toUpperCase() || ""}
                  onChange={(e) => setRole(e.target.value.toUpperCase() as AppRole)}
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Welcome */}
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight">
              Welcome, {displayName}
            </h1>
            <p className="text-muted-foreground mt-1">
              {loadingTiles
                ? "Loading your modules…"
                : tiles.length > 0
                  ? "Select a module below to get started."
                  : "Your dashboard will be populated as modules are assigned to your role."}
            </p>
          </div>

          {/* Tiles */}
          {loadingTiles ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tiles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tiles.map((tile, i) => {
                const Icon = resolveIcon(tile.icon_key);
                return (
                  <motion.div
                    key={tile.tile_key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.35 }}
                    onClick={() => navigate(tile.route_path)}
                  >
                    <Card className="group cursor-pointer border-border/60 hover:border-accent hover:bg-accent hover:shadow-lg transition-all duration-200 h-full relative overflow-hidden">
                      <CardContent className="p-6 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 group-hover:bg-white/20 transition-colors">
                            <Icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                          </div>
                          <ArrowRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <h3 className="font-semibold font-display group-hover:text-white transition-colors">
                            {tile.tile_label}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-white/90 transition-colors mt-2">
                            {tile.tile_description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center space-y-3">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold font-display">No modules available yet</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Your account has a <strong>{roleLabel}</strong> role. Modules will appear here as
                  they are configured by the Program Office or system administrators.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
