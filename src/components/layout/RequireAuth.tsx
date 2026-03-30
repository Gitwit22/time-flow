import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { getActiveUser } from "@/lib/auth";
import type { UserRole } from "@/types";

interface RequireAuthProps {
  children: ReactElement;
  allowRole?: UserRole;
}

export function RequireAuth({ children, allowRole }: RequireAuthProps) {
  const activeUser = getActiveUser();

  if (!activeUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowRole && activeUser.role !== allowRole) {
    return <Navigate to={activeUser.role === "contractor" ? "/admin" : "/client"} replace />;
  }

  return children;
}
