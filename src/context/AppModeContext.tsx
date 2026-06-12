/**
 * AppModeContext — Timeflow
 *
 * Resolves the current app mode:
 *   "loading"         — auth not resolved yet, or authenticated data still loading
 *   "authenticated"   — session is valid and app data is loaded
 *   "unauthenticated" — no active session
 *
 * Also resolves workspaceBootState:
 *   "loading"  — auth hydration not yet complete
 *   "ready"    — authenticated, at least one organization loaded
 *   "missing"  — authenticated, no organizations (new user — show setup page)
 *   "error"    — hydration failed and no cached workspace data available
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppStore } from "@/store/appStore";

export type AppMode = "loading" | "authenticated" | "unauthenticated";
export type WorkspaceBootState = "loading" | "ready" | "missing" | "error";

interface AppModeContextType {
  mode: AppMode;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Kept for backward compatibility with existing components.
  isDemo: false;
  workspaceBootState: WorkspaceBootState;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const authStatus = useAppStore((state) => state.authStatus);
  const hydrated = useAppStore((state) => state.hydrated);
  const organizations = useAppStore((state) => state.organizations);
  const hydrateError = useAppStore((state) => state.hydrateError);

  const mode: AppMode =
    authStatus === "unknown" || (authStatus === "authenticated" && !hydrated)
      ? "loading"
      : authStatus === "authenticated"
        ? "authenticated"
        : "unauthenticated";

  // Only meaningful when mode === "authenticated", but safe to compute always.
  const workspaceBootState: WorkspaceBootState =
    !hydrated
      ? "loading"
      : organizations.length > 0
        ? "ready"
        : hydrateError
          ? "error"
          : "missing";

  const value = useMemo<AppModeContextType>(
    () => ({
      mode,
      isLoading: mode === "loading",
      isAuthenticated: mode === "authenticated",
      isDemo: false,
      workspaceBootState,
    }),
    [mode, workspaceBootState],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextType {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppModeProvider");
  return ctx;
}
