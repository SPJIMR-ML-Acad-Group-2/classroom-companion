import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { hasSubtileAccess, hasTileAccess, normalizeRoleCode } from "@/lib/rbac";

interface ModuleRouteGuardProps {
  tileKey: string;
  subtileKey?: string;
  children: React.ReactNode;
}

export default function ModuleRouteGuard({ tileKey, subtileKey, children }: ModuleRouteGuardProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const roleCode = normalizeRoleCode(role);

      const canAccess = subtileKey
        ? await hasSubtileAccess(roleCode, tileKey, subtileKey)
        : await hasTileAccess(roleCode, tileKey);

      setAllowed(canAccess);
      setLoading(false);
    };

    checkAccess();
  }, [role, tileKey, subtileKey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Access denied</p>
            <p className="text-sm text-muted-foreground">
              Your role is not permitted for this module.
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
