import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAppStore } from "@/store/appStore";

interface RequireContractorProps {
  children: ReactElement;
}

export function RequireContractor({ children }: RequireContractorProps) {
  const role = useAppStore((state) => state.currentUser.role);

  if (role !== "contractor") {
    return <Navigate to="/client" replace />;
  }

  return children;
}
