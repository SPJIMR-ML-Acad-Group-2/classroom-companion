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
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";

type AppRole = "DEVELOPER" | "PROGRAM_OFFICE" | "USER" | "STUDENT" | "FACULTY" | "TA" | "EXAM_OFFICE" | "SODOXO_OFFICE";

interface Tile {
  title: string;
  description: string;
  icon: React.ElementType;
  roles: AppRole[];
}

// Icon Mapping


const tiles: Tile[] = [
  {
    title: "Onboard Batch",
    description: "Create and manage academic batches for incoming cohorts.",
    icon: Users,
    roles: ["PROGRAM_OFFICE", "DEVELOPER"],
  },
  {
    title: "Manage Courses",
    description: "Configure courses, assign divisions, and set schedules.",
    icon: BookOpen,
    roles: ["PROGRAM_OFFICE", "DEVELOPER"],
  },
  {
    title: "Attendance Hub",
    description: "Upload attendance, view reports, and flag low performers.",
    icon: BarChart3,
    roles: ["PROGRAM_OFFICE", "DEVELOPER"],
  },
  {
    title: "System Settings",
    description: "Manage roles, platform configuration, and integrations.",
    icon: Settings,
    roles: ["DEVELOPER"],
  },
];

export default function Dashboard() {
  const { user, role, signOut, setRole } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const visibleTiles = tiles.filter((t) =>
    role ? t.roles.includes(role as AppRole) : false
  );

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const roleLabel =
    role === "PROGRAM_OFFICE"
      ? "Program Office"
      : role === "DEVELOPER"
        ? "Developer"
        : "User";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              SPJIMR Classroom Companion
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Switcher for Dev/Testing */}
            <div className="hidden md:flex items-center gap-2 mr-4">
              <span className="text-xs text-muted-foreground">View as:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={role?.toLowerCase() || ""}
                onChange={(e) => {
                  const newRole = e.target.value.toUpperCase() as AppRole;
                  setRole(newRole);
                }}
              >
                <option value="developer">Developer</option>
                <option value="program_office">Program Office</option>
                <option value="student">Student</option>
                <option value="user">User</option>
                <option value="faculty">Faculty</option>
                <option value="ta">TA</option>
                <option value="exam_office">Exam Office</option>
                <option value="sodoxo_office">Sodoxo</option>
              </select>
            </div>

            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5"
            >
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
              {visibleTiles.length > 0
                ? "Select a module below to get started."
                : "Your dashboard will be populated as modules are assigned to your role."}
            </p>
          </div>

          {/* Tiles */}
          {visibleTiles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleTiles.map((tile, i) => (
                <motion.div
                  key={tile.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                >
                  <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-200 h-full">
                    <CardContent className="p-6 space-y-3">
                      <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                        <tile.icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold font-display">{tile.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {tile.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center space-y-3">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold font-display">
                  No modules available yet
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Your account has a <strong>{roleLabel}</strong> role.
                  Modules will appear here as they are configured by the
                  Program Office or system administrators.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
