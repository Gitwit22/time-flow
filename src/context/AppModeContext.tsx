/**
 * AppModeContext — Timeflow
 *
 * Resolves the current app mode:
 *   "loading"         — auth not resolved yet, or authenticated data still loading
 *   "authenticated"   — session is valid and app data is loaded
 *   "unauthenticated" — no active session
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppStore } from "@/store/appStore";

export type AppMode = "loading" | "authenticated" | "unauthenticated";

interface AppModeContextType {
  mode: AppMode;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Kept for backward compatibility with existing components.
  isDemo: false;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const authStatus = useAppStore((state) => state.authStatus);
  const hydrated = useAppStore((state) => state.hydrated);

  const mode: AppMode =
    authStatus === "unknown" || (authStatus === "authenticated" && !hydrated)
      ? "loading"
      : authStatus === "authenticated"
        ? "authenticated"
        : "unauthenticated";

  const value = useMemo<AppModeContextType>(
    () => ({
      mode,
      isLoading: mode === "loading",
      isAuthenticated: mode === "authenticated",
      isDemo: false,
    }),
    [mode],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextType {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppModeProvider");
  return ctx;
}
