import { getBillingSummary } from "@/lib/billing";
import { getActiveStatus, getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { formatClockTime, getBillingPeriod } from "@/lib/date";
import { getUserRoleInWorkspace } from "@/lib/workspace";
import type { AppState } from "@/store/appStore";
import type { Workspace, WorkspaceMember, WorkspaceMemberRole } from "@/types/workspace";

function resolveScopedViewerClientId(state: AppState) {
  if (state.currentUser.role !== "client_viewer") {
    return undefined;
  }

  if (state.viewerClientId && state.clients.some((client) => client.id === state.viewerClientId)) {
    return state.viewerClientId;
  }

  if (state.viewerClientLocked) {
    return undefined;
  }

  if (state.settings.defaultClientId && state.clients.some((client) => client.id === state.settings.defaultClientId)) {
    return state.settings.defaultClientId;
  }

  return state.clients[0]?.id;
}

export function selectIsReadonly(state: AppState) {
  return state.currentUser.role === "client_viewer";
}

export function selectViewerScope(state: AppState) {
  const viewerClientId = resolveScopedViewerClientId(state);
  const activeClient = viewerClientId ? state.clients.find((client) => client.id === viewerClientId) : undefined;

  if (state.currentUser.role !== "client_viewer") {
    return {
      activeClient: undefined,
      clients: state.clients,
      invoices: state.invoices,
      projects: state.projects,
      timeEntries: state.timeEntries,
      viewerClientId: undefined,
      viewerClientLocked: state.viewerClientLocked,
    };
  }

  if (!viewerClientId) {
    return {
      activeClient: undefined,
      clients: [],
      invoices: [],
      projects: [],
      timeEntries: [],
      viewerClientId: undefined,
      viewerClientLocked: state.viewerClientLocked,
    };
  }

  return {
    activeClient,
    clients: state.clients.filter((client) => client.id === viewerClientId),
    invoices: state.invoices.filter((invoice) => invoice.clientId === viewerClientId),
    projects: state.projects.filter((project) => project.clientId === viewerClientId),
    timeEntries: state.timeEntries.filter((entry) => entry.clientId === viewerClientId),
    viewerClientId,
    viewerClientLocked: state.viewerClientLocked,
  };
}

interface DashboardMetricsInput {
  clients: AppState["clients"];
  currentUser: Pick<AppState["currentUser"], "invoiceFrequency">;
  invoices: AppState["invoices"];
  projects: AppState["projects"];
  timeEntries: AppState["timeEntries"];
  activeSession: AppState["activeSession"];
  settings: Pick<AppState["settings"], "invoiceFrequency" | "periodWeekStartsOn">;
}

export function selectDashboardMetrics(input: DashboardMetricsInput, referenceDate = new Date()) {
  const billingFrequency = input.settings.invoiceFrequency ?? input.currentUser.invoiceFrequency;
  const billingPeriod = getBillingPeriod(referenceDate, billingFrequency, input.settings.periodWeekStartsOn);
  const billingSummary = getBillingSummary(input.timeEntries, input.clients, input.projects, {
    end: billingPeriod.end,
    invoices: input.invoices,
    start: billingPeriod.start,
  });
  const todayHours = getTodaysHours(input.timeEntries, referenceDate);
  const periodHours = getPeriodHours(input.timeEntries, billingPeriod.start, billingPeriod.end);
  const status = getActiveStatus(input.activeSession);
  const statusSince =
    input.activeSession.isPaused && input.activeSession.pausedAt
      ? `Paused at ${formatClockTime(input.activeSession.pausedAt)}`
      : input.activeSession.startedAt
        ? `Since ${formatClockTime(input.activeSession.startedAt)}`
        : "No active session";

  const recentEntries = [...input.timeEntries]
    .filter((entry) => entry.status !== "running")
    .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`))
    .slice(0, 6);

  return {
    status,
    statusSince,
    todayHours,
    periodHours,
    periodEarnings: billingSummary.totalAmount,
    periodStart: billingPeriod.start,
    periodEnd: billingPeriod.end,
    recentEntries,
    unratedEntryCount: billingSummary.missingRateEntries.length,
  };
}

// ─── Workspace-aware selectors ────────────────────────────────────────────────

/**
 * Return the currently active Workspace record, or undefined when no
 * workspace has been bootstrapped yet.
 *
 * [WORKSPACE-BRANCH] workspace switcher UI: display this in the nav bar
 *   to show the user which workspace is active.
 */
export function selectActiveWorkspace(state: AppState): Workspace | undefined {
  if (!state.activeWorkspaceId) return undefined;
  return state.workspaces.find(
    (ws) => ws.id === state.activeWorkspaceId && ws.status === "active",
  );
}

/**
 * Return all workspaces the current user owns or belongs to, filtered to
 * only active workspaces.
 *
 * [WORKSPACE-BRANCH] workspace switcher UI: render the list of workspaces
 *   the user can switch between.
 */
export function selectAccessibleWorkspaces(state: AppState): Workspace[] {
  const userId = state.currentUser.id;
  const memberWorkspaceIds = new Set(
    state.workspaceMembers
      .filter((m) => m.userId === userId)
      .map((m) => m.workspaceId),
  );
  return state.workspaces.filter(
    (ws) => ws.status === "active" && (ws.ownerUserId === userId || memberWorkspaceIds.has(ws.id)),
  );
}

/**
 * Return the calling user's role in the currently active workspace.
 * Returns undefined when there is no active workspace or the user has no
 * membership (e.g. during initial bootstrap).
 *
 * [WORKSPACE-BRANCH] company UI: use this to drive permission gating
 *   throughout the app once team roles are exposed in the UI.
 */
export function selectActiveWorkspaceRole(state: AppState): WorkspaceMemberRole | undefined {
  if (!state.activeWorkspaceId) return undefined;
  return getUserRoleInWorkspace(
    state.workspaceMembers,
    state.activeWorkspaceId,
    state.currentUser.id,
  );
}

/**
 * Return all membership records for the active workspace.
 *
 * [WORKSPACE-BRANCH] company UI: render the team-members list from this.
 */
export function selectActiveWorkspaceMembers(state: AppState): WorkspaceMember[] {
  if (!state.activeWorkspaceId) return [];
  return state.workspaceMembers.filter((m) => m.workspaceId === state.activeWorkspaceId);
}

/**
 * Return clients that belong to the active workspace.
 *
 * When no workspace is active (legacy / pre-bootstrap state) all clients
 * are returned so existing behaviour is preserved.
 *
 * [WORKSPACE-BRANCH] workspace-aware queries: switch from the raw
 *   state.clients array to this selector once workspaceId is reliably
 *   set on all records.
 */
export function selectWorkspaceClients(state: AppState) {
  if (!state.activeWorkspaceId) return state.clients;
  return state.clients.filter(
    (c) => !c.workspaceId || c.workspaceId === state.activeWorkspaceId,
  );
}

/** Return projects scoped to the active workspace (falls back to all). */
export function selectWorkspaceProjects(state: AppState) {
  if (!state.activeWorkspaceId) return state.projects;
  return state.projects.filter(
    (p) => !p.workspaceId || p.workspaceId === state.activeWorkspaceId,
  );
}

/** Return time entries scoped to the active workspace (falls back to all). */
export function selectWorkspaceTimeEntries(state: AppState) {
  if (!state.activeWorkspaceId) return state.timeEntries;
  return state.timeEntries.filter(
    (e) => !e.workspaceId || e.workspaceId === state.activeWorkspaceId,
  );
}

/** Return invoices scoped to the active workspace (falls back to all). */
export function selectWorkspaceInvoices(state: AppState) {
  if (!state.activeWorkspaceId) return state.invoices;
  return state.invoices.filter(
    (inv) => !inv.workspaceId || inv.workspaceId === state.activeWorkspaceId,
  );
}
