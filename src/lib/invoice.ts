import { isBefore, parseISO } from "date-fns";

import { buildInvoiceDraftSummary } from "@/lib/billing";
import { uniqueProjectIds } from "@/lib/projects";
import type { AppSettings, Client, EmailDraft, Invoice, InvoiceDisplayStatus, InvoiceDraftPreview, InvoiceLineItem, Project, TimeEntry, UserProfile } from "@/types";

const OVERDUE_STATUSES: ReadonlySet<Invoice["status"]> = new Set(["issued", "sent", "viewed", "partially_paid"]);

export function isInvoiceVoided(invoice: Pick<Invoice, "status">) {
  return invoice.status === "void";
}

export function isInvoicePaid(invoice: Pick<Invoice, "status">) {
  return invoice.status === "paid";
}

export function isInvoicePartiallyPaid(invoice: Pick<Invoice, "status">) {
  return invoice.status === "partially_paid";
}

export function isInvoiceFinalized(invoice: Pick<Invoice, "status">) {
  return invoice.status !== "draft";
}

export function canMoveInvoiceBackToDraft(invoice: Pick<Invoice, "status">) {
  return invoice.status === "issued" || invoice.status === "sent" || invoice.status === "viewed" || invoice.status === "revised";
}

export function canEditInvoiceDirectly(invoice: Pick<Invoice, "status">) {
  return invoice.status === "draft";
}

/**
 * Why an invoice's line items can't be edited, or undefined if they can.
 * Drafts edit in place; sent/unpaid invoices are reopened as drafts first.
 * Anything with money received stays locked (that needs a credit/adjustment).
 */
export function getInvoiceEditLockReason(
  invoice: Pick<Invoice, "status" | "paidAt" | "paidAmount">,
): string | undefined {
  if (invoice.status === "void") return "Void invoices can't be edited.";
  if (invoice.status === "paid" || invoice.status === "partially_paid" || invoice.paidAt || (invoice.paidAmount ?? 0) > 0) {
    return "Paid invoices are locked to protect your records.";
  }
  if (canEditInvoiceDirectly(invoice) || canMoveInvoiceBackToDraft(invoice)) return undefined;
  return "This invoice can't be edited.";
}

/** First problem with a set of edited line items, or undefined when they're valid. */
export function validateInvoiceLineItems(lineItems: InvoiceLineItem[]): string | undefined {
  if (lineItems.length === 0) return "An invoice needs at least one line.";
  for (const [index, line] of lineItems.entries()) {
    const label = `Line ${index + 1}`;
    if (!line.description.trim()) return `${label} needs a description.`;
    for (const [field, value] of [["Hours", line.hours], ["Rate", line.rate], ["Amount", line.amount]] as const) {
      if (!Number.isFinite(value) || value < 0) return `${label}: ${field.toLowerCase()} must be zero or more.`;
    }
  }
  return undefined;
}

export function getInvoiceBalanceDue(invoice: Pick<Invoice, "totalAmount" | "paidAmount" | "status">) {
  if (invoice.status === "paid") {
    return 0;
  }

  const paidAmount = Math.max(0, Number((invoice.paidAmount ?? 0).toFixed(2)));
  return Number(Math.max(0, invoice.totalAmount - paidAmount).toFixed(2));
}

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

export const DEFAULT_INVOICE_PREFIX = "INV";

const INVOICE_ID_PREFIX_PATTERN = /^(.+)-\d{4}-\d+$/;

/** The prefix of an id like "PPM-2026-001" ("PPM"), or undefined. */
export function getInvoiceIdPrefix(invoiceId: string): string | undefined {
  return INVOICE_ID_PREFIX_PATTERN.exec(invoiceId)?.[1];
}

/** Uppercase letters/digits only, 2–10 characters, or undefined if unusable. */
export function normalizeInvoicePrefix(value: string | undefined): string | undefined {
  const cleaned = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length >= 2 && cleaned.length <= 10 ? cleaned : undefined;
}

/** "Premiere Project Management" -> "PPM"; short names fall back to their first letters. */
export function invoicePrefixFromBusinessName(name: string | undefined): string | undefined {
  const words = (name ?? "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const initials = words.map((word) => word[0]).join("").slice(0, 4);
  return normalizeInvoicePrefix(initials) ?? normalizeInvoicePrefix(words.join("").slice(0, 3));
}

/**
 * Which prefix a business's next invoice uses: its configured prefix, else the
 * prefix its existing invoices already use (so established numbering never
 * changes), else its initials. Each business then numbers independently.
 */
export function resolveInvoicePrefix(params: {
  configuredPrefix?: string;
  businessName?: string;
  existingInvoices: Invoice[];
}): string {
  const configured = normalizeInvoicePrefix(params.configuredPrefix);
  if (configured && configured !== DEFAULT_INVOICE_PREFIX) return configured;

  const newestExisting = [...params.existingInvoices]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map((invoice) => getInvoiceIdPrefix(invoice.id))
    .find(Boolean);
  if (newestExisting) return newestExisting;

  // "INV" is only the wizard's default; a business without invoices of its own
  // gets its initials so its numbers don't run into another business's INV-…
  return invoicePrefixFromBusinessName(params.businessName) ?? DEFAULT_INVOICE_PREFIX;
}

export function nextInvoiceId(invoices: Invoice[], referenceDate = new Date(), invoicePrefix = DEFAULT_INVOICE_PREFIX) {
  const year = referenceDate.getFullYear();
  const prefix = `${invoicePrefix}-${year}-`;
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

export function materializeInvoiceDrafts(
  previews: InvoiceDraftPreview[],
  invoices: Invoice[],
  referenceDate = new Date(),
  invoicePrefix = DEFAULT_INVOICE_PREFIX,
) {
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
      id: nextInvoiceId(runningInvoices, referenceDate, invoicePrefix),
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
  if (OVERDUE_STATUSES.has(invoice.status) && isBefore(parseISO(invoice.dueDate), referenceDate)) {
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
  const normalizedStatus = invoice.status ?? "draft";
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

  const paidAmount = Math.max(0, Number(((invoice.paidAmount as number | undefined) ?? (normalizedStatus === "paid" ? invoice.totalAmount : 0)).toFixed(2)));
  const balanceDue = normalizedStatus === "paid" ? 0 : Number(Math.max(0, invoice.totalAmount - paidAmount).toFixed(2));

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
    paidAmount,
    balanceDue,
    originalInvoiceId: (invoice.originalInvoiceId as string | undefined) ?? undefined,
    revisionNumber: (invoice.revisionNumber as number | undefined) ?? undefined,
    voidedAt: (invoice.voidedAt as string | undefined) ?? undefined,
    voidReason: (invoice.voidReason as string | undefined) ?? undefined,
    movedBackToDraftAt: (invoice.movedBackToDraftAt as string | undefined) ?? undefined,
    lockedAt: (invoice.lockedAt as string | undefined) ?? undefined,
    viewedAt: (invoice.viewedAt as string | undefined) ?? undefined,
    auditLog: (invoice.auditLog as Invoice["auditLog"]) ?? [],
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
