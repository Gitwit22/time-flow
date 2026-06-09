import { getBillingSummary } from "@/lib/billing";
import { getActiveStatus, getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { formatClockTime, getTrackedSessionSeconds, toIsoDate } from "@/lib/date";
import { isViewerLikeRole } from "@/lib/organization";
import { getCurrentPayPeriod, summarizePayPeriod } from "@/lib/payPeriods";
import { getEntryHours, getEntrySortKey } from "@/lib/timeEntries";
import type { AppState } from "@/store/appStore";
import type { Client, Expense, Invoice, Project, ProjectBill, TimeEntry } from "@/types";

export interface ActiveClockInRow {
  entryId: string;
  workerName: string;
  projectName: string;
  clientName: string;
  clockedInSince: string;
  durationLabel: string;
  durationMinutes: number;
  status: "Active";
}

interface ClientClockInVisibility {
  canViewActiveClockIns: boolean;
  canViewWorkerNames: boolean;
  canViewProjectNames: boolean;
  canViewLiveDuration: boolean;
}

function getClientClockInVisibility(client?: Client): ClientClockInVisibility {
  return {
    canViewActiveClockIns:
      client?.clientVisibility?.canViewActiveClockIns ??
      client?.canViewActiveClockIns ??
      true,
    canViewWorkerNames: client?.clientVisibility?.canViewWorkerNames ?? true,
    canViewProjectNames: client?.clientVisibility?.canViewProjectNames ?? true,
    canViewLiveDuration: client?.clientVisibility?.canViewLiveDuration ?? true,
  };
}

function isActiveTimeEntry(entry: TimeEntry) {
  const normalizedStatus = String(entry.status ?? "").toLowerCase();
  const hasClockIn = Boolean(entry.startTime);
  const hasClockOut = Boolean(entry.endTime);
  const activeStatus = normalizedStatus === "running" || normalizedStatus === "active" || normalizedStatus === "open";

  return hasClockIn && !hasClockOut && activeStatus;
}

function toClockInDate(entry: TimeEntry) {
  const candidate = new Date(`${entry.date}T${entry.startTime.length === 5 ? `${entry.startTime}:00` : entry.startTime}`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function formatDurationLabel(durationMinutes: number) {
  const safe = Math.max(0, durationMinutes);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function buildActiveClockInRow(
  entry: TimeEntry,
  projects: Project[],
  clients: Client[],
  currentUserName: string,
  now: Date,
): ActiveClockInRow | null {
  const clockInDate = toClockInDate(entry);
  if (!clockInDate) {
    return null;
  }

  const durationMinutes = Math.max(0, Math.floor((now.getTime() - clockInDate.getTime()) / (1000 * 60)));
  const project = entry.projectId ? projects.find((item) => item.id === entry.projectId) : undefined;
  const client = clients.find((item) => item.id === entry.clientId);

  return {
    entryId: entry.id,
    workerName: entry.workerName || currentUserName,
    projectName: project?.name ?? "Client-only task",
    clientName: client?.name ?? "Unknown client",
    clockedInSince: formatClockTime(clockInDate),
    durationLabel: formatDurationLabel(durationMinutes),
    durationMinutes,
    status: "Active",
  };
}

export function canClientViewActiveClockIns(client?: Client) {
  return getClientClockInVisibility(client).canViewActiveClockIns;
}

export function getActiveTimeEntriesForClient(
  clientId: string,
  timeEntries: TimeEntry[],
  projects: Project[],
  clients: Client[],
  options: {
    currentUserName: string;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();

  return timeEntries
    .filter((entry) => entry.clientId === clientId)
    .filter(isActiveTimeEntry)
    .filter((entry) => {
      if (!entry.projectId) {
        return true;
      }

      const project = projects.find((item) => item.id === entry.projectId);
      return Boolean(project && project.clientId === clientId);
    })
    .map((entry) => buildActiveClockInRow(entry, projects, clients, options.currentUserName, now))
    .filter((row): row is ActiveClockInRow => Boolean(row));
}

export function getActiveTimeEntries(
  timeEntries: TimeEntry[],
  projects: Project[],
  clients: Client[],
  options: {
    currentUserName: string;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();

  return timeEntries
    .filter(isActiveTimeEntry)
    .map((entry) => buildActiveClockInRow(entry, projects, clients, options.currentUserName, now))
    .filter((row): row is ActiveClockInRow => Boolean(row));
}

export function applyClientClockInVisibility(
  rows: ActiveClockInRow[],
  client?: Client,
) {
  const visibility = getClientClockInVisibility(client);

  if (!visibility.canViewActiveClockIns) {
    return [];
  }

  return rows.map((row) => ({
    ...row,
    workerName: visibility.canViewWorkerNames ? row.workerName : "Team Member",
    projectName: visibility.canViewProjectNames ? row.projectName : "Client Project",
    durationLabel: visibility.canViewLiveDuration ? row.durationLabel : "Active",
  }));
}

function resolveScopedViewerClientId(state: AppState) {
  if (!isViewerLikeRole(state.currentUser.role)) {
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
  return isViewerLikeRole(state.currentUser.role);
}

export function selectViewerScope(state: AppState) {
  const viewerClientId = resolveScopedViewerClientId(state);
  const activeClient = viewerClientId ? state.clients.find((client) => client.id === viewerClientId) : undefined;

  if (!isViewerLikeRole(state.currentUser.role)) {
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

export function selectOrganizationScope(state: AppState) {
  const activeWorkspaceId = state.activeOrganizationId;

  if (!activeWorkspaceId) {
    return {
      clients: state.clients,
      expenses: state.expenses,
      invoices: state.invoices,
      projectBills: state.projectBills,
      projects: state.projects,
      timeEntries: state.timeEntries,
    };
  }

  const clientsById = new Map(state.clients.map((client) => [client.id, client]));
  const projectsById = new Map(state.projects.map((project) => [project.id, project]));

  const resolveWorkspaceId = (record: {
    workspaceId?: string;
    organizationId?: string;
    clientId?: string;
    projectId?: string;
  }): string | undefined => {
    if (record.workspaceId) return record.workspaceId;
    if (record.organizationId) return record.organizationId;

    if (record.projectId) {
      const project = projectsById.get(record.projectId);
      if (project?.workspaceId) return project.workspaceId;
      if (project?.organizationId) return project.organizationId;
      if (project?.clientId) {
        const projectClient = clientsById.get(project.clientId);
        if (projectClient?.workspaceId) return projectClient.workspaceId;
        if (projectClient?.organizationId) return projectClient.organizationId;
      }
    }

    if (record.clientId) {
      const client = clientsById.get(record.clientId);
      if (client?.workspaceId) return client.workspaceId;
      if (client?.organizationId) return client.organizationId;
    }

    return undefined;
  };

  const isInActiveWorkspace = (record: {
    workspaceId?: string;
    organizationId?: string;
    clientId?: string;
    projectId?: string;
  }) => {
    const resolvedWorkspaceId = resolveWorkspaceId(record);
    if (resolvedWorkspaceId) {
      return resolvedWorkspaceId === activeWorkspaceId;
    }

    // Legacy records with no scoping metadata stay visible in the active workspace.
    return true;
  };

  return {
    clients: state.clients.filter((client) => isInActiveWorkspace(client)),
    expenses: state.expenses.filter((expense) => isInActiveWorkspace(expense)),
    invoices: state.invoices.filter((invoice) => isInActiveWorkspace(invoice)),
    projectBills: state.projectBills.filter((projectBill) => isInActiveWorkspace(projectBill)),
    projects: state.projects.filter((project) => isInActiveWorkspace(project)),
    timeEntries: state.timeEntries.filter((entry) => isInActiveWorkspace(entry)),
  };
}

export function selectWorkspaceClients(state: AppState): Client[] {
  return selectOrganizationScope(state).clients;
}

export function selectWorkspaceProjects(state: AppState): Project[] {
  return selectOrganizationScope(state).projects;
}

export function selectWorkspaceTimeEntries(state: AppState): TimeEntry[] {
  return selectOrganizationScope(state).timeEntries;
}

export function selectWorkspaceInvoices(state: AppState): Invoice[] {
  return selectOrganizationScope(state).invoices;
}

export function selectWorkspaceExpenses(state: AppState): Expense[] {
  return selectOrganizationScope(state).expenses;
}

interface DashboardMetricsInput {
  clients: AppState["clients"];
  currentUser: Pick<AppState["currentUser"], "invoiceFrequency">;
  invoices: AppState["invoices"];
  projects: AppState["projects"];
  timeEntries: AppState["timeEntries"];
  activeSession: AppState["activeSession"];
  expenses: AppState["expenses"];
  projectBills: AppState["projectBills"];
  settings: Pick<AppState["settings"], "invoiceFrequency" | "payPeriodFrequency" | "payPeriodStartDate" | "periodWeekStartsOn">;
}

export function selectDashboardMetrics(input: DashboardMetricsInput, referenceDate = new Date()) {
  const billingPeriod = getCurrentPayPeriod(
    {
      payPeriodFrequency: input.settings.payPeriodFrequency ?? input.settings.invoiceFrequency ?? input.currentUser.invoiceFrequency,
      payPeriodStartDate: input.settings.payPeriodStartDate,
      periodWeekStartsOn: input.settings.periodWeekStartsOn,
    },
    referenceDate,
  );
  const billingSummary = getBillingSummary(input.timeEntries, input.clients, input.projects, {
    end: billingPeriod.endDate,
    invoices: input.invoices,
    start: billingPeriod.startDate,
  });
  const payPeriodSummary = summarizePayPeriod({
    entries: billingSummary.lines.map((line) => ({
      amount: line.amount,
      date: line.entry.date,
      durationHours: getEntryHours(line.entry),
    })),
    expenses: input.expenses,
    invoices: input.invoices,
    period: billingPeriod,
  });
  const completedTodayHours = getTodaysHours(input.timeEntries, referenceDate);
  const liveSessionHours =
    input.activeSession.isActive &&
    input.activeSession.startedAt &&
    toIsoDate(new Date(input.activeSession.startedAt)) === toIsoDate(referenceDate)
      ? getTrackedSessionSeconds(input.activeSession, referenceDate) / 3600
      : 0;
  const todayHours = Number((completedTodayHours + liveSessionHours).toFixed(2));
  const periodHours = getPeriodHours(input.timeEntries, billingPeriod.startDate, billingPeriod.endDate);
  const periodProjectBills = input.projectBills.filter((bill: ProjectBill) => {
    if (bill.status === "void") {
      return false;
    }

    return bill.issueDate >= billingPeriod.startDate && bill.issueDate <= billingPeriod.endDate;
  });
  const periodProjectBillRevenue = Number(periodProjectBills.reduce((sum, bill) => sum + bill.amount, 0).toFixed(2));
  const status = getActiveStatus(input.activeSession);
  const statusSince =
    input.activeSession.isPaused && input.activeSession.pausedAt
      ? `Paused at ${formatClockTime(input.activeSession.pausedAt)}`
      : input.activeSession.startedAt
        ? `Since ${formatClockTime(input.activeSession.startedAt)}`
        : "No active session";

  const recentEntries = [...input.timeEntries]
    .filter((entry) => entry.status !== "running")
    .sort((a, b) => getEntrySortKey(b).localeCompare(getEntrySortKey(a)))
    .slice(0, 6);

  return {
    status,
    statusSince,
    todayHours,
    periodHours,
    periodEarnings: payPeriodSummary.timeEarnings,
    periodFixedBillRevenue: periodProjectBillRevenue,
    periodRevenue: Number((payPeriodSummary.timeEarnings + periodProjectBillRevenue).toFixed(2)),
    periodExpenses: payPeriodSummary.expenseTotal,
    periodInvoiceTotal: payPeriodSummary.invoiceTotal,
    periodNet: payPeriodSummary.netAmount,
    periodStart: billingPeriod.startDate,
    periodEnd: billingPeriod.endDate,
    payPeriodConfigured: Boolean(input.settings.payPeriodStartDate),
    recentEntries,
    unratedEntryCount: billingSummary.missingRateEntries.length,
  };
}
