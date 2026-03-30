import { isBefore, parseISO } from "date-fns";

import { getBillingPeriod, getInvoiceDueDate, toIsoDate } from "@/lib/date";
import type { AppSettings, Client, EmailDraft, Invoice, InvoiceDisplayStatus, InvoiceDraftPreview, TimeEntry, UserProfile } from "@/types";

export function buildInvoiceDrafts(
  entries: TimeEntry[],
  clients: Client[],
  currentUser: UserProfile,
  settings: AppSettings,
  invoices: Invoice[],
  referenceDate = new Date(),
  clientId?: string,
) {
  const { start, end } = getBillingPeriod(referenceDate, currentUser.invoiceFrequency);
  const dueDate = getInvoiceDueDate(end, currentUser.invoiceDueDays);
  const groupedEntries = new Map<string, TimeEntry[]>();
  const alreadyInvoicedEntryIds = new Set(invoices.flatMap((invoice) => invoice.entryIds));

  entries
    .filter((entry) => {
      const inCurrentPeriod = entry.date >= toIsoDate(start) && entry.date <= toIsoDate(end);
      const matchesClient = clientId ? entry.clientId === clientId : true;
      const isBillableStatus = entry.status !== "running";
      const alreadyLinkedToInvoice = alreadyInvoicedEntryIds.has(entry.id);
      return isBillableStatus && !alreadyLinkedToInvoice && inCurrentPeriod && matchesClient;
    })
    .forEach((entry) => {
      const existing = groupedEntries.get(entry.clientId) ?? [];
      existing.push(entry);
      groupedEntries.set(entry.clientId, existing);
    });

  return Array.from(groupedEntries.entries()).map(([groupClientId, grouped]) => {
    const client = clients.find((item) => item.id === groupClientId);
    const totalHours = grouped.reduce((total, entry) => total + entry.durationHours, 0);
    const hourlyRate = client?.hourlyRate ?? currentUser.hourlyRate;

    return {
      clientId: groupClientId,
      clientName: client?.name ?? "Unknown client",
      periodStart: toIsoDate(start),
      periodEnd: toIsoDate(end),
      dueDate,
      entryIds: grouped.map((entry) => entry.id),
      totalHours,
      hourlyRate,
      totalAmount: totalHours * hourlyRate,
      notes: settings.invoiceNotes,
    };
  });
}

export function nextInvoiceId(invoices: Invoice[], referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const prefix = `INV-${year}-`;
  const currentMax = invoices
    .filter((invoice) => invoice.id.startsWith(prefix))
    .map((invoice) => Number(invoice.id.replace(prefix, "")))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `${prefix}${String(currentMax + 1).padStart(3, "0")}`;
}

export function materializeInvoiceDrafts(previews: InvoiceDraftPreview[], invoices: Invoice[], referenceDate = new Date()) {
  const nextInvoices: Invoice[] = [];
  let runningInvoices = [...invoices];

  previews.forEach((preview) => {
    const invoice: Invoice = {
      id: nextInvoiceId(runningInvoices, referenceDate),
      clientId: preview.clientId,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      dueDate: preview.dueDate,
      entryIds: preview.entryIds,
      totalHours: preview.totalHours,
      hourlyRate: preview.hourlyRate,
      totalAmount: preview.totalAmount,
      status: "draft",
    };

    runningInvoices = [...runningInvoices, invoice];
    nextInvoices.push(invoice);
  });

  return nextInvoices;
}

export function getInvoiceDisplayStatus(invoice: Invoice, referenceDate = new Date()): InvoiceDisplayStatus {
  if (invoice.status === "sent" && isBefore(parseISO(invoice.dueDate), referenceDate)) {
    return "overdue";
  }

  return invoice.status;
}

export function buildInvoiceEmailDraft(invoice: Invoice, client: Client | undefined, currentUser: UserProfile, settings: AppSettings): EmailDraft {
  const invoicePeriod = `${invoice.periodStart} to ${invoice.periodEnd}`;
  const clientName = client?.name ?? "Client";
  const subject = `Invoice ${invoice.id} | ${settings.businessName} | ${invoicePeriod}`;
  const template = settings.emailTemplate
    .replaceAll("{{contractorName}}", currentUser.name)
    .replaceAll("{{businessName}}", settings.businessName)
    .replaceAll("{{clientName}}", clientName)
    .replaceAll("{{invoiceNumber}}", invoice.id)
    .replaceAll("{{invoicePeriod}}", invoicePeriod)
    .replaceAll("{{dueDate}}", invoice.dueDate)
    .replaceAll("{{amount}}", invoice.totalAmount.toFixed(2));

  return {
    invoiceId: invoice.id,
    subject,
    body: template,
    readyToSend: false,
  };
}
