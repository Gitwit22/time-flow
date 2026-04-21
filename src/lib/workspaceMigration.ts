/**
 * workspaceMigration.ts — TimeFlow
 *
 * Copy-based workspace migration service.
 *
 * Key invariants enforced here:
 *  1. The source workspace is NEVER mutated or deleted.
 *  2. Every copied record receives a brand-new ID.
 *  3. Every copied record stores copy-provenance metadata so the origin can
 *     always be traced back.
 *  4. Paid invoices, payment history, approval logs, and audit logs are
 *     excluded from this first-pass migration.
 *
 * [WORKSPACE-BRANCH] company UI: when the migration wizard is introduced,
 *   call runWorkspaceMigration() with the user-selected data types and
 *   surface progress via the migration.status field.
 */

import type { Client, Invoice, Project, TimeEntry } from "@/types";
import type {
  WorkspaceMigrableDataType,
  WorkspaceMigration,
  WorkspaceMigrationStatus,
} from "@/types/workspace";

// ─── ID helpers ───────────────────────────────────────────────────────────────

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Entity copy helpers ──────────────────────────────────────────────────────

/**
 * Copy a client into a target workspace, rewriting the ID and attaching
 * provenance metadata.
 *
 * @param idMap  Receives the mapping  original-id → new-id so dependent
 *               records (projects) can update their FK.
 */
export function copyClient(
  client: Client,
  targetWorkspaceId: string,
  migrationBatchId: string,
  idMap: Map<string, string>,
): Client {
  const newClientId = newId("client");
  idMap.set(client.id, newClientId);
  const copiedAt = nowIso();
  return {
    ...client,
    id: newClientId,
    workspaceId: targetWorkspaceId,
    // documents are not copied in this pass — attachments require separate
    // storage handling; the record is preserved but the array is reset.
    documents: [],
    sourceWorkspaceId: client.workspaceId ?? client.sourceWorkspaceId,
    sourceEntityId: client.id,
    migrationBatchId,
    copiedAt,
  };
}

/**
 * Copy a project into a target workspace.
 *
 * @param clientIdMap  The id mapping produced by copyClient() so the
 *                     project's clientId FK can be rewritten to the new client.
 */
export function copyProject(
  project: Project,
  targetWorkspaceId: string,
  migrationBatchId: string,
  clientIdMap: Map<string, string>,
): Project {
  const newProjectId = newId("project");
  const copiedAt = nowIso();
  return {
    ...project,
    id: newProjectId,
    clientId: clientIdMap.get(project.clientId) ?? project.clientId,
    workspaceId: targetWorkspaceId,
    documents: [],
    sourceWorkspaceId: project.workspaceId ?? project.sourceWorkspaceId,
    sourceEntityId: project.id,
    migrationBatchId,
    copiedAt,
  };
}

/**
 * Copy a time entry into a target workspace.
 * Only unbilled / non-invoiced entries should be passed here (enforced by
 * the caller via data-type filtering).
 *
 * @param clientIdMap   Client id rewrite map from copyClient().
 * @param projectIdMap  Project id rewrite map from copyProject().
 */
export function copyTimeEntry(
  entry: TimeEntry,
  targetWorkspaceId: string,
  migrationBatchId: string,
  clientIdMap: Map<string, string>,
  projectIdMap: Map<string, string>,
): TimeEntry {
  const copiedAt = nowIso();
  return {
    ...entry,
    id: newId("te"),
    clientId: clientIdMap.get(entry.clientId) ?? entry.clientId,
    projectId: entry.projectId ? projectIdMap.get(entry.projectId) : undefined,
    workspaceId: targetWorkspaceId,
    // Reset invoice linkage — the copied entry starts fresh in the new workspace
    invoiced: false,
    invoiceId: null,
    status: "completed",
    sourceWorkspaceId: entry.workspaceId ?? entry.sourceWorkspaceId,
    sourceEntityId: entry.id,
    migrationBatchId,
    copiedAt,
  };
}

/**
 * Copy a draft invoice into a target workspace.
 * Only "draft" status invoices should be passed here.
 *
 * @param clientIdMap  Client id rewrite map from copyClient().
 */
export function copyInvoice(
  invoice: Invoice,
  targetWorkspaceId: string,
  migrationBatchId: string,
  clientIdMap: Map<string, string>,
): Invoice {
  const copiedAt = nowIso();
  return {
    ...invoice,
    id: newId("inv"),
    clientId: clientIdMap.get(invoice.clientId) ?? invoice.clientId,
    workspaceId: targetWorkspaceId,
    // Reset entry linkage — entry IDs changed during copy
    entryIds: [],
    timeEntryIds: [],
    status: "draft",
    issuedAt: undefined,
    paidAt: undefined,
    sourceWorkspaceId: invoice.workspaceId ?? invoice.sourceWorkspaceId,
    sourceEntityId: invoice.id,
    migrationBatchId,
    copiedAt,
  };
}

// ─── Input / output types ─────────────────────────────────────────────────────

/** Slice of application data available as migration source material. */
export interface MigrationSourceData {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
}

/** All entities produced by a single migration run. */
export interface MigrationResult {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
}

// ─── Migration runner ─────────────────────────────────────────────────────────

/**
 * Execute a copy-based migration and return the newly created entities.
 *
 * The caller is responsible for:
 *  1. Creating the target workspace record before calling this function.
 *  2. Appending the returned entities to the store.
 *  3. Updating the migration record's status to "completed" or "failed".
 *
 * Source data is never modified.
 */
export function runWorkspaceMigration(
  migration: WorkspaceMigration,
  source: MigrationSourceData,
): MigrationResult {
  const { targetWorkspaceId, selectedDataTypes, id: migrationBatchId } = migration;
  const types = new Set<WorkspaceMigrableDataType>(selectedDataTypes);

  const clientIdMap = new Map<string, string>();
  const projectIdMap = new Map<string, string>();

  // 1. Clients
  const newClients: Client[] = types.has("clients")
    ? source.clients.map((c) => copyClient(c, targetWorkspaceId, migrationBatchId, clientIdMap))
    : [];

  // 2. Projects (require clients to have been copied first for FK rewrite)
  const newProjects: Project[] = types.has("projects")
    ? source.projects.map((p) => {
        const copied = copyProject(p, targetWorkspaceId, migrationBatchId, clientIdMap);
        projectIdMap.set(p.id, copied.id);
        return copied;
      })
    : [];

  // 3. Unbilled time entries only
  const newTimeEntries: TimeEntry[] = types.has("unbilled_time_entries")
    ? source.timeEntries
        .filter((e) => !e.invoiced && e.status !== "invoiced")
        .map((e) =>
          copyTimeEntry(e, targetWorkspaceId, migrationBatchId, clientIdMap, projectIdMap),
        )
    : [];

  // 4. Draft invoices only (paid invoices excluded per spec)
  const newInvoices: Invoice[] = types.has("draft_invoices")
    ? source.invoices
        .filter((inv) => inv.status === "draft")
        .map((inv) =>
          copyInvoice(inv, targetWorkspaceId, migrationBatchId, clientIdMap),
        )
    : [];

  return {
    clients: newClients,
    projects: newProjects,
    timeEntries: newTimeEntries,
    invoices: newInvoices,
  };
}

// ─── Migration record builder ─────────────────────────────────────────────────

/** Create a fresh WorkspaceMigration record in "pending" status. */
export function buildMigration(
  sourceWorkspaceId: string,
  targetWorkspaceId: string,
  createdByUserId: string,
  selectedDataTypes: WorkspaceMigrableDataType[],
): WorkspaceMigration {
  return {
    id: newId("mig"),
    sourceWorkspaceId,
    targetWorkspaceId,
    createdByUserId,
    selectedDataTypes,
    status: "pending",
    createdAt: nowIso(),
  };
}

/** Return a copy of the migration with an updated status (and optional completedAt / error). */
export function updateMigrationStatus(
  migration: WorkspaceMigration,
  status: WorkspaceMigrationStatus,
  error?: string,
): WorkspaceMigration {
  return {
    ...migration,
    status,
    ...(status === "completed" || status === "failed" ? { completedAt: nowIso() } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}
