import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { canManageWorkspace } from "@/lib/organization";
import { useAppStore } from "@/store/appStore";

interface RequireContractorProps {
  children: ReactElement;
}

export function RequireContractor({ children }: RequireContractorProps) {
  const role = useAppStore((state) => state.currentUser.role);

  if (!canManageWorkspace(role)) {
    if (role === "employee") {
      return <Navigate to="/employee" replace />;
    }
    return <Navigate to="/client" replace />;
  }

  return children;
}
