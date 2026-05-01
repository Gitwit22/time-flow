/**
 * TimeFlow API client — all backend CRUD operations.
 * Uses the active auth token (local or platform) for every request.
 */
import { getActiveAuthToken } from "@/lib/auth";
import { getPlatformSession, TIMEFLOW_API_BASE } from "@/lib/platformApi";
import type {
  AppSettings,
  Client,
  Invoice,
  InvoiceDraftPreview,
  InvoiceLineItem,
  Project,
  TimeEntry,
} from "@/types";

type ApiRecord = Record<string, unknown>;

function buildHeaders(): HeadersInit {
  const token = getActiveAuthToken() ?? getPlatformSession()?.token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${TIMEFLOW_API_BASE}/api/timeflow${path}`, {
    method,
    credentials: "include",
    headers: buildHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as ApiRecord;
  if (!res.ok) throw new Error((data.error as string) || `Request failed: ${res.status}`);
  return data as T;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function toClient(r: ApiRecord): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    contactName: (r.contactName as string) ?? undefined,
    contactEmail: (r.contactEmail as string) ?? undefined,
    contacts: (r.contacts as Client["contacts"]) ?? [],
    hourlyRate: r.hourlyRate != null ? (r.hourlyRate as number) : undefined,
    companyViewerEnabled: r.companyViewerEnabled === true,
    documents: [],
  };
}

export function toProject(r: ApiRecord): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    clientId: r.clientId as string,
    status: r.status as Project["status"],
    description: (r.description as string) || "",
    billingType: r.billingType as Project["billingType"],
    hourlyRate: (r.hourlyRate as number) || 0,
    maxPayoutCap: (r.maxPayoutCap as number) || 0,
    capHandling: r.capHandling as Project["capHandling"],
    startDate: r.startDate as string,
    endDate: (r.endDate as string) ?? undefined,
    notes: (r.notes as string) || "",
    documents: [],
  };
}

export function toTimeEntry(r: ApiRecord): TimeEntry {
  return {
    id: r.id as string,
    clientId: r.clientId as string,
    projectId: (r.projectId as string) ?? undefined,
    date: r.date as string,
    startTime: r.startTime as string,
    endTime: (r.endTime as string) ?? undefined,
    durationHours: (r.durationHours as number) || 0,
    billingRate: r.billingRate != null ? (r.billingRate as number) : undefined,
    billable: r.billable !== false,
    invoiced: r.invoiced === true,
    invoiceId: (r.invoiceId as string) || null,
    notes: (r.notes as string) || "",
    status: r.status as TimeEntry["status"],
  };
}

export function toInvoice(r: ApiRecord): Invoice {
  return {
    id: r.id as string,
    clientId: r.clientId as string,
    periodStart: (r.periodStart as string) || "",
    periodEnd: (r.periodEnd as string) || "",
    billingMode: r.billingMode as Invoice["billingMode"],
    rangeStart: (r.rangeStart as string) ?? undefined,
    rangeEnd: (r.rangeEnd as string) ?? undefined,
    grouping: (r.grouping as Invoice["grouping"]) || "none",
    dueDate: (r.dueDate as string) || "",
    entryIds: (r.entryIds as string[]) || [],
    timeEntryIds: (r.timeEntryIds as string[]) || [],
    lineItems: (r.lineItems as InvoiceLineItem[]) || [],
    projectIds: (r.projectIds as string[]) || [],
    totalHours: (r.totalHours as number) || 0,
    hourlyRate: (r.hourlyRate as number) || 0,
    subtotal: (r.subtotal as number) || 0,
    taxRate: (r.taxRate as number) || 0,
    taxAmount: (r.taxAmount as number) || 0,
    totalAmount: (r.totalAmount as number) || 0,
    hasMixedRates: r.hasMixedRates === true,
    status: (r.status as Invoice["status"]) || "draft",
    issuedAt: (r.issuedAt as string) ?? undefined,
    paidAt: (r.paidAt as string) ?? undefined,
    createdAt: (r.createdAt as string) || new Date().toISOString(),
  };
}

export function toSettings(r: ApiRecord): AppSettings {
  const invoiceFrequency = ((r.invoiceFrequency as AppSettings["invoiceFrequency"]) ?? "monthly");

  return {
    businessName: (r.businessName as string) || "",
    defaultClientId: (r.defaultClientId as string) ?? undefined,
    invoiceFrequency,
    invoiceNotes: (r.invoiceNotes as string) || "",
    paymentInstructions: (r.paymentInstructions as string) || "",
    invoiceLogoDataUrl: (r.invoiceLogoDataUrl as string) ?? undefined,
    invoiceBannerDataUrl: (r.invoiceBannerDataUrl as string) ?? undefined,
    companyViewerAccess: r.companyViewerAccess === true,
    emailTemplate: (r.emailTemplate as string) || "",
    payPeriodFrequency: ((r.payPeriodFrequency as AppSettings["payPeriodFrequency"]) ?? invoiceFrequency),
    payPeriodStartDate: (r.payPeriodStartDate as string) ?? undefined,
    periodWeekStartsOn: ((r.periodWeekStartsOn as number) ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    periodTargetHours: (r.periodTargetHours as number) ?? 0,
    periodTargetEarnings: (r.periodTargetEarnings as number) ?? 0,
  };
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export const apiListClients = () =>
  apiRequest<ApiRecord[]>("GET", "/clients").then((rs) => rs.map(toClient));

export const apiCreateClient = (data: Pick<Client, "id"> & Omit<Client, "documents">) =>
  apiRequest<ApiRecord>("POST", "/clients", data).then(toClient);

export const apiUpdateClient = (id: string, data: Partial<Omit<Client, "id" | "documents">>) =>
  apiRequest<ApiRecord>("PUT", `/clients/${id}`, data).then(toClient);

export const apiDeleteClient = (id: string) =>
  apiRequest<void>("DELETE", `/clients/${id}`);

// ─── Projects ─────────────────────────────────────────────────────────────────

export const apiListProjects = () =>
  apiRequest<ApiRecord[]>("GET", "/projects").then((rs) => rs.map(toProject));

export const apiCreateProject = (data: Pick<Project, "id"> & Omit<Project, "documents">) =>
  apiRequest<ApiRecord>("POST", "/projects", data).then(toProject);

export const apiUpdateProject = (id: string, data: Partial<Omit<Project, "id" | "documents">>) =>
  apiRequest<ApiRecord>("PUT", `/projects/${id}`, data).then(toProject);

export const apiDeleteProject = (id: string) =>
  apiRequest<void>("DELETE", `/projects/${id}`);

// ─── Time entries ─────────────────────────────────────────────────────────────

export const apiListTimeEntries = () =>
  apiRequest<ApiRecord[]>("GET", "/time-entries").then((rs) => rs.map(toTimeEntry));

export const apiCreateTimeEntry = (data: Pick<TimeEntry, "id"> & Omit<TimeEntry, "id">) =>
  apiRequest<ApiRecord>("POST", "/time-entries", data).then(toTimeEntry);

export const apiUpdateTimeEntry = (id: string, data: Partial<Omit<TimeEntry, "id">>) =>
  apiRequest<ApiRecord>("PUT", `/time-entries/${id}`, data).then(toTimeEntry);

export const apiDeleteTimeEntry = (id: string) =>
  apiRequest<void>("DELETE", `/time-entries/${id}`);

export const apiBulkUpdateTimeEntries = (
  ids: string[],
  data: { invoiced?: boolean; invoiceId?: string | null; status?: string },
) => apiRequest<{ updated: number }>("PATCH", "/time-entries/bulk", { ids, ...data });

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const apiListInvoices = () =>
  apiRequest<ApiRecord[]>("GET", "/invoices").then((rs) => rs.map(toInvoice));

export const apiCreateInvoice = (id: string, data: InvoiceDraftPreview) =>
  apiRequest<ApiRecord>("POST", "/invoices", { id, ...data }).then(toInvoice);

export const apiUpdateInvoice = (id: string, data: Partial<Invoice>) =>
  apiRequest<ApiRecord>("PUT", `/invoices/${id}`, data).then(toInvoice);

export const apiDeleteInvoice = (id: string) =>
  apiRequest<void>("DELETE", `/invoices/${id}`);

// ─── Settings ─────────────────────────────────────────────────────────────────

export const apiGetSettings = () =>
  apiRequest<ApiRecord>("GET", "/settings").then(toSettings);

export const apiSaveSettings = (data: Partial<AppSettings>) =>
  apiRequest<ApiRecord>("PUT", "/settings", data).then(toSettings);

// ─── Bulk hydration ───────────────────────────────────────────────────────────

export interface TimeflowAllData {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  settings: AppSettings;
}

export async function apiHydrateAll(): Promise<TimeflowAllData> {
  const [clients, projects, timeEntries, invoices, settings] = await Promise.all([
    apiListClients(),
    apiListProjects(),
    apiListTimeEntries(),
    apiListInvoices(),
    apiGetSettings(),
  ]);
  return { clients, projects, timeEntries, invoices, settings };
}
