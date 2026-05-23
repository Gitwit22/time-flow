import { useMemo } from "react";
import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAppStore } from "@/store/appStore";

interface RequireWorkspaceMembershipProps {
  children: ReactElement;
}

export function RequireWorkspaceMembership({ children }: RequireWorkspaceMembershipProps) {
  const currentUser = useAppStore((state) => state.currentUser);
  const organizationMembers = useAppStore((state) => state.organizationMembers);

  const hasActiveMembership = useMemo(() => {
    if (currentUser.role === "client_viewer") {
      return true;
    }
    return organizationMembers.some(
      (member) => member.userId === currentUser.id && member.status === "active",
    );
  }, [currentUser.id, currentUser.role, organizationMembers]);

  if (!hasActiveMembership) {
    return <Navigate to="/setup-organization" replace />;
  }

  return children;
}
