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

    const currentUserId = currentUser.id?.trim();
    const currentUserEmail = currentUser.email?.trim().toLowerCase();

    return organizationMembers.some(
      (member) => {
        if (member.status !== "active") {
          return false;
        }

        const memberEmail = member.email?.trim().toLowerCase();
        return (Boolean(currentUserId) && member.userId === currentUserId)
          || (Boolean(currentUserEmail) && memberEmail === currentUserEmail);
      },
    );
  }, [currentUser.email, currentUser.id, currentUser.role, organizationMembers]);

  if (!hasActiveMembership) {
    return <Navigate to="/setup-organization" replace />;
  }

  return children;
}
