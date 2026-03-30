import { getActiveStatus, getPeriodEarnings, getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { formatClockTime, getBillingPeriod } from "@/lib/date";
import type { AppState } from "@/store/appStore";

export function selectIsReadonly(state: AppState) {
  return state.currentUser.role === "client_viewer";
}

export function selectDashboardMetrics(state: AppState, referenceDate = new Date()) {
  const billingPeriod = getBillingPeriod(referenceDate, state.currentUser.invoiceFrequency);
  const todayHours = getTodaysHours(state.timeEntries, referenceDate);
  const periodHours = getPeriodHours(state.timeEntries, billingPeriod.start, billingPeriod.end);
  const periodEarnings = getPeriodEarnings(state.timeEntries, state.currentUser.hourlyRate, billingPeriod.start, billingPeriod.end);
  const status = getActiveStatus(state.activeSession);
  const statusSince = state.activeSession.startedAt ? `Since ${formatClockTime(state.activeSession.startedAt)}` : "No active session";

  const recentEntries = [...state.timeEntries]
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
