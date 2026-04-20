import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  differenceInSeconds,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subWeeks,
} from "date-fns";
import type { WorkSession } from "@/types";

export function toDate(value: string | Date) {
  return value instanceof Date ? value : parseISO(value);
}

export function toIsoDate(value: string | Date) {
  return format(toDate(value), "yyyy-MM-dd");
}

export function toTimeValue(value: string | Date) {
  return format(toDate(value), "HH:mm");
}

export function formatLongDate(value: string | Date) {
  return format(toDate(value), "MMM d, yyyy");
}

export function formatShortDate(value: string | Date) {
  return format(toDate(value), "MMM d");
}

export function formatClockTime(value: string | Date) {
  return format(toDate(value), "h:mm a");
}

export function formatPeriodLabel(start: string | Date, end: string | Date) {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (isSameMonth(startDate, endDate) && isSameYear(startDate, endDate)) {
    return `${format(startDate, "MMM d")} - ${format(endDate, "d, yyyy")}`;
  }

  return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
}

export function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDurationFromSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function getElapsedSeconds(startedAt?: string, now = new Date()) {
  if (!startedAt) {
    return 0;
  }

  return differenceInSeconds(now, parseISO(startedAt));
}

export function getTrackedSessionSeconds(session: Pick<WorkSession, "startedAt" | "isPaused" | "pausedAt" | "pausedDurationSeconds">, now = new Date()) {
  if (!session.startedAt) {
    return 0;
  }

  const sessionEnd = session.isPaused && session.pausedAt ? parseISO(session.pausedAt) : now;
  const grossSeconds = differenceInSeconds(sessionEnd, parseISO(session.startedAt));
  const pausedSeconds = session.pausedDurationSeconds ?? 0;
  return Math.max(0, grossSeconds - pausedSeconds);
}

export function getBillingPeriod(referenceDate: Date, frequency: "weekly" | "biweekly" | "monthly", weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  if (frequency === "monthly") {
    return {
      start: startOfMonth(referenceDate),
      end: endOfMonth(referenceDate),
    };
  }

  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn });

  if (frequency === "weekly") {
    return {
      start: currentWeekStart,
      end: endOfWeek(referenceDate, { weekStartsOn }),
    };
  }

  const yearAnchor = startOfWeek(startOfYear(referenceDate), { weekStartsOn });
  const weekOffset = differenceInCalendarWeeks(currentWeekStart, yearAnchor, { weekStartsOn });
  const start = weekOffset % 2 === 0 ? currentWeekStart : subWeeks(currentWeekStart, 1);

  return {
    start,
    end: endOfWeek(addWeeks(start, 1), { weekStartsOn }),
  };
}

export function getInvoiceDueDate(periodEnd: string | Date, dueDays: number) {
  return toIsoDate(addDays(toDate(periodEnd), dueDays));
}
