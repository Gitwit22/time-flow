import { getBillingSummary } from "@/lib/billing";
import { getActiveStatus, getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { formatClockTime, getBillingPeriod } from "@/lib/date";
import type { AppState } from "@/store/appStore";

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
}

export function selectDashboardMetrics(input: DashboardMetricsInput, referenceDate = new Date()) {
  const billingPeriod = getBillingPeriod(referenceDate, input.currentUser.invoiceFrequency);
  const billingSummary = getBillingSummary(input.timeEntries, input.clients, input.projects, {
    end: billingPeriod.end,
    invoices: input.invoices,
    start: billingPeriod.start,
  });
  const todayHours = getTodaysHours(input.timeEntries, referenceDate);
  const periodHours = getPeriodHours(input.timeEntries, billingPeriod.start, billingPeriod.end);
  const status = getActiveStatus(input.activeSession);
  const statusSince = input.activeSession.startedAt ? `Since ${formatClockTime(input.activeSession.startedAt)}` : "No active session";

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
