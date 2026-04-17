import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { AppPermission } from "@/lib/finhub-types";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  requirePermission?: AppPermission;
}

export const ProtectedRoute = ({ children, requirePermission }: Props) => {
  const { session, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requirePermission && !hasPermission(requirePermission)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="font-display text-2xl font-bold">صلاحية غير متاحة</h2>
        <p className="text-muted-foreground">
          ليس لديك صلاحية الوصول إلى هذه الصفحة. تواصل مع المسؤول لمنحك الصلاحية.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
