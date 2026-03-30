import { eachWeekOfInterval, endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths, subWeeks } from "date-fns";

import { getBillingPeriod, toIsoDate } from "@/lib/date";
import type { AppSettings, Client, Invoice, TimeEntry, UserProfile, WorkSession } from "@/types";

function isTrackedEntry(entry: TimeEntry) {
  return entry.status !== "running";
}

export function getTodaysHours(entries: TimeEntry[], today = new Date()) {
  const todayKey = toIsoDate(today);

  return entries
    .filter((entry) => entry.date === todayKey && isTrackedEntry(entry))
    .reduce((total, entry) => total + entry.durationHours, 0);
}

export function getPeriodHours(entries: TimeEntry[], start: string | Date, end: string | Date) {
  const startDate = parseISO(typeof start === "string" ? start : toIsoDate(start));
  const endDate = parseISO(typeof end === "string" ? end : toIsoDate(end));

  return entries
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
  invoices: Invoice[],
  referenceDate = new Date(),
) {
  const { start, end } = getBillingPeriod(referenceDate, currentUser.invoiceFrequency);
  const relevantEntries = entries.filter((entry) => {
    const withinPeriod = isWithinInterval(parseISO(entry.date), { start, end });
    const isDefaultClient = settings.defaultClientId ? entry.clientId === settings.defaultClientId : true;
    return entry.status === "completed" && withinPeriod && isDefaultClient;
  });

  if (!relevantEntries.length) {
    return null;
  }

  const grouped = new Map<string, TimeEntry[]>();

  relevantEntries.forEach((entry) => {
    const existing = grouped.get(entry.clientId) ?? [];
    existing.push(entry);
    grouped.set(entry.clientId, existing);
  });

  const [clientId, clientEntries] = grouped.entries().next().value as [string, TimeEntry[]];
  const totalHours = clientEntries.reduce((total, entry) => total + entry.durationHours, 0);
  const client = clients.find((c) => c.id === clientId);
  const hourlyRate = client?.hourlyRate ?? currentUser.hourlyRate;

  return {
    clientId,
    clientName: getClientName(clientId, clients),
    periodStart: toIsoDate(start),
    periodEnd: toIsoDate(end),
    totalHours,
    totalAmount: totalHours * hourlyRate,
    existingInvoiceCount: invoices.filter((invoice) => invoice.clientId === clientId).length,
  };
}

export function getWeeklyHours(entries: TimeEntry[], referenceDate = new Date()) {
  const start = subWeeks(referenceDate, 7);

  return eachWeekOfInterval({ start, end: referenceDate }, { weekStartsOn: 1 }).map((weekStart) => ({
    week: format(weekStart, "MMM d"),
    hours: getPeriodHours(entries, weekStart, subWeeks(weekStart, -1)),
  }));
}

export function getMonthlyEarnings(entries: TimeEntry[], rate: number, referenceDate = new Date()) {
  return Array.from({ length: 6 }).map((_, index) => {
    const monthDate = subMonths(referenceDate, 5 - index);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    return {
      month: format(monthDate, "MMM"),
      earnings: getPeriodEarnings(entries, rate, start, end),
    };
  });
}

export function getInvoiceStatusCounts(invoices: Invoice[], referenceDate = new Date()) {
  return invoices.reduce(
    (totals, invoice) => {
      if (invoice.status === "paid") {
        totals.paid += 1;
      } else if (invoice.status === "sent" && parseISO(invoice.dueDate) < referenceDate) {
        totals.overdue += 1;
      } else if (invoice.status === "sent") {
        totals.sent += 1;
      } else {
        totals.draft += 1;
      }

      return totals;
    },
    { paid: 0, sent: 0, overdue: 0, draft: 0 },
  );
}
