import { getBillingSummary } from "@/lib/billing";
import { getActiveStatus, getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { formatClockTime, getBillingPeriod } from "@/lib/date";
import type { AppState } from "@/store/appStore";

export function selectIsReadonly(state: AppState) {
  return state.currentUser.role === "client_viewer";
}

interface DashboardMetricsInput {
  clients: AppState["clients"];
  currentUser: Pick<AppState["currentUser"], "invoiceFrequency">;
  invoices: AppState["invoices"];
  timeEntries: AppState["timeEntries"];
  activeSession: AppState["activeSession"];
}

export function selectDashboardMetrics(input: DashboardMetricsInput, referenceDate = new Date()) {
  const billingPeriod = getBillingPeriod(referenceDate, input.currentUser.invoiceFrequency);
  const billingSummary = getBillingSummary(input.timeEntries, input.clients, {
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
