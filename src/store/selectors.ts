import { getActiveStatus, getPeriodEarnings, getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { formatClockTime, getBillingPeriod } from "@/lib/date";
import type { AppState } from "@/store/appStore";

export function selectIsReadonly(state: AppState) {
  return state.currentUser.role === "client_viewer";
}

interface DashboardMetricsInput {
  currentUser: Pick<AppState["currentUser"], "invoiceFrequency" | "hourlyRate">;
  timeEntries: AppState["timeEntries"];
  activeSession: AppState["activeSession"];
}

export function selectDashboardMetrics(input: DashboardMetricsInput, referenceDate = new Date()) {
  const billingPeriod = getBillingPeriod(referenceDate, input.currentUser.invoiceFrequency);
  const todayHours = getTodaysHours(input.timeEntries, referenceDate);
  const periodHours = getPeriodHours(input.timeEntries, billingPeriod.start, billingPeriod.end);
  const periodEarnings = getPeriodEarnings(input.timeEntries, input.currentUser.hourlyRate, billingPeriod.start, billingPeriod.end);
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
    periodEarnings,
    periodStart: billingPeriod.start,
    periodEnd: billingPeriod.end,
    recentEntries,
  };
}
