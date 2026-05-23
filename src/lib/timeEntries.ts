import type { TimeEntry } from "@/types";

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function getEntryType(entry: Pick<TimeEntry, "entryType">): "time" | "fixed" {
  return entry.entryType === "fixed" ? "fixed" : "time";
}

export function getEntryHours(entry: Pick<TimeEntry, "entryType" | "durationHours">): number {
  if (getEntryType(entry) === "fixed") {
    return 0;
  }

  const hours = typeof entry.durationHours === "number" && Number.isFinite(entry.durationHours)
    ? entry.durationHours
    : 0;
  return Math.max(0, roundCurrency(hours));
}

export function getEntryBillableAmount(
  entry: Pick<TimeEntry, "entryType" | "fixedAmount" | "durationHours" | "billingRate">,
  hourlyRate?: number,
): number {
  if (getEntryType(entry) === "fixed") {
    const fixedAmount = typeof entry.fixedAmount === "number" && Number.isFinite(entry.fixedAmount)
      ? entry.fixedAmount
      : 0;
    return Math.max(0, roundCurrency(fixedAmount));
  }

  const rate = typeof hourlyRate === "number"
    ? hourlyRate
    : typeof entry.billingRate === "number"
      ? entry.billingRate
      : 0;

  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  return roundCurrency(getEntryHours(entry) * rate);
}

export function getEntrySortKey(entry: Pick<TimeEntry, "date" | "startTime">): string {
  return `${entry.date}T${entry.startTime || "00:00"}`;
}
