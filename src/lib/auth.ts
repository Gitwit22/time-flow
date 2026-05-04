import type { UserRole } from "@/types";
import { TIMEFLOW_API_BASE } from "@/lib/platformApi";

const AUTH_SESSION_KEY = "timeflow-auth-session-v2";

interface AuthUser {
	id: string;
	name: string;
	loginId: string;
	role: UserRole;
	clientId?: string;
	organizationId?: string;
	programDomain?: string;
	createdAt: string;
}

interface AuthSession {
	token: string;
	user: AuthUser;
	loggedInAt: string;
}

interface BackendAuthUser {
	id: string;
	email: string;
	displayName?: string;
	role: string;
	clientId?: string;
	organizationId?: string;
	programDomain?: string;
}

function normalizeLoginId(value: string) {
	return value.trim().toLowerCase();
}

function readSession(): AuthSession | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
	if (!raw) return null;

	try {
		return JSON.parse(raw) as AuthSession;
	} catch {
		return null;
	}
}

function writeSession(session: AuthSession) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem(AUTH_SESSION_KEY);
}

function toAuthUser(user: BackendAuthUser): AuthUser {
	const normalizedRole: UserRole = user.role === "client_viewer" ? "client_viewer" : "contractor";
	return {
		id: user.id,
		name: user.displayName?.trim() || user.email.split("@")[0] || user.email,
		loginId: normalizeLoginId(user.email),
		role: normalizedRole,
		clientId: user.clientId,
		organizationId: user.organizationId,
		programDomain: user.programDomain,
		createdAt: new Date().toISOString(),
	};
}

function parseToken(payload: Record<string, unknown>): string | null {
	const candidate =
		payload.token ??
		payload.accessToken ??
		payload.authToken ??
		(payload.auth && typeof payload.auth === "object" ? (payload.auth as Record<string, unknown>).token : null) ??
		(payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>).token : null);

	return typeof candidate === "string" ? candidate : null;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
	const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		throw new Error(typeof data.error === "string" ? data.error : "Authentication request failed.");
	}
	return data as unknown as T;
}

async function authFetch(path: string, init: RequestInit = {}) {
	return fetch(`${TIMEFLOW_API_BASE}${path}`, {
		...init,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});
}

async function writeSessionFromAuthResponse(response: Response): Promise<AuthUser> {
	const payload = await parseJsonResponse<Record<string, unknown>>(response);
	const userPayload = payload.user as BackendAuthUser | undefined;
	const token = parseToken(payload);

	if (!userPayload || !token) {
		throw new Error("Authentication response was incomplete.");
	}

	const user = toAuthUser(userPayload);
	writeSession({ token, user, loggedInAt: new Date().toISOString() });
	return user;
}

export function getActiveUser() {
	return readSession()?.user ?? null;
}

export function getActiveAuthToken() {
	return readSession()?.token ?? null;
}

// Viewer invite linkage is now server-managed; keep compatibility API.
export function getViewerClientIdForUser(userId: string) {
	const activeUser = readSession()?.user;
	if (!activeUser || activeUser.id !== userId) {
		return undefined;
	}

	return activeUser.clientId;
}

export function logoutActiveUser() {
	void authFetch("/api/timeflow/auth/logout", { method: "POST" }).catch(() => undefined);
	clearSession();
}

export function clearAuthState() {
	clearSession();
	if (typeof window !== "undefined") {
		// Legacy keys from pre-API auth flow.
		window.localStorage.removeItem("timeflow-auth-v1");
		window.localStorage.removeItem("timeflow-auth-session-v1");
	}
}

export function updateActiveUserProfile(updates: { name?: string; loginId?: string }) {
	const session = readSession();
	if (!session) {
		throw new Error("You must be signed in to update profile details.");
	}

	const nextName = updates.name?.trim() || session.user.name;
	const nextLoginId = updates.loginId ? normalizeLoginId(updates.loginId) : session.user.loginId;

	if (!nextLoginId) {
		throw new Error("Login cannot be empty.");
	}

	const nextUser: AuthUser = {
		...session.user,
		name: nextName,
		loginId: nextLoginId,
	};
	writeSession({ ...session, user: nextUser });
	return nextUser;
}

export function updateActiveUserRole(role: UserRole) {
	const session = readSession();
	if (!session) {
		return null;
	}

	const nextUser: AuthUser = {
		...session.user,
		role,
	};
	writeSession({ ...session, user: nextUser });
	return nextUser;
}

export async function registerContractor(name: string, loginId: string, password: string) {
	const response = await authFetch("/api/timeflow/auth/register", {
		method: "POST",
		body: JSON.stringify({
			email: normalizeLoginId(loginId),
			password,
			displayName: name.trim(),
		}),
	});

	return writeSessionFromAuthResponse(response);
}

export async function loginWithCredentials(loginId: string, password: string) {
	const response = await authFetch("/api/timeflow/auth/login", {
		method: "POST",
		body: JSON.stringify({
			email: normalizeLoginId(loginId),
			password,
		}),
	});

	return writeSessionFromAuthResponse(response);
}

export async function generateViewerInvite(clientId: string, _createdByLoginId: string): Promise<{ code: string }> {
	const response = await authFetch("/api/timeflow/auth/invite/generate", {
		method: "POST",
		body: JSON.stringify({ clientId }),
	});
	const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		throw new Error(typeof data.error === "string" ? data.error : "Failed to generate invite");
	}
	return { code: data.code as string };
}

export async function acceptViewerInvite(
	code: string,
	name: string,
	email: string,
	password: string,
): Promise<AuthUser & { clientId?: string }> {
	const response = await authFetch("/api/timeflow/auth/invite/accept", {
		method: "POST",
		body: JSON.stringify({ code, displayName: name, email, password }),
	});
	const payload = await parseJsonResponse<Record<string, unknown>>(response);
	const userPayload = payload.user as (BackendAuthUser & { clientId?: string }) | undefined;
	const token = parseToken(payload);

	if (!userPayload || !token) {
		throw new Error("Invite acceptance response was incomplete.");
	}

	const user = toAuthUser(userPayload);
	writeSession({ token, user, loggedInAt: new Date().toISOString() });
	return user;
}

export function toAppIdentity(user: AuthUser) {
	return {
		name: user.name,
		email: user.loginId,
		role: user.role,
	};
}
