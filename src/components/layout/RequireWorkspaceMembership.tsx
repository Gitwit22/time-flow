import { useMemo } from "react";
import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAppStore } from "@/store/appStore";
import { useAppMode } from "@/context/AppModeContext";

interface RequireWorkspaceMembershipProps {
  children: ReactElement;
}

export function RequireWorkspaceMembership({ children }: RequireWorkspaceMembershipProps) {
  const { workspaceBootState } = useAppMode();
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

  // Workspace data still loading — show spinner instead of redirecting.
  // (RequireAuth already blocks on the initial auth load, but this handles
  // any edge case where workspace state lags behind.)
  if (workspaceBootState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Loading workspace…</span>
        </div>
      </div>
    );
  }

  // API failure with no cached data — show retry screen, NOT setup workspace.
  // A failed API call must never be interpreted as "user has no workspace".
  if (workspaceBootState === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <p className="text-sm font-medium">Unable to load your workspace</p>
          <p className="text-sm text-muted-foreground">
            Could not connect to the server. Check your connection and try again.
          </p>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Only navigate to setup when the user is authenticated and truly has no
  // workspace membership (workspaceBootState === "missing" OR "ready" with no match).
  if (!hasActiveMembership) {
    return <Navigate to="/setup-organization" replace />;
  }

  return children;
}
