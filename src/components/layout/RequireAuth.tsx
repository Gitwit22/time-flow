import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { getPlatformSession } from "@/lib/platformApi";
import type { UserRole } from "@/types";

interface RequireAuthProps {
  children: ReactElement;
  allowRole?: UserRole;
}

export function RequireAuth({ children, allowRole }: RequireAuthProps) {
  const session = getPlatformSession();

  if (!session) {
    return <Navigate to="/launch" replace />;
  }

  if (allowRole && session.user.role !== allowRole) {
    return <Navigate to={session.user.role === "contractor" ? "/admin" : "/client"} replace />;
  }

  return children;
}
