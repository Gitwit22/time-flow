/**
 * workspace.ts — TimeFlow
 *
 * Helper utilities for workspace creation and permission checks.
 *
 * Permissions are role-based and intentionally permissive for the solo
 * workflow (the default workspace owner has full access to everything).
 *
 * [WORKSPACE-BRANCH] company UI: wire canManageMembers / canManageBilling
 *   into the team-management screens when they are introduced.
 */

import type { Workspace, WorkspaceMember, WorkspaceMemberRole, WorkspaceType } from "@/types/workspace";

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeWorkspaceId(): string {
  return `ws-${crypto.randomUUID()}`;
}

function makeMemberId(): string {
  return `wsm-${crypto.randomUUID()}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Create a new solo (personal) workspace record.
 * Does NOT persist — callers are responsible for adding it to the store.
 */
export function buildSoloWorkspace(ownerUserId: string, name: string): Workspace {
  const ts = now();
  return {
    id: makeWorkspaceId(),
    name,
    type: "solo",
    ownerUserId,
    status: "active",
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Create a new company workspace record, optionally linked to a source workspace.
 * Does NOT persist — callers are responsible for adding it to the store.
 *
 * [WORKSPACE-BRANCH] company UI: surface this builder in the "Create Company
 *   Workspace" wizard when it is implemented.
 */
export function buildCompanyWorkspace(
  ownerUserId: string,
  name: string,
  sourceWorkspaceId?: string,
  createdFromMigrationId?: string,
): Workspace {
  const ts = now();
  return {
    id: makeWorkspaceId(),
    name,
    type: "company",
    ownerUserId,
    status: "active",
    sourceWorkspaceId,
    createdFromMigrationId,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Build any workspace type by providing the type explicitly.
 * Convenience wrapper used by the store.
 */
export function buildWorkspace(
  ownerUserId: string,
  name: string,
  type: WorkspaceType,
  sourceWorkspaceId?: string,
  createdFromMigrationId?: string,
): Workspace {
  return type === "solo"
    ? buildSoloWorkspace(ownerUserId, name)
    : buildCompanyWorkspace(ownerUserId, name, sourceWorkspaceId, createdFromMigrationId);
}

/**
 * Create the owner membership record for a newly created workspace.
 * Does NOT persist — callers are responsible for adding it to the store.
 */
export function buildOwnerMembership(workspaceId: string, userId: string): WorkspaceMember {
  return {
    id: makeMemberId(),
    workspaceId,
    userId,
    role: "owner",
    joinedAt: now(),
  };
}

// ─── Permission checks ────────────────────────────────────────────────────────

/**
 * Returns true if the given role can modify workspace settings and members.
 *
 * [WORKSPACE-BRANCH] company UI: use this to gate the Settings > Workspace page.
 */
export function canEditWorkspace(role: WorkspaceMemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Returns true if the given role can invite or remove team members.
 *
 * [WORKSPACE-BRANCH] company UI: use this to gate the Team Management screen.
 */
export function canManageMembers(role: WorkspaceMemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Returns true if the given role can view and manage invoices / billing.
 *
 * [WORKSPACE-BRANCH] company UI: use this to gate the Billing & Invoices section.
 */
export function canManageBilling(role: WorkspaceMemberRole): boolean {
  return role === "owner" || role === "admin" || role === "billing";
}

/**
 * Returns true if the given role can create / edit / delete core business data
 * (clients, projects, time entries).
 */
export function hasWriteAccess(role: WorkspaceMemberRole): boolean {
  return role === "owner" || role === "admin" || role === "manager" || role === "employee";
}

/**
 * Returns true if the given role can read all workspace data.
 * Every valid role has at least read access.
 */
export function hasReadAccess(_role: WorkspaceMemberRole): boolean {
  return true;
}

// ─── Membership helpers ───────────────────────────────────────────────────────

/**
 * Find the calling user's role in the given workspace.
 * Returns undefined if the user has no membership.
 */
export function getUserRoleInWorkspace(
  members: WorkspaceMember[],
  workspaceId: string,
  userId: string,
): WorkspaceMemberRole | undefined {
  return members.find((m) => m.workspaceId === workspaceId && m.userId === userId)?.role;
}

/**
 * Return all memberships for a given user across all workspaces.
 */
export function getUserMemberships(
  members: WorkspaceMember[],
  userId: string,
): WorkspaceMember[] {
  return members.filter((m) => m.userId === userId);
}
