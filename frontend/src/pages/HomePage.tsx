import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarCheck2,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  LogIn,
} from "lucide-react";
// import { backendApiUrl } from "@/lib/backendApi";

const pillars = [
  {
    title: "Program Office",
    copy: "Manage batches, divisions, and attendance workflows from one place",
    icon: Building2,
  },
  {
    title: "Students",
    copy: "Track academics in real time and stay notified before term milestones.",
    icon: GraduationCap,
  },
  {
    title: "Faculty",
    copy: "Identify low-attendance learners early and act with course-level precision.",
    icon: Users,
  },
];

const highlights = [
  { label: "Course Dashboards", icon: BookOpen },
  { label: "Attendance Intelligence", icon: Sparkles },
  { label: "Role-Gated Access", icon: ShieldCheck },
  { label: "Audit-friendly Records", icon: CalendarCheck2 },
  { label: "Stakeholder Views", icon: CalendarCheck2 },
];

const metrics = [
  { value: "1", label: "Unified Ops Layer" },
  { value: "4", label: "Stakeholder Views" },
  { value: "100%", label: "Role-Gated Access" },
];

const LoginCard = ({ isRedirecting, handleGoogleSignIn }: { isRedirecting: boolean; handleGoogleSignIn: () => void }) => (
  <Card className="overflow-hidden border-border/50 bg-card/85 shadow-xl">
    <div className="h-2 bg-gradient-to-r from-primary via-primary/70 to-accent" />
    <CardContent className="space-y-6 p-8">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Secure Sign In</h2>
        <p className="text-sm text-muted-foreground">
          Access is restricted to institutional Google accounts and policy checks.
        </p>
      </div>

      <Button
        onClick={handleGoogleSignIn}
        disabled={isRedirecting}
        variant="outline"
        className="h-11 w-full gap-3 text-base"
      >
        {isRedirecting ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {isRedirecting ? "Redirecting..." : "Continue with Google"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Only <strong>@spjimr.org</strong> accounts can access the platform.
      </p>
    </CardContent>
  </Card>
);

export default function HomePage() {
  const navigate = useNavigate();
  const { signInWithGoogle, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  // Fetch role names from t101_application_roles (no hardcoded fallback)
  useEffect(() => {
    supabase
      .from("t101_application_roles")
      .select("role_name")
      .then(({ data, error }) => {
        if (error) {
          console.error("[t101_application_roles] fetch error:", error.message);
        } else {
          console.log("[t101_application_roles] rows returned:", data);
          setRoles((data ?? []).map((r: { role_name: string }) => r.role_name));
        }
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      toast.error(decodeURIComponent(authError));
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("auth_error");
      window.history.replaceState({}, "", nextUrl.toString());
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setIsRedirecting(true);
    await signInWithGoogle();
    // Navigation handled by PublicOnlyRoute automatically, or we can explicit navigate
    // PublicOnlyRoute waits for 'user' to be present. 
    // signInWithGoogle sets user.
    // So PublicOnlyRoute should trigger.
    // However, to be safe/explicit:
    navigate("/dashboard");
  };

  // Distribute roles evenly across the background
  const bgPositions = [
    { top: "5%", left: "2%" },
    { top: "12%", left: "60%" },
    { top: "28%", left: "15%" },
    { top: "38%", left: "80%" },
    { top: "55%", left: "5%" },
    { top: "65%", left: "48%" },
    { top: "78%", left: "72%" },
    { top: "88%", left: "25%" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ── Decorative role labels fetched from t101_application_roles ── */}
      {roles.map((roleName, i) => {
        const pos = bgPositions[i % bgPositions.length];
        return (
          <span
            key={roleName}
            className="pointer-events-none absolute select-none font-mono text-xs font-semibold uppercase tracking-widest text-primary/10"
            style={{
              top: pos.top,
              left: pos.left,
              animationDelay: `${i * 0.4}s`,
            }}
            aria-hidden="true"
          >
            {roleName}
          </span>
        );
      })}

      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-primary/10 to-transparent" />

      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate("/")}>
            <div className="relative flex items-center justify-center w-9 h-9">
              <img
                src="/cc-logo-new.png"
                alt="Classroom Companion Logo"
                className="h-9 w-9 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold leading-none">Classroom Companion</p>
              <p className="text-xs text-muted-foreground">By SPJIMR</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="hidden sm:inline-flex gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? "Redirecting..." : "Sign In"}
          </Button>
        </div>
      </header>

      <main className="container relative z-10 py-6 sm:py-10 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">

          {/* LEFT COLUMN: Hero & Highlights (and Mobile Login) */}
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI Enabled Platform
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Academic Operations
                  <br />
                  <span className="text-accent">Rebuilt for Clarity.</span>
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  A secure platform for SPJIMR to run end-to-end academic lifecycle management :
                  onboarding, attendance, performance.
                </p>
              </div>
            </motion.section>

            {/* Login Card - Mobile Only (Hidden on LG) */}
            <div className="lg:hidden">
              <LoginCard isRedirecting={isRedirecting} handleGoogleSignIn={handleGoogleSignIn} />
            </div>

            {/* Highlights Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((feature, i) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                >
                  <Card className="h-full border-border/60 bg-card/80 transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center gap-4 p-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <feature.icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-medium">{feature.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: Login (Desktop) & Pillars */}
          <div className="space-y-8">
            {/* Login Card - Desktop Only (Hidden on Mobile) */}
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="hidden lg:block space-y-12"
            >
              <LoginCard isRedirecting={isRedirecting} handleGoogleSignIn={handleGoogleSignIn} />
            </motion.aside>

            {/* Pillars List */}
            <div className="grid gap-3">
              {pillars.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i + 0.2 }}
                >
                  <Card className="border-border/50 bg-card/70 backdrop-blur-sm transition-all hover:border-accent/40">
                    <CardContent className="flex items-start gap-3 p-4">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-primary font-semibold leading-none">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.copy}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

        </div>

        <section className="mt-14 rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-bold">Ready to run attendance at scale?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in once. Keep the entire academic operations lifecycle in one secure flow.
              </p>
            </div>
            <Button size="lg" className="gap-2 self-start sm:self-auto" onClick={handleGoogleSignIn}>
              Start Secure Session
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
