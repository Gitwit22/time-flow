import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from "date-fns";

import { getBillingPeriod, getInvoiceDueDate, toDate, toIsoDate } from "@/lib/date";
import type { AppSettings, Client, Invoice, InvoiceDraftPreview, TimeEntry, UserProfile } from "@/types";

interface BillingSummaryOptions {
  clientId?: string;
  end?: string | Date;
  excludeInvoicedEntries?: boolean;
  invoices?: Invoice[];
  start?: string | Date;
}

export interface RatedTimeEntry {
  amount: number;
  client: Client;
  entry: TimeEntry;
  hourlyRate: number;
}

export interface BillingSummary {
  lines: RatedTimeEntry[];
  missingRateClientNames: string[];
  missingRateEntries: TimeEntry[];
  totalAmount: number;
  totalHours: number;
}

export interface InvoiceDraftSummary {
  missingRateClientNames: string[];
  missingRateEntries: TimeEntry[];
  previews: InvoiceDraftPreview[];
}

function getDedupedEntries(entries: TimeEntry[]) {
  const seenEntryIds = new Set<string>();

  return entries.filter((entry) => {
    if (seenEntryIds.has(entry.id)) {
      return false;
    }

    seenEntryIds.add(entry.id);
    return true;
  });
}

function getInvoiceLinkedEntryIds(invoices: Invoice[]) {
  return new Set(invoices.flatMap((invoice) => invoice.entryIds));
}

function hasAssignedClientRate(client?: Client): client is Client & { hourlyRate: number } {
  return typeof client?.hourlyRate === "number" && Number.isFinite(client.hourlyRate) && client.hourlyRate > 0;
}

function isInSelectedRange(entry: TimeEntry, start?: string | Date, end?: string | Date) {
  if (!start || !end) {
    return true;
  }

  return isWithinInterval(parseISO(entry.date), {
    start: toDate(start),
    end: toDate(end),
  });
}

export function getBillingSummary(entries: TimeEntry[], clients: Client[], options: BillingSummaryOptions = {}): BillingSummary {
  const lines: RatedTimeEntry[] = [];
  const missingRateEntries: TimeEntry[] = [];
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const linkedEntryIds = options.excludeInvoicedEntries ? getInvoiceLinkedEntryIds(options.invoices ?? []) : undefined;

  getDedupedEntries(entries).forEach((entry) => {
    if (entry.status === "running") {
      return;
    }

    if (options.clientId && entry.clientId !== options.clientId) {
      return;
    }

    if (!isInSelectedRange(entry, options.start, options.end)) {
      return;
    }

    if (linkedEntryIds?.has(entry.id)) {
      return;
    }

    const client = clientById.get(entry.clientId);

    if (!hasAssignedClientRate(client)) {
      missingRateEntries.push(entry);
      return;
    }

    lines.push({
      amount: Number((entry.durationHours * client.hourlyRate).toFixed(2)),
      client,
      entry,
      hourlyRate: client.hourlyRate,
    });
  });

  const missingRateClientNames = Array.from(
    new Set(
      missingRateEntries.map((entry) => clientById.get(entry.clientId)?.name ?? "Unknown client"),
    ),
  );

  return {
    lines,
    missingRateClientNames,
    missingRateEntries,
    totalAmount: Number(lines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)),
    totalHours: Number(lines.reduce((sum, line) => sum + line.entry.durationHours, 0).toFixed(2)),
  };
}

export function buildInvoiceDraftSummary(
  entries: TimeEntry[],
  clients: Client[],
  currentUser: Pick<UserProfile, "invoiceDueDays" | "invoiceFrequency">,
  settings: AppSettings,
  invoices: Invoice[],
  referenceDate = new Date(),
  clientId?: string,
): InvoiceDraftSummary {
  const billingPeriod = getBillingPeriod(referenceDate, currentUser.invoiceFrequency);
  const dueDate = getInvoiceDueDate(billingPeriod.end, currentUser.invoiceDueDays);
  const summary = getBillingSummary(entries, clients, {
    clientId,
    end: billingPeriod.end,
    excludeInvoicedEntries: true,
    invoices,
    start: billingPeriod.start,
  });
  const groupedLines = new Map<string, RatedTimeEntry[]>();

  summary.lines.forEach((line) => {
    const existingLines = groupedLines.get(line.client.id) ?? [];
    existingLines.push(line);
    groupedLines.set(line.client.id, existingLines);
  });

  return {
    missingRateClientNames: summary.missingRateClientNames,
    missingRateEntries: summary.missingRateEntries,
    previews: Array.from(groupedLines.entries()).map(([groupClientId, grouped]) => ({
      clientId: groupClientId,
      clientName: grouped[0]?.client.name ?? "Unknown client",
      dueDate,
      entryIds: grouped.map((line) => line.entry.id),
      hourlyRate: grouped[0]?.hourlyRate ?? 0,
      periodEnd: toIsoDate(billingPeriod.end),
      periodStart: toIsoDate(billingPeriod.start),
      totalAmount: Number(grouped.reduce((sum, line) => sum + line.amount, 0).toFixed(2)),
      totalHours: Number(grouped.reduce((sum, line) => sum + line.entry.durationHours, 0).toFixed(2)),
    })),
  };
}

export function getMonthlyEarnings(entries: TimeEntry[], clients: Client[], referenceDate = new Date()) {
  return Array.from({ length: 6 }).map((_, index) => {
    const monthDate = subMonths(referenceDate, 5 - index);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const summary = getBillingSummary(entries, clients, { start, end });

    return {
      earnings: summary.totalAmount,
      month: format(monthDate, "MMM"),
    };
  });
}