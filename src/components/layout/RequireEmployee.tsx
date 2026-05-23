import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { isEmployeeRole } from "@/lib/organization";
import { useAppStore } from "@/store/appStore";

interface RequireEmployeeProps {
  children: ReactElement;
}

export function RequireEmployee({ children }: RequireEmployeeProps) {
  const role = useAppStore((state) => state.currentUser.role);

  if (!isEmployeeRole(role)) {
    return <Navigate to="/platform" replace />;
  }

  return children;
}
