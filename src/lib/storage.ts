import type { WorkSession } from "@/types";

const ACTIVE_SESSION_KEY = "timeflow-active-session";

const noopStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return noopStorage;
  }

  return window.localStorage;
}

export function persistActiveSession(session: WorkSession) {
  try {
    getBrowserStorage().setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // storage full — non-critical
  }
}

export function clearPersistedActiveSession() {
  getBrowserStorage().removeItem(ACTIVE_SESSION_KEY);
}

export function readPersistedActiveSession(): WorkSession | null {
  try {
    const raw = getBrowserStorage().getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkSession;
    return parsed?.isActive ? parsed : null;
  } catch {
    return null;
  }
}
