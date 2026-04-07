import { isBefore, parseISO } from "date-fns";

import { buildInvoiceDraftSummary } from "@/lib/billing";
import { uniqueProjectIds } from "@/lib/projects";
import type { AppSettings, Client, EmailDraft, Invoice, InvoiceDisplayStatus, InvoiceDraftPreview, Project, TimeEntry, UserProfile } from "@/types";

export function buildInvoiceDrafts(
  entries: TimeEntry[],
  clients: Client[],
  projects: Project[],
  currentUser: UserProfile,
  settings: AppSettings,
  invoices: Invoice[],
  referenceDate = new Date(),
  clientId?: string,
) {
  return buildInvoiceDraftSummary(entries, clients, projects, currentUser, settings, invoices, referenceDate, clientId).previews;
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
  const createdAt = new Date().toISOString();

  previews.forEach((preview) => {
    const invoice: Invoice = {
      billingMode: preview.billingMode ?? "range",
      createdAt,
      clientId: preview.clientId,
      dueDate: preview.dueDate,
      entryIds: preview.entryIds,
      grouping: preview.grouping ?? "none",
      hasMixedRates: preview.hasMixedRates,
      hourlyRate: preview.hourlyRate,
      id: nextInvoiceId(runningInvoices, referenceDate),
      lineItems: preview.lineItems ?? [],
      periodEnd: preview.periodEnd,
      periodStart: preview.periodStart,
      projectIds: preview.projectIds,
      rangeEnd: preview.rangeEnd,
      rangeStart: preview.rangeStart,
      status: "draft",
      subtotal: preview.subtotal ?? preview.totalAmount,
      taxAmount: preview.taxAmount ?? 0,
      taxRate: preview.taxRate ?? 0,
      timeEntryIds: preview.timeEntryIds ?? preview.entryIds,
      totalAmount: preview.totalAmount,
      totalHours: preview.totalHours,
    };

    runningInvoices = [...runningInvoices, invoice];
    nextInvoices.push(invoice);
  });

  return nextInvoices;
}

export function getInvoiceDisplayStatus(invoice: Invoice, referenceDate = new Date()): InvoiceDisplayStatus {
  if (invoice.status === "issued" && isBefore(parseISO(invoice.dueDate), referenceDate)) {
    return "overdue";
  }

  return invoice.status;
}

export function normalizeInvoiceRecord(
  invoice: Invoice | (Omit<Invoice, "status" | "createdAt" | "projectIds" | "hasMixedRates" | "billingMode" | "grouping" | "lineItems" | "timeEntryIds" | "subtotal" | "taxRate" | "taxAmount"> & {
    createdAt?: string;
    status?: Invoice["status"] | "sent";
    projectIds?: string[];
    hasMixedRates?: boolean;
    billingMode?: Invoice["billingMode"];
    grouping?: Invoice["grouping"];
    lineItems?: Invoice["lineItems"];
    timeEntryIds?: string[];
    subtotal?: number;
    taxRate?: number;
    taxAmount?: number;
  }),
  entries: TimeEntry[] = [],
) {
  const normalizedStatus = invoice.status === "sent" ? "issued" : invoice.status ?? "draft";
  const linkedEntries = entries.filter((entry) => invoice.entryIds.includes(entry.id));
  const rates = Array.from(new Set(linkedEntries.map((entry) => entry.billingRate).filter((rate): rate is number => typeof rate === "number" && rate > 0)));

  return {
    ...invoice,
    billingMode: invoice.billingMode ?? "range",
    createdAt: invoice.createdAt ?? invoice.issuedAt ?? new Date(invoice.periodEnd).toISOString(),
    grouping: invoice.grouping ?? "none",
    hasMixedRates: invoice.hasMixedRates ?? rates.length > 1,
    lineItems: invoice.lineItems ?? [],
    projectIds: invoice.projectIds ?? uniqueProjectIds(linkedEntries),
    status: normalizedStatus,
    subtotal: invoice.subtotal ?? invoice.totalAmount ?? 0,
    taxAmount: invoice.taxAmount ?? 0,
    taxRate: invoice.taxRate ?? 0,
    timeEntryIds: invoice.timeEntryIds ?? invoice.entryIds ?? [],
  } as Invoice;
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
