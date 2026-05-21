import { isBefore, parseISO } from "date-fns";

import { buildInvoiceDraftSummary } from "@/lib/billing";
import { uniqueProjectIds } from "@/lib/projects";
import type { AppSettings, Client, EmailDraft, Invoice, InvoiceDisplayStatus, InvoiceDraftPreview, Project, TimeEntry, UserProfile } from "@/types";

export interface InvoiceProjectGroup {
  id: string;
  projectId?: string;
  projectName: string;
  lineItems: Invoice["lineItems"];
  subtotal: number;
  totalHours: number;
}

interface ProjectInvoicePreviewOptions {
  clientId: string;
  client: Client;
  projectId?: string;
  amount: number;
  dueDate: string;
  title?: string;
  sourceDescription?: string;
  invoiceSourceType?: Invoice["invoiceSourceType"];
}

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

/**
 * Create an invoice draft from a fixed bill amount, useful for consolidated project billing
 */
export function createFixedBillInvoicePreview(
  clientId: string,
  client: Client,
  billAmount: number,
  billTitle: string,
  projectId: string | undefined,
  dueDate: string,
): InvoiceDraftPreview {
  return createProjectInvoicePreview({
    amount: billAmount,
    client,
    clientId,
    dueDate,
    invoiceSourceType: projectId ? "manual_project" : "manual_client",
    projectId,
    sourceDescription: billTitle,
    title: billTitle,
  });
}

export function createProjectPartialInvoicePreview(options: ProjectInvoicePreviewOptions): InvoiceDraftPreview {
  return createProjectInvoicePreview({
    ...options,
    invoiceSourceType: options.invoiceSourceType ?? "partial_project",
  });
}

function createProjectInvoicePreview(options: ProjectInvoicePreviewOptions): InvoiceDraftPreview {
  const today = new Date().toISOString().split("T")[0];
  const lineDescription = options.title?.trim() || options.sourceDescription?.trim() || "Partial project invoice";
  const sourceDescription = options.sourceDescription?.trim() || lineDescription;

  return {
    billingMode: "range",
    clientId: options.clientId,
    clientName: options.client.name,
    dueDate: options.dueDate,
    entryIds: [],
    fixedBillingAmount: options.amount,
    invoiceSourceType: options.invoiceSourceType,
    timeEntryIds: [],
    lineItems: [
      {
        id: `fixed-${crypto.randomUUID()}`,
        description: lineDescription,
        date: today,
        hours: 0,
        lineType: "manual",
        rate: options.amount,
        amount: options.amount,
        projectId: options.projectId,
        expenseId: undefined,
        timeEntryIds: [],
      },
    ],
        projectId: options.projectId,
        projectIds: options.projectId ? [options.projectId] : [],
    sourceDescription,
    totalHours: 0,
    hourlyRate: 0,
    grouping: "none",
    periodStart: today,
    periodEnd: today,
    subtotal: options.amount,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: options.amount,
    hasMixedRates: false,
  };
}

export function getInvoiceSourceTypeLabel(invoice: Pick<Invoice, "invoiceSourceType">) {
  if (invoice.invoiceSourceType === "partial_project") {
    return "Partial Project Invoice";
  }

  if (invoice.invoiceSourceType === "manual_project") {
    return "Manual Project Invoice";
  }

  if (invoice.invoiceSourceType === "manual_client") {
    return "Manual Client Invoice";
  }

  if (invoice.invoiceSourceType === "expense_billback") {
    return "Expense Billback";
  }

  if (invoice.invoiceSourceType === "mixed") {
    return "Mixed Billing";
  }

  return "Time Entries";
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
      fixedBillingAmount: preview.fixedBillingAmount,
      dueDate: preview.dueDate,
      entryIds: preview.entryIds,
      grouping: preview.grouping ?? "none",
      hasMixedRates: preview.hasMixedRates,
      hourlyRate: preview.hourlyRate,
      id: nextInvoiceId(runningInvoices, referenceDate),
      invoiceSourceType: preview.invoiceSourceType,
      lineItems: preview.lineItems ?? [],
      periodEnd: preview.periodEnd,
      periodStart: preview.periodStart,
      projectId: preview.projectId,
      projectIds: preview.projectIds,
      rangeEnd: preview.rangeEnd,
      rangeStart: preview.rangeStart,
      sourceDescription: preview.sourceDescription,
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
    invoiceSourceType?: Invoice["invoiceSourceType"];
    projectId?: string;
    sourceDescription?: string;
    fixedBillingAmount?: number;
  }),
  entries: TimeEntry[] = [],
) {
  const normalizedStatus = invoice.status === "sent" ? "issued" : invoice.status ?? "draft";
  const linkedEntries = entries.filter((entry) => invoice.entryIds.includes(entry.id));
  const rates = Array.from(new Set(linkedEntries.map((entry) => entry.billingRate).filter((rate): rate is number => typeof rate === "number" && rate > 0)));
  const normalizedProjectIds = invoice.projectIds ?? uniqueProjectIds(linkedEntries);
  const hasExpenseOnlyLines = (invoice.lineItems ?? []).length > 0 && (invoice.lineItems ?? []).every((lineItem) => lineItem.lineType === "expense");
  const hasManualLines = (invoice.lineItems ?? []).some((lineItem) => lineItem.lineType === "manual");
  const inferredSourceType: Invoice["invoiceSourceType"] = invoice.invoiceSourceType
    ?? ((invoice.timeEntryIds ?? invoice.entryIds ?? []).length > 0
      ? "time_entries"
      : hasExpenseOnlyLines
        ? "expense_billback"
        : hasManualLines
          ? (normalizedProjectIds.length > 0 ? "manual_project" : "manual_client")
          : "time_entries");

  return {
    ...invoice,
    billingMode: invoice.billingMode ?? "range",
    createdAt: invoice.createdAt ?? invoice.issuedAt ?? new Date(invoice.periodEnd).toISOString(),
    fixedBillingAmount: invoice.fixedBillingAmount,
    grouping: invoice.grouping ?? "none",
    hasMixedRates: invoice.hasMixedRates ?? rates.length > 1,
    invoiceSourceType: inferredSourceType,
    lineItems: invoice.lineItems ?? [],
    projectId: invoice.projectId ?? normalizedProjectIds[0],
    projectIds: normalizedProjectIds,
    sourceDescription: invoice.sourceDescription,
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

export function groupInvoiceLaborByProject(
  lineItems: Invoice["lineItems"],
  entries: TimeEntry[],
  projects: Project[],
): InvoiceProjectGroup[] {
  const laborItems = lineItems.filter((lineItem) => lineItem.lineType !== "expense");
  const projectLookup = new Map(projects.map((project) => [project.id, project.name]));
  const entryProjectLookup = new Map(entries.map((entry) => [entry.id, entry.projectId]));
  const groups = new Map<string, InvoiceProjectGroup>();

  laborItems.forEach((lineItem) => {
    const projectId = lineItem.projectId
      ?? lineItem.timeEntryIds.map((timeEntryId) => entryProjectLookup.get(timeEntryId)).find((value): value is string => Boolean(value));
    const key = projectId ?? "__client-work__";
    const projectName = projectId
      ? (projectLookup.get(projectId) ?? "Unknown project")
      : "Client-level work";
    const existing = groups.get(key);

    if (existing) {
      existing.lineItems.push(lineItem);
      existing.subtotal = Number((existing.subtotal + lineItem.amount).toFixed(2));
      existing.totalHours = Number((existing.totalHours + lineItem.hours).toFixed(2));
      return;
    }

    groups.set(key, {
      id: key,
      projectId,
      projectName,
      lineItems: [lineItem],
      subtotal: Number(lineItem.amount.toFixed(2)),
      totalHours: Number(lineItem.hours.toFixed(2)),
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      lineItems: [...group.lineItems].sort((left, right) => left.date.localeCompare(right.date)),
    }))
    .sort((left, right) => {
      if (left.projectId && !right.projectId) {
        return 1;
      }
      if (!left.projectId && right.projectId) {
        return -1;
      }
      return left.projectName.localeCompare(right.projectName);
    });
}
