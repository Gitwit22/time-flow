/**
 * useIdleLogout — detects user inactivity and triggers warning / auto-logout.
 *
 * Thresholds are configured via:
 *   VITE_IDLE_WARNING_MINUTES  (default 55)
 *   VITE_IDLE_LOGOUT_MINUTES   (default 60)
 *
 * Behavior:
 *   - Any user activity (mouse, keyboard, touch, scroll) resets both timers.
 *   - Once the warning threshold is reached, activity no longer resets timers;
 *     only an explicit "Stay signed in" click (calling resetTimer) resets.
 *   - When the logout threshold is reached, onLogout() is called.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "mousedown",
  "touchstart",
  "scroll",
  "click",
] as const;

export interface UseIdleLogoutOptions {
  /** Milliseconds of inactivity before showing the session-expiry warning. */
  warningMs: number;
  /** Milliseconds of inactivity before auto-logout. Must be > warningMs. */
  logoutMs: number;
  onLogout: () => void;
}

export interface UseIdleLogoutReturn {
  /** True when the warning modal should be visible. */
  isWarningVisible: boolean;
  /** Call this to dismiss the warning and reset both timers (Stay signed in). */
  resetTimer: () => void;
}

export function useIdleLogout({
  warningMs,
  logoutMs,
  onLogout,
}: UseIdleLogoutOptions): UseIdleLogoutReturn {
  const [isWarningVisible, setIsWarningVisible] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isWarnedRef = useRef(false);
  const onLogoutRef = useRef(onLogout);

  // Keep the logout callback ref fresh without re-triggering effects.
  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const reset = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    isWarnedRef.current = false;
    setIsWarningVisible(false);

    warningTimerRef.current = setTimeout(() => {
      isWarnedRef.current = true;
      setIsWarningVisible(true);
    }, warningMs);

    logoutTimerRef.current = setTimeout(() => {
      isWarnedRef.current = false;
      setIsWarningVisible(false);
      onLogoutRef.current();
    }, logoutMs);
  }, [warningMs, logoutMs]);

  useEffect(() => {
    reset();

    const handleActivity = () => {
      // Once the warning is shown, only an explicit "Stay signed in" click resets.
      if (isWarnedRef.current) return;
      reset();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimeout(warningTimerRef.current);
      clearTimeout(logoutTimerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [reset]);

  return { isWarningVisible, resetTimer: reset };
}
