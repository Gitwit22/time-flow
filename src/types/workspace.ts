/**
 * Workspace domain types — TimeFlow
 *
 * These types establish the workspace-based architecture that supports
 * both solo and company/team pathways.  The solo workflow remains
 * completely unchanged; the workspace layer is purely additive.
 *
 * Future branching points are annotated with:
 *   // [WORKSPACE-BRANCH] company UI goes here
 *   // [WORKSPACE-BRANCH] team-member UI goes here
 */

// ─── Workspace ────────────────────────────────────────────────────────────────

/** Whether this workspace is a personal/solo space or a shared company space. */
export type WorkspaceType = "solo" | "company";

/** Lifecycle state of a workspace.  Deletion / archiving must be explicit user actions. */
export type WorkspaceStatus = "active" | "archived" | "deleted";

/**
 * A workspace owns all business data (clients, projects, time entries …).
 * Every user starts with one default solo workspace.
 *
 * @field sourceWorkspaceId       Set when this workspace was forked from another one.
 * @field createdFromMigrationId  The migration run that seeded this workspace's data.
 */
export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  ownerUserId: string;
  status: WorkspaceStatus;
  /** Only present when this workspace was created from an existing one. */
  sourceWorkspaceId?: string;
  /** The migration batch that populated this workspace, if any. */
  createdFromMigrationId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
}

// ─── Workspace membership ─────────────────────────────────────────────────────

/**
 * Roles available within a workspace.
 *
 * Current solo workflow only ever uses "owner".
 * Additional roles are scaffolded for the future company/team UI.
 *
 * [WORKSPACE-BRANCH] company UI: surface role management screens here
 */
export type WorkspaceMemberRole =
  | "owner"    // Full control; can archive / delete the workspace
  | "admin"    // Manage members and settings; cannot delete workspace
  | "manager"  // Manage projects / clients / time entries
  | "employee" // Submit time entries; read-only invoices
  | "billing"; // Read / manage invoices and billing; no time entries

/**
 * Associates a user with a workspace and captures their role.
 * A user can hold memberships in multiple workspaces simultaneously.
 */
export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  joinedAt: string;
}

// ─── Workspace migration ──────────────────────────────────────────────────────

/**
 * Supported data types that can be copied during a workspace migration.
 * Paid invoices, payment history, approval logs, and audit logs are
 * intentionally excluded from the first pass.
 */
export type WorkspaceMigrableDataType =
  | "clients"
  | "projects"
  | "budgets"
  | "billing_rates"
  | "categories"
  | "invoice_templates"
  | "unbilled_time_entries"
  | "draft_invoices";

/** All supported data types, used as a convenience constant. */
export const ALL_MIGRATABLE_DATA_TYPES: WorkspaceMigrableDataType[] = [
  "clients",
  "projects",
  "budgets",
  "billing_rates",
  "categories",
  "invoice_templates",
  "unbilled_time_entries",
  "draft_invoices",
];

export type WorkspaceMigrationStatus = "pending" | "running" | "completed" | "failed";

/**
 * Tracks a single copy-based migration between two workspaces.
 *
 * Key invariants:
 *  - The source workspace is NEVER mutated or deleted by a migration.
 *  - All copied records receive new IDs and carry provenance metadata.
 *  - A new workspace is always created as the migration target.
 */
export interface WorkspaceMigration {
  id: string;
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  createdByUserId: string;
  selectedDataTypes: WorkspaceMigrableDataType[];
  status: WorkspaceMigrationStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// ─── Copy provenance ──────────────────────────────────────────────────────────

/**
 * Metadata attached to every entity that was created by a migration copy.
 * Stored as optional fields on the copied record so the source can always
 * be traced back.
 */
export interface CopyProvenance {
  /** ID of the workspace the record was copied from. */
  sourceWorkspaceId: string;
  /** Original entity ID in the source workspace. */
  sourceEntityId: string;
  /** The WorkspaceMigration.id that produced this copy. */
  migrationBatchId: string;
  /** ISO timestamp when the copy was created. */
  copiedAt: string;
}
