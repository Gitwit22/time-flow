/**
 * Platform API integration for Timeflow.
 *
 * When Timeflow is launched from the Nxt Lvl Suite, the hub passes a short-lived
 * JWT as `?token=<launchToken>` in the URL. This module handles consuming that
 * token, storing the resulting Timeflow-scoped session, and providing helpers for
 * making authenticated requests to the Timeflow API.
 */

const PLATFORM_TOKEN_KEY = "timeflow-platform-token";
const PLATFORM_USER_KEY = "timeflow-platform-user";

export const TIMEFLOW_API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as Record<string, unknown>).env
    ? ((import.meta as Record<string, unknown>).env as Record<string, string>).VITE_API_BASE_URL
    : undefined) || "https://api.ntlops.com";

export interface PlatformUser {
  id: string;
  email: string;
  role: "contractor" | "client_viewer";
  organizationId: string;
  programDomain: string;
}

export interface PlatformSession {
  token: string;
  user: PlatformUser;
}

export function getPlatformSession(): PlatformSession | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(PLATFORM_TOKEN_KEY);
  const userRaw = window.localStorage.getItem(PLATFORM_USER_KEY);
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as PlatformUser;
    return { token, user };
  } catch {
    return null;
  }
}

export function setPlatformSession(session: PlatformSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLATFORM_TOKEN_KEY, session.token);
  window.localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(session.user));
}

export function clearPlatformSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLATFORM_TOKEN_KEY);
  window.localStorage.removeItem(PLATFORM_USER_KEY);
}

export function isPlatformLaunched(): boolean {
  return getPlatformSession() !== null;
}

/**
 * Exchange a suite launch token for a Timeflow-scoped JWT.
 */
export async function consumeLaunchToken(launchToken: string): Promise<PlatformSession> {
  const response = await fetch(`${TIMEFLOW_API_BASE}/api/timeflow/platform-auth/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ launchToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((error.error as string) || "Failed to authenticate with platform");
  }

  const data = await response.json() as { token: string; user: PlatformUser };
  const session: PlatformSession = { token: data.token, user: data.user };
  setPlatformSession(session);
  return session;
}

/**
 * Authenticated fetch wrapper for Timeflow API calls.
 * Uses the platform JWT when available, falls back to local auth.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getPlatformSession();
  const headers = new Headers(init.headers);

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  return fetch(`${TIMEFLOW_API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}
