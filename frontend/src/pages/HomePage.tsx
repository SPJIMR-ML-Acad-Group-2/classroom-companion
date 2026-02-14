import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
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
} from "lucide-react";
// import { backendApiUrl } from "@/lib/backendApi";
import { supabase } from "@/integrations/supabase/client";

const pillars = [
  {
    title: "Program Office",
    copy: "Control batches, divisions, and attendance workflows from one command center.",
    icon: Building2,
  },
  {
    title: "Students",
    copy: "Track personal attendance in real time and stay below-risk before term milestones.",
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
  { label: "Secure Access Model", icon: ShieldCheck },
  { label: "Audit-friendly Records", icon: CalendarCheck2 },
];

const metrics = [
  { value: "1", label: "Unified Ops Layer" },
  { value: "4", label: "Stakeholder Views" },
  { value: "100%", label: "Role-Gated Access" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { signInWithGoogle, loading } = useAuth(); // Use loading from auth context

  // Local loading state not needed if we use auth context loading or just await
  // But useAuth loading is 'initial load' usually.
  // Let's use local loading for button feedback.
  const [isRedirecting, setIsRedirecting] = useState(false);

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-primary/10 to-transparent" />

      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/spjim-logo.png"
              alt="SPJIM logo"
              className="h-9 w-9 rounded-lg object-cover"
            />
            <div>
              <p className="font-display text-lg font-bold leading-none">SPJIMR Acad Ops</p>
              <p className="text-xs text-muted-foreground">Attendance Hub</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="hidden sm:inline-flex"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? "Redirecting..." : "Sign In"}
          </Button>
        </div>
      </header>

      <main className="container relative z-10 py-10 sm:py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Academic Operations Platform
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Attendance Operations
                <br />
                <span className="text-accent">Rebuilt for Clarity.</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                A secure platform for SPJIMR to run attendance lifecycle management end-to-end:
                onboarding, uploads, oversight, and intervention.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((item) => (
                <Card key={item.label} className="border-border/50 bg-card/60 backdrop-blur">
                  <CardContent className="p-4">
                    <p className="font-display text-2xl font-bold text-primary">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((feature, i) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                >
                  <Card className="h-full border-border/60 bg-card/80 transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <feature.icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-medium">{feature.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="space-y-5"
          >
            <Card className="overflow-hidden border-border/50 bg-card/85 shadow-2xl">
              <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-accent" />
              <CardContent className="space-y-6 p-7">
                <div className="space-y-2 text-center">
                  <h2 className="font-display text-2xl font-bold">Secure Sign In</h2>
                  <p className="text-sm text-muted-foreground">
                    Access is restricted to institutional Google accounts and policy checks.
                  </p>
                </div>

                <Button
                  onClick={handleGoogleSignIn}
                  disabled={isRedirecting}
                  className="h-12 w-full gap-3 text-base"
                >
                  {isRedirecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
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
                        <p className="font-display text-base font-semibold leading-none">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.copy}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </div>

        <section className="mt-14 rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl font-bold">Ready to run attendance at scale?</p>
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
