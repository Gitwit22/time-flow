import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from "date-fns";

import { getInvoiceDueDate, toDate, toIsoDate } from "@/lib/date";
import { getCurrentPayPeriod } from "@/lib/payPeriods";
import { resolveTimeEntryBillingContext, uniqueProjectIds } from "@/lib/projects";
import type { AppSettings, Client, Expense, ExpenseBillingTarget, Invoice, InvoiceBillingMode, InvoiceDraftPreview, InvoiceGrouping, InvoiceLineItem, Project, TimeEntry, UserProfile } from "@/types";

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
  const payPeriod = getCurrentPayPeriod(
    {
      payPeriodFrequency: settings.payPeriodFrequency ?? settings.invoiceFrequency ?? currentUser.invoiceFrequency,
      payPeriodStartDate: settings.payPeriodStartDate,
      periodWeekStartsOn: settings.periodWeekStartsOn,
    },
    referenceDate,
  );
  const dueDate = getInvoiceDueDate(payPeriod.endDate, currentUser.invoiceDueDays);
  const summary = getBillingSummary(entries, clients, projects, {
    clientId,
    end: payPeriod.endDate,
    excludeInvoicedEntries: true,
    invoices,
    start: payPeriod.startDate,
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
    previews: Array.from(groupedLines.entries()).map(([groupClientId, grouped]) => {
      const subtotal = Number(grouped.reduce((sum, line) => sum + line.amount, 0).toFixed(2));
      const entryIds = grouped.map((line) => line.entry.id);
      const lineItems: InvoiceLineItem[] = grouped.map((line, i) => ({
        id: `li-${i}`,
        description: line.entry.notes || (line.project ? line.project.name : line.client.name),
        date: line.entry.date,
        hours: line.entry.durationHours,
        rate: line.hourlyRate,
        amount: line.amount,
        timeEntryIds: [line.entry.id],
      }));
      return {
        billingMode: "range" as InvoiceBillingMode,
        clientId: groupClientId,
        clientName: grouped[0]?.client.name ?? "Unknown client",
        dueDate,
        entryIds,
        grouping: "none" as InvoiceGrouping,
        hasMixedRates: new Set(grouped.map((line) => line.hourlyRate)).size > 1,
        hourlyRate: grouped[0]?.hourlyRate ?? 0,
        lineItems,
        periodEnd: payPeriod.endDate,
        periodStart: payPeriod.startDate,
        projectIds: uniqueProjectIds(grouped.map((line) => line.entry)),
        rangeEnd: payPeriod.endDate,
        rangeStart: payPeriod.startDate,
        subtotal,
        taxAmount: 0,
        taxRate: 0,
        timeEntryIds: entryIds,
        totalAmount: subtotal,
        totalHours: Number(grouped.reduce((sum, line) => sum + line.entry.durationHours, 0).toFixed(2)),
      };
    }),
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

export interface SingleClientPreviewResult {
  preview: InvoiceDraftPreview | null;
  missingRateEntries: TimeEntry[];
}

function resolveExpenseBillingTarget(expense: Expense): ExpenseBillingTarget {
  return expense.billTo ?? (expense.projectId ? "project" : "client");
}

function getInvoicedExpenseIds(invoices: Invoice[]) {
  return new Set(
    invoices.flatMap((invoice) => invoice.lineItems.map((lineItem) => lineItem.expenseId).filter((expenseId): expenseId is string => Boolean(expenseId))),
  );
}

export function buildSingleClientInvoicePreview(
  allEntries: TimeEntry[],
  allExpenses: Expense[],
  clients: Client[],
  projects: Project[],
  invoices: Invoice[],
  clientId: string,
  billingMode: InvoiceBillingMode,
  dueDate: string,
  options: {
    rangeStart?: string;
    rangeEnd?: string;
    taxRate?: number;
    grouping?: InvoiceGrouping;
  } = {},
): SingleClientPreviewResult {
  const { rangeStart, rangeEnd, taxRate = 0, grouping = "none" } = options;
  const client = clients.find((c) => c.id === clientId);
  const invoicedExpenseIds = getInvoicedExpenseIds(invoices);

  if (!client) {
    return { preview: null, missingRateEntries: [] };
  }

  const candidateEntries = getDedupedEntries(allEntries).filter(
    (entry) =>
      entry.clientId === clientId &&
      entry.billable === true &&
      entry.status === "completed" &&
      entry.invoiced !== true &&
      entry.invoiceId === null,
  );

  const filtered =
    billingMode === "range" && rangeStart && rangeEnd
      ? candidateEntries.filter((entry) => isInSelectedRange(entry, rangeStart, rangeEnd))
      : candidateEntries;

  const lines: RatedTimeEntry[] = [];
  const missingRateEntries: TimeEntry[] = [];

  filtered.forEach((entry) => {
    const context = resolveTimeEntryBillingContext(entry, clients, projects);

    if (!context.hourlyRate) {
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

  const entryIds = lines.map((l) => l.entry.id);
  const totalHours = Number(lines.reduce((sum, l) => sum + l.entry.durationHours, 0).toFixed(2));
  const subtotal = Number(lines.reduce((sum, l) => sum + l.amount, 0).toFixed(2));
  const hasMixedRates = new Set(lines.map((l) => l.hourlyRate)).size > 1;
  const hourlyRate = lines[0]?.hourlyRate ?? 0;

  const lineItems: InvoiceLineItem[] = lines.map((l, i) => ({
    id: `li-${i}`,
    description: l.entry.notes || (l.project ? l.project.name : client.name),
    date: l.entry.date,
    hours: l.entry.durationHours,
    lineType: "time",
    rate: l.hourlyRate,
    amount: l.amount,
    timeEntryIds: [l.entry.id],
  }));

  const expenseLineItems: InvoiceLineItem[] = allExpenses
    .filter((expense) => !invoicedExpenseIds.has(expense.id))
    .filter((expense) => {
      const billTo = resolveExpenseBillingTarget(expense);
      if (billTo === "client") {
        return expense.clientId === clientId;
      }

      if (!expense.projectId) {
        return false;
      }

      const project = projects.find((item) => item.id === expense.projectId);
      return project?.clientId === clientId;
    })
    .filter((expense) => {
      if (billingMode !== "range" || !rangeStart || !rangeEnd) {
        return true;
      }

      return expense.date >= rangeStart && expense.date <= rangeEnd;
    })
    .map((expense, index) => ({
      id: `exp-${expense.id}-${index}`,
      description: expense.description || `Expense (${expense.category})`,
      date: expense.date,
      expenseId: expense.id,
      hours: 0,
      lineType: "expense",
      rate: 0,
      amount: Number(expense.amount.toFixed(2)),
      timeEntryIds: [],
    }));

  const allLineItems = [...lineItems, ...expenseLineItems].sort((left, right) => left.date.localeCompare(right.date));

  if (allLineItems.length === 0) {
    return { preview: null, missingRateEntries };
  }

  const sortedDates = allLineItems.map((item) => item.date).sort();
  const periodStart = sortedDates[0] ?? toIsoDate(new Date());
  const periodEnd = sortedDates[sortedDates.length - 1] ?? periodStart;

  const expenseTotal = Number(expenseLineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0).toFixed(2));
  const lineSubtotal = Number(subtotal + expenseTotal).toFixed(2);
  const subtotalWithExpenses = Number(lineSubtotal);
  const taxAmountWithExpenses = Number((subtotalWithExpenses * taxRate).toFixed(2));
  const totalAmountWithExpenses = Number((subtotalWithExpenses + taxAmountWithExpenses).toFixed(2));

  const preview: InvoiceDraftPreview = {
    billingMode,
    clientId,
    clientName: client.name,
    dueDate,
    entryIds,
    grouping,
    hasMixedRates,
    hourlyRate,
    lineItems: allLineItems,
    periodEnd,
    periodStart,
    projectIds: uniqueProjectIds(lines.map((l) => l.entry)),
    rangeEnd,
    rangeStart,
    subtotal: subtotalWithExpenses,
    taxAmount: taxAmountWithExpenses,
    taxRate,
    timeEntryIds: entryIds,
    totalAmount: totalAmountWithExpenses,
    totalHours,
  };

  return { preview, missingRateEntries };
}