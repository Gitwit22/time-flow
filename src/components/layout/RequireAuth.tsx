import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppMode } from "@/context/AppModeContext";

/**
 * RequireAuth — guards app routes based on resolved mode.
 *
 * - loading       → full-screen spinner (never redirects while auth is unresolved)
 * - authenticated → render the route with real data
 * - demo          → render the route with seed/demo data
 *
 * All app routes work in both authenticated and demo modes.
 * Sensitive write operations are blocked at the action level, not here.
 */
export function RequireAuth({ children }: { children: ReactElement }) {
  const { isLoading, isAuthenticated } = useAppMode();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
