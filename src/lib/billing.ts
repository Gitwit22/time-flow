import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from "date-fns";

import { getBillingPeriod, getInvoiceDueDate, toDate, toIsoDate } from "@/lib/date";
import { resolveTimeEntryBillingContext, uniqueProjectIds } from "@/lib/projects";
import type { AppSettings, Client, Invoice, InvoiceDraftPreview, Project, TimeEntry, UserProfile } from "@/types";

interface BillingSummaryOptions {
  clientId?: string;
  end?: string | Date;
  excludeInvoicedEntries?: boolean;
  invoices?: Invoice[];
  projectId?: string;
  start?: string | Date;
}

export interface RatedTimeEntry {
  amount: number;
  client: Client;
  entry: TimeEntry;
  hourlyRate: number;
  project?: Project;
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

function isInSelectedRange(entry: TimeEntry, start?: string | Date, end?: string | Date) {
  if (!start || !end) {
    return true;
  }

  return isWithinInterval(parseISO(entry.date), {
    start: toDate(start),
    end: toDate(end),
  });
}

export function getBillingSummary(entries: TimeEntry[], clients: Client[], projects: Project[], options: BillingSummaryOptions = {}): BillingSummary {
  const lines: RatedTimeEntry[] = [];
  const missingRateEntries: TimeEntry[] = [];
  const linkedEntryIds = options.excludeInvoicedEntries ? getInvoiceLinkedEntryIds(options.invoices ?? []) : undefined;

  getDedupedEntries(entries).forEach((entry) => {
    if (entry.status === "running") {
      return;
    }

    if (options.clientId && entry.clientId !== options.clientId) {
      return;
    }

    if (options.projectId && entry.projectId !== options.projectId) {
      return;
    }

    if (!isInSelectedRange(entry, options.start, options.end)) {
      return;
    }

    if (linkedEntryIds?.has(entry.id)) {
      return;
    }

    const context = resolveTimeEntryBillingContext(entry, clients, projects);
    const client = context.client;

    if (!client || !context.hourlyRate) {
      missingRateEntries.push(entry);
      return;
    }

    lines.push({
      amount: Number((entry.durationHours * context.hourlyRate).toFixed(2)),
      client,
      entry,
      hourlyRate: context.hourlyRate,
      project: context.project,
    });
  });

  const missingRateClientNames = Array.from(
    new Set(
      missingRateEntries.map((entry) => resolveTimeEntryBillingContext(entry, clients, projects).client?.name ?? "Unknown client"),
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
  projects: Project[],
  currentUser: Pick<UserProfile, "invoiceDueDays" | "invoiceFrequency">,
  settings: AppSettings,
  invoices: Invoice[],
  referenceDate = new Date(),
  clientId?: string,
): InvoiceDraftSummary {
  const billingPeriod = getBillingPeriod(referenceDate, currentUser.invoiceFrequency);
  const dueDate = getInvoiceDueDate(billingPeriod.end, currentUser.invoiceDueDays);
  const summary = getBillingSummary(entries, clients, projects, {
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
      hasMixedRates: new Set(grouped.map((line) => line.hourlyRate)).size > 1,
      hourlyRate: grouped[0]?.hourlyRate ?? 0,
      periodEnd: toIsoDate(billingPeriod.end),
      periodStart: toIsoDate(billingPeriod.start),
      projectIds: uniqueProjectIds(grouped.map((line) => line.entry)),
      totalAmount: Number(grouped.reduce((sum, line) => sum + line.amount, 0).toFixed(2)),
      totalHours: Number(grouped.reduce((sum, line) => sum + line.entry.durationHours, 0).toFixed(2)),
    })),
  };
}

export function getMonthlyEarnings(entries: TimeEntry[], clients: Client[], projects: Project[], referenceDate = new Date()) {
  return Array.from({ length: 6 }).map((_, index) => {
    const monthDate = subMonths(referenceDate, 5 - index);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const summary = getBillingSummary(entries, clients, projects, { start, end });

    return {
      earnings: summary.totalAmount,
      month: format(monthDate, "MMM"),
    };
  });
}