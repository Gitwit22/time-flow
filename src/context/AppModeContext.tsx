/**
 * AppModeContext — Timeflow
 *
 * Resolves the current app mode:
 *   "loading"       — Zustand store is still rehydrating from localStorage
 *   "authenticated" — platform session is present (launched from Suite or
 *                     previously authenticated)
 *   "demo"          — no platform session, using seed data
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
  // Track whether there is a platform session. We check once on mount since
  // the session is set synchronously by PlatformLaunch before navigation.
  const [hasPlatformSession, setHasPlatformSession] = useState<boolean>(
    () => getPlatformSession() !== null,
  );

  useEffect(() => {
    setHasPlatformSession(getPlatformSession() !== null);
  }, [hydrated]);

  const mode: AppMode = !hydrated ? "loading" : hasPlatformSession ? "authenticated" : "demo";

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
