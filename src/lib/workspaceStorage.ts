/**
 * workspaceStorage — TimeFlow
 *
 * Persists workspace-related state to localStorage so the active workspace
 * and all locally-managed workspaces survive page refreshes.
 *
 * The workspace data model lives purely on the frontend for now; when the
 * backend gains workspace support these helpers can be replaced by API calls
 * without touching any of the store or migration logic.
 */

import type { Workspace, WorkspaceMember, WorkspaceMigration } from "@/types/workspace";

const ACTIVE_WORKSPACE_KEY = "timeflow-active-workspace-v1";
const WORKSPACES_KEY = "timeflow-workspaces-v1";
const WORKSPACE_MEMBERS_KEY = "timeflow-workspace-members-v1";
const WORKSPACE_MIGRATIONS_KEY = "timeflow-workspace-migrations-v1";

// ─── Safe storage access ──────────────────────────────────────────────────────

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full — non-critical
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // non-critical
  }
}

// ─── Active workspace ID ──────────────────────────────────────────────────────

export function readActiveWorkspaceId(): string | null {
  return safeGet<string | null>(ACTIVE_WORKSPACE_KEY, null);
}

export function persistActiveWorkspaceId(id: string): void {
  safeSet(ACTIVE_WORKSPACE_KEY, id);
}

export function clearActiveWorkspaceId(): void {
  safeRemove(ACTIVE_WORKSPACE_KEY);
}

// ─── Workspaces list ──────────────────────────────────────────────────────────

export function readWorkspaces(): Workspace[] {
  return safeGet<Workspace[]>(WORKSPACES_KEY, []);
}

export function persistWorkspaces(workspaces: Workspace[]): void {
  safeSet(WORKSPACES_KEY, workspaces);
}

// ─── Workspace members ────────────────────────────────────────────────────────

export function readWorkspaceMembers(): WorkspaceMember[] {
  return safeGet<WorkspaceMember[]>(WORKSPACE_MEMBERS_KEY, []);
}

export function persistWorkspaceMembers(members: WorkspaceMember[]): void {
  safeSet(WORKSPACE_MEMBERS_KEY, members);
}

// ─── Workspace migrations ─────────────────────────────────────────────────────

export function readWorkspaceMigrations(): WorkspaceMigration[] {
  return safeGet<WorkspaceMigration[]>(WORKSPACE_MIGRATIONS_KEY, []);
}

export function persistWorkspaceMigrations(migrations: WorkspaceMigration[]): void {
  safeSet(WORKSPACE_MIGRATIONS_KEY, migrations);
}
