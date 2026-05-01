import { addDays, addMonths, isAfter, isBefore, isWithinInterval, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";

import { formatDateDisplay, formatPeriodLabel, toDate, toDateOnlyString } from "@/lib/date";
import type { PayPeriodFrequency } from "@/types";

export interface PayPeriodSettingsLike {
  payPeriodFrequency?: PayPeriodFrequency;
  payPeriodStartDate?: string;
  periodWeekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export interface PayPeriod {
  key: string;
  startDate: string;
  endDate: string;
  label: string;
}

interface DatedRecord {
  date: string;
}

interface SummarizeEntry extends DatedRecord {
  durationHours: number;
  amount?: number;
}

interface SummarizeExpense extends DatedRecord {
  amount: number;
  excludedFromPayPeriod?: boolean;
  includedInPayPeriod?: boolean;
}

interface SummarizeInvoice {
  createdAt?: string;
  dueDate?: string;
  periodEnd?: string;
  periodStart?: string;
  totalAmount: number;
}

const PAY_PERIOD_LENGTHS: Record<Exclude<PayPeriodFrequency, "monthly">, number> = {
  weekly: 7,
  biweekly: 14,
};

function getFrequency(settings: PayPeriodSettingsLike) {
  return settings.payPeriodFrequency ?? "monthly";
}

export function getDefaultPayPeriodStartDate(settings: Pick<PayPeriodSettingsLike, "payPeriodFrequency" | "periodWeekStartsOn"> = {}, referenceDate = new Date()) {
  const frequency = settings.payPeriodFrequency ?? "monthly";

  if (frequency === "monthly") {
    return toDateOnlyString(startOfMonth(referenceDate));
  }

  return toDateOnlyString(startOfWeek(referenceDate, { weekStartsOn: settings.periodWeekStartsOn ?? 1 }));
}

export function resolvePayPeriodSettings(settings: PayPeriodSettingsLike, referenceDate = new Date()) {
  const payPeriodFrequency = getFrequency(settings);
  const payPeriodStartDate = settings.payPeriodStartDate ?? getDefaultPayPeriodStartDate(settings, referenceDate);

  return {
    payPeriodFrequency,
    payPeriodStartDate,
    periodWeekStartsOn: settings.periodWeekStartsOn ?? 1,
  };
}

export function getPayPeriodKey(startDate: string, endDate: string) {
  return `${startDate}_${endDate}`;
}

function toPeriod(startDate: string, endDate: string): PayPeriod {
  return {
    key: getPayPeriodKey(startDate, endDate),
    startDate,
    endDate,
    label: formatPeriodLabel(startDate, endDate),
  };
}

function getAnchoredCycleStart(referenceDate: Date, anchorDate: Date, cycleLengthDays: number) {
  const reference = startOfDay(referenceDate);
  const anchor = startOfDay(anchorDate);
  const diffDays = Math.floor((reference.getTime() - anchor.getTime()) / 86400000);
  const completedCycles = Math.floor(diffDays / cycleLengthDays);
  return addDays(anchor, completedCycles * cycleLengthDays);
}

function getMonthlyCycleStart(referenceDate: Date, anchorDate: Date) {
  const reference = startOfDay(referenceDate);
  let monthsDelta = (reference.getFullYear() - anchorDate.getFullYear()) * 12 + (reference.getMonth() - anchorDate.getMonth());
  let cycleStart = addMonths(anchorDate, monthsDelta);

  while (isAfter(cycleStart, reference)) {
    monthsDelta -= 1;
    cycleStart = addMonths(anchorDate, monthsDelta);
  }

  while (!isAfter(addMonths(cycleStart, 1), reference)) {
    cycleStart = addMonths(cycleStart, 1);
  }

  return cycleStart;
}

function buildPayPeriod(start: Date, frequency: PayPeriodFrequency) {
  const end = frequency === "monthly" ? subDays(addMonths(start, 1), 1) : addDays(start, PAY_PERIOD_LENGTHS[frequency] - 1);
  return toPeriod(toDateOnlyString(start), toDateOnlyString(end));
}

export function getPayPeriodForDate(date: string | Date, settings: PayPeriodSettingsLike): PayPeriod {
  const normalized = resolvePayPeriodSettings(settings, typeof date === "string" ? toDate(date) : date);
  const referenceDate = startOfDay(toDate(date));
  const anchorDate = startOfDay(toDate(normalized.payPeriodStartDate));

  if (normalized.payPeriodFrequency === "monthly") {
    return buildPayPeriod(getMonthlyCycleStart(referenceDate, anchorDate), normalized.payPeriodFrequency);
  }

  return buildPayPeriod(
    getAnchoredCycleStart(referenceDate, anchorDate, PAY_PERIOD_LENGTHS[normalized.payPeriodFrequency]),
    normalized.payPeriodFrequency,
  );
}

export function getCurrentPayPeriod(settings: PayPeriodSettingsLike, referenceDate = new Date()) {
  return getPayPeriodForDate(referenceDate, settings);
}

export function getPreviousPayPeriod(period: PayPeriod, settings: PayPeriodSettingsLike) {
  const frequency = getFrequency(settings);
  const previousReference = frequency === "monthly" ? subDays(toDate(period.startDate), 1) : subDays(toDate(period.startDate), 1);
  return getPayPeriodForDate(previousReference, settings);
}

export function getNextPayPeriod(period: PayPeriod, settings: PayPeriodSettingsLike) {
  const nextReference = addDays(toDate(period.endDate), 1);
  return getPayPeriodForDate(nextReference, settings);
}

export function isDateInPayPeriod(date: string | Date, period: Pick<PayPeriod, "startDate" | "endDate">) {
  return isWithinInterval(toDate(date), {
    start: toDate(period.startDate),
    end: toDate(period.endDate),
  });
}

export function getEntriesForPayPeriod<TEntry extends DatedRecord>(entries: TEntry[], period: Pick<PayPeriod, "startDate" | "endDate">) {
  return entries.filter((entry) => isDateInPayPeriod(entry.date, period));
}

export function getExpensesForPayPeriod<TExpense extends SummarizeExpense>(expenses: TExpense[], period: Pick<PayPeriod, "startDate" | "endDate">) {
  return expenses.filter((expense) => {
    if (expense.excludedFromPayPeriod) {
      return false;
    }

    if (expense.includedInPayPeriod) {
      return true;
    }

    return isDateInPayPeriod(expense.date, period);
  });
}

function invoiceMatchesPeriod(invoice: SummarizeInvoice, period: Pick<PayPeriod, "startDate" | "endDate">) {
  if (invoice.periodStart && invoice.periodEnd) {
    return !(isBefore(toDate(invoice.periodEnd), toDate(period.startDate)) || isAfter(toDate(invoice.periodStart), toDate(period.endDate)));
  }

  if (invoice.createdAt) {
    return isDateInPayPeriod(invoice.createdAt, period);
  }

  if (invoice.dueDate) {
    return isDateInPayPeriod(invoice.dueDate, period);
  }

  return false;
}

export function summarizePayPeriod({
  entries,
  expenses,
  invoices,
  period,
}: {
  entries: SummarizeEntry[];
  expenses: SummarizeExpense[];
  invoices?: SummarizeInvoice[];
  period: Pick<PayPeriod, "startDate" | "endDate">;
}) {
  const periodEntries = getEntriesForPayPeriod(entries, period);
  const periodExpenses = getExpensesForPayPeriod(expenses, period);
  const periodInvoices = (invoices ?? []).filter((invoice) => invoiceMatchesPeriod(invoice, period));
  const timeEarnings = Number(
    periodEntries.reduce((sum, entry) => sum + (typeof entry.amount === "number" ? entry.amount : 0), 0).toFixed(2),
  );
  const expenseTotal = Number(periodExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
  const invoiceTotal = Number(periodInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0).toFixed(2));

  return {
    entries: periodEntries,
    expenses: periodExpenses,
    invoices: periodInvoices,
    expenseTotal,
    invoiceTotal,
    netAmount: Number((timeEarnings - expenseTotal).toFixed(2)),
    timeEarnings,
    totalHours: Number(periodEntries.reduce((sum, entry) => sum + entry.durationHours, 0).toFixed(2)),
  };
}

export function getPayPeriodRangeLabel(period: Pick<PayPeriod, "startDate" | "endDate">) {
  return `${formatDateDisplay(period.startDate)} - ${formatDateDisplay(period.endDate)}`;
}