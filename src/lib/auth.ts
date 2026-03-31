import type { UserRole } from "@/types";

const AUTH_STORAGE_KEY = "timeflow-auth-v1";
const AUTH_SESSION_KEY = "timeflow-auth-session-v1";

interface AuthUser {
  id: string;
  name: string;
  loginId: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

interface ViewerInvite {
  code: string;
  clientId: string;
  createdByLoginId: string;
  createdAt: string;
  usedByUserId?: string;
  usedAt?: string;
}

interface AuthState {
  users: AuthUser[];
  invites: ViewerInvite[];
}

interface AuthSession {
  userId: string;
  loggedInAt: string;
}

function getDefaultState(): AuthState {
  return {
    users: [],
    invites: [],
  };
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

function readAuthState(): AuthState {
  if (typeof window === "undefined") {
    return getDefaultState();
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return getDefaultState();
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return getDefaultState();
  }
}

function writeAuthState(state: AuthState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createInviteCode() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `TF-${token}`;
}

export async function hashPassword(password: string) {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const data = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return btoa(password);
}

export function getActiveUser() {
  const session = readSession();
  if (!session) {
    return null;
  }

  const state = readAuthState();
  return state.users.find((user) => user.id === session.userId) ?? null;
}

export function getViewerClientIdForUser(userId: string) {
  const state = readAuthState();
  return state.invites.find((invite) => invite.usedByUserId === userId)?.clientId;
}

export function logoutActiveUser() {
  clearSession();
}

export function updateActiveUserProfile(updates: { name?: string; loginId?: string }) {
  const session = readSession();
  if (!session) {
    throw new Error("You must be signed in to update profile details.");
  }

  const state = readAuthState();
  const userIndex = state.users.findIndex((user) => user.id === session.userId);
  if (userIndex === -1) {
    throw new Error("Signed-in user was not found.");
  }

  const currentUser = state.users[userIndex];
  const nextName = updates.name?.trim() ? updates.name.trim() : currentUser.name;
  const nextLoginId = updates.loginId ? normalizeLoginId(updates.loginId) : currentUser.loginId;

  if (!nextLoginId) {
    throw new Error("Login cannot be empty.");
  }

  const loginCollision = state.users.some((user) => user.id !== currentUser.id && user.loginId === nextLoginId);
  if (loginCollision) {
    throw new Error("An account with this login already exists.");
  }

  const updatedUser: AuthUser = {
    ...currentUser,
    name: nextName,
    loginId: nextLoginId,
  };

  writeAuthState({
    ...state,
    users: state.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    invites:
      currentUser.loginId === updatedUser.loginId
        ? state.invites
        : state.invites.map((invite) =>
            invite.createdByLoginId === currentUser.loginId ? { ...invite, createdByLoginId: updatedUser.loginId } : invite,
          ),
  });

  return updatedUser;
}

export async function registerContractor(name: string, loginId: string, password: string) {
  const normalizedLoginId = normalizeLoginId(loginId);
  const state = readAuthState();

  const existing = state.users.find((user) => user.loginId === normalizedLoginId);
  if (existing) {
    throw new Error("An account with this login already exists.");
  }

  const passwordHash = await hashPassword(password);
  const user: AuthUser = {
    id: createId("user"),
    name: name.trim(),
    loginId: normalizedLoginId,
    passwordHash,
    role: "contractor",
    createdAt: new Date().toISOString(),
  };

  writeAuthState({
    ...state,
    users: [...state.users, user],
  });
  writeSession({ userId: user.id, loggedInAt: new Date().toISOString() });

  return user;
}

export async function loginWithCredentials(loginId: string, password: string) {
  const normalizedLoginId = normalizeLoginId(loginId);
  const state = readAuthState();
  const user = state.users.find((item) => item.loginId === normalizedLoginId);

  if (!user) {
    throw new Error("Invalid login or password.");
  }

  const inputHash = await hashPassword(password);
  if (inputHash !== user.passwordHash) {
    throw new Error("Invalid login or password.");
  }

  writeSession({ userId: user.id, loggedInAt: new Date().toISOString() });
  return user;
}

export function generateViewerInvite(clientId: string, createdByLoginId: string) {
  const state = readAuthState();
  const code = createInviteCode();

  const invite: ViewerInvite = {
    code,
    clientId,
    createdByLoginId,
    createdAt: new Date().toISOString(),
  };

  writeAuthState({
    ...state,
    invites: [invite, ...state.invites],
  });

  return invite;
}

export async function acceptViewerInvite(code: string, name: string, password: string) {
  const normalizedCode = code.trim().toUpperCase();
  const state = readAuthState();
  const invite = state.invites.find((item) => item.code === normalizedCode);

  if (!invite) {
    throw new Error("Invite code not found.");
  }

  if (invite.usedByUserId) {
    throw new Error("Invite code has already been used.");
  }

  const loginId = normalizeLoginId(normalizedCode);
  const existing = state.users.find((item) => item.loginId === loginId);
  if (existing) {
    throw new Error("A viewer account for this invite already exists.");
  }

  const passwordHash = await hashPassword(password);
  const user: AuthUser = {
    id: createId("user"),
    name: name.trim(),
    loginId,
    passwordHash,
    role: "client_viewer",
    createdAt: new Date().toISOString(),
  };

  writeAuthState({
    users: [...state.users, user],
    invites: state.invites.map((item) =>
      item.code === normalizedCode
        ? {
            ...item,
            usedByUserId: user.id,
            usedAt: new Date().toISOString(),
          }
        : item,
    ),
  });

  writeSession({ userId: user.id, loggedInAt: new Date().toISOString() });
  return user;
}

export function toAppIdentity(user: AuthUser) {
  return {
    name: user.name,
    email: user.role === "contractor" ? user.loginId : `${user.loginId}@viewer.local`,
    role: user.role,
  };
}
