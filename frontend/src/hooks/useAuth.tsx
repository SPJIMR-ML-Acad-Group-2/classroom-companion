import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

// Mapping new database roles to frontend roles (using lowercase for internal app logic if preferred, or keeping uppercase)
// User provided: 'program_office', 'developer' (lowercase in seed data).
// Let's stick to what's in the DB.
type AppRole = "DEVELOPER" | "PROGRAM_OFFICE" | "USER" | "STUDENT" | "FACULTY" | "TA" | "EXAM_OFFICE" | "SODOXO_OFFICE" | string;

export interface AuthUser extends User {
  role?: AppRole;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  setRole: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // MOCK AUTH FOR DEVELOPMENT
    // This bypasses Supabase Auth to allow UI development without logging in.
    const mockUser: AuthUser = {
      id: "mock-user-id",
      app_metadata: {},
      user_metadata: { full_name: "Mock Developer", email: "dev@spjimr.org" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      role: "DEVELOPER"
    };

    setUser(mockUser);
    setRole("DEVELOPER");
    // Create a mock session object
    const mockSession = {
      access_token: "mock-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockUser
    } as Session;

    setSession(mockSession);
    setLoading(false);

    /* Real Auth Logic (Commented out for now)
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session) {
          setSession(session);
          fetchProfile(session.user);
        } else {
          setLoading(false);
        }
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setSession(session);
        if (session?.user) {
          await fetchProfile(session.user);
        } else {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    */
    return () => { mounted = false; };
  }, []);

  const fetchProfile = async (currentUser: User) => {
    try {
      // Try fetching from t106_user_profile first
      const { data, error } = await supabase
        .from("t106_user_profile")
        .select("primary_role")
        .eq("user_id", currentUser.id)
        .single();

      if (error) {
        // Fallback to old users table if t106 not yet populated (during migration phase)
        console.warn("Could not fetch t106 profile, trying legacy users table...", error);
        const { data: legacyData, error: legacyError } = await supabase
          .from("users")
          .select("role")
          .eq("id", currentUser.id)
          .single();

        if (legacyError) {
          console.error("Error fetching user profile (legacy):", legacyError);
          setRole("USER");
          setUser({ ...currentUser, role: "USER" });
        } else {
          // Legacy roles were uppercase? Checking migration... 'USER'
          const legacyRole = legacyData?.role || "USER";
          setRole(legacyRole);
          setUser({ ...currentUser, role: legacyRole });
        }
      } else {
        // t106 has role_code. User seed data used lowercase 'program_office'.
        // We normalize to Uppercase for frontend consistency if needed, OR keep as is.
        // Dashboard expects Uppercase "PROGRAM_OFFICE". User seed data said 'program_office'.
        // Let's normalize to Uppercase to match Dashboard tile checks.
        const dbRole = data?.primary_role || "USER";
        const normalizedRole = dbRole.toUpperCase();

        setRole(normalizedRole);
        setUser({ ...currentUser, role: normalizedRole });
      }
    } catch (error) {
      console.error("Unexpected error fetching profile:", error);
      setRole("USER");
      setUser({ ...currentUser, role: "USER" });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Sign out failed");
    }
    setUser(null);
    setRole(null);
    setSession(null);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const mockUser: AuthUser = {
      id: "mock-user-id",
      app_metadata: {},
      user_metadata: { full_name: "Mock Developer", email: "dev@spjimr.org" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      role: "DEVELOPER"
    };

    setUser(mockUser);
    setRole("DEVELOPER");
    const mockSession = {
      access_token: "mock-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockUser
    } as Session;
    setSession(mockSession);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut, signInWithGoogle, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
