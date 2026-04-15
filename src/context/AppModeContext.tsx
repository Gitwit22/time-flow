/**
 * AppModeContext — Timeflow
 *
 * Resolves the current app mode:
 *   "loading"       — Zustand store is still rehydrating from localStorage
 *   "authenticated" — platform session or local auth session is present
 *   "demo"          — no authenticated session
 *
 * This is a thin wrapper over the Zustand store's hydrated flag and
 * getPlatformSession(), making it easy to read mode in any component.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useAppStore } from "@/store/appStore";
import { getPlatformSession } from "@/lib/platformApi";
import { getActiveUser } from "@/lib/auth";

export type AppMode = "loading" | "authenticated" | "demo";

interface AppModeContextType {
  mode: AppMode;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const hydrated = useAppStore((state) => state.hydrated);
  const [hasAuthSession, setHasAuthSession] = useState<boolean>(
    () => getPlatformSession() !== null || getActiveUser() !== null,
  );

  useEffect(() => {
    setHasAuthSession(getPlatformSession() !== null || getActiveUser() !== null);
  }, [hydrated]);

  const mode: AppMode = !hydrated ? "loading" : hasAuthSession ? "authenticated" : "demo";

  const value = useMemo<AppModeContextType>(
    () => ({
      mode,
      isLoading: mode === "loading",
      isAuthenticated: mode === "authenticated",
      isDemo: mode === "demo",
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
