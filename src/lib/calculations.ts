import { eachWeekOfInterval, endOfMonth, endOfWeek, format, isWithinInterval, parseISO, startOfMonth, subMonths, subWeeks } from "date-fns";

import { buildInvoiceDraftSummary } from "@/lib/billing";
import { getBillingPeriod, toIsoDate } from "@/lib/date";
import type { AppSettings, Client, Invoice, Project, TimeEntry, UserProfile, WorkSession } from "@/types";

function getTrackedEntries(entries: TimeEntry[]) {
  const seenEntryIds = new Set<string>();

  return entries.filter((entry) => {
    if (entry.status === "running" || seenEntryIds.has(entry.id)) {
      return false;
    }

    seenEntryIds.add(entry.id);
    return true;
  });
}

function isTrackedEntry(entry: TimeEntry) {
  return entry.status !== "running";
}

export function getTodaysHours(entries: TimeEntry[], today = new Date()) {
  const todayKey = toIsoDate(today);

  return getTrackedEntries(entries)
    .filter((entry) => entry.date === todayKey && isTrackedEntry(entry))
    .reduce((total, entry) => total + entry.durationHours, 0);
}

export function getPeriodHours(entries: TimeEntry[], start: string | Date, end: string | Date) {
  const startDate = parseISO(typeof start === "string" ? start : toIsoDate(start));
  const endDate = parseISO(typeof end === "string" ? end : toIsoDate(end));

  return getTrackedEntries(entries)
    .filter((entry) => {
      const entryDate = parseISO(entry.date);
      return isTrackedEntry(entry) && isWithinInterval(entryDate, { start: startDate, end: endDate });
    })
    .reduce((total, entry) => total + entry.durationHours, 0);
}

export function getPeriodEarnings(entries: TimeEntry[], rate: number, start?: string | Date, end?: string | Date) {
  const hours = start && end ? getPeriodHours(entries, start, end) : entries.filter(isTrackedEntry).reduce((total, entry) => total + entry.durationHours, 0);
  return hours * rate;
}

export function getActiveStatus(session: WorkSession) {
  return session.isActive ? "Clocked In" : "Ready";
}

export function getClientName(clientId: string, clients: Client[]) {
  return clients.find((client) => client.id === clientId)?.name ?? "Unknown client";
}

export function getUpcomingInvoice(
  entries: TimeEntry[],
  currentUser: UserProfile,
  settings: AppSettings,
  clients: Client[],
  projects: Project[],
  invoices: Invoice[],
  referenceDate = new Date(),
) {
  const invoiceDraftSummary = buildInvoiceDraftSummary(
    entries,
    clients,
    projects,
    currentUser,
    settings,
    invoices,
    referenceDate,
    settings.defaultClientId,
  );
  const [firstPreview] = invoiceDraftSummary.previews;

  if (!firstPreview) {
    return null;
  }

  return {
    ...firstPreview,
    existingInvoiceCount: invoices.filter((invoice) => invoice.clientId === firstPreview.clientId).length,
    missingRateClientNames: invoiceDraftSummary.missingRateClientNames,
  };
}

export function getWeeklyHours(entries: TimeEntry[], referenceDate = new Date()) {
  const start = subWeeks(referenceDate, 7);

  return eachWeekOfInterval({ start, end: referenceDate }, { weekStartsOn: 1 }).map((weekStart) => ({
    week: format(weekStart, "MMM d"),
    hours: getPeriodHours(entries, weekStart, endOfWeek(weekStart, { weekStartsOn: 1 })),
  }));
}

export function getInvoiceStatusCounts(invoices: Invoice[], referenceDate = new Date()) {
  return invoices.reduce(
    (totals, invoice) => {
      if (invoice.status === "paid") {
        totals.paid += 1;
      } else if (invoice.status === "issued" && parseISO(invoice.dueDate) < referenceDate) {
        totals.overdue += 1;
      } else if (invoice.status === "issued") {
        totals.issued += 1;
      } else {
        totals.draft += 1;
      }

      return totals;
    },
    { paid: 0, issued: 0, overdue: 0, draft: 0 },
  );
}
