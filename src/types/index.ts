export type UserRole = "contractor" | "client_viewer";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type ProjectBillingType = "hourly_uncapped" | "hourly_capped" | "fixed_fee";
export type ProjectCapHandling = "allow_overage" | "warn_only" | "block_billable";
export type AttachedDocumentStatus = "active" | "archived";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hourlyRate: number;
  invoiceFrequency: "weekly" | "biweekly" | "monthly";
  invoiceDueDays: number;
  currency: "USD";
}

export interface AttachedDocument {
  id: string;
  title: string;
  originalFilename: string;
  note?: string;
  uploadedBy: string;
  uploadedAt: string;
  status: AttachedDocumentStatus;
  mimeType: string;
  sizeBytes: number;
  /** base64 data URL — only set for pre-cloud / legacy documents */
  dataUrl: string;
  /** R2 object key — set when the document was uploaded via /api/upload */
  storageKey?: string;
}

export interface ClientContact {
  name: string;
  email: string;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contacts?: ClientContact[];
  hourlyRate?: number;
  companyViewerEnabled: boolean;
  documents: AttachedDocument[];
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  description: string;
  billingType: ProjectBillingType;
  hourlyRate: number;
  maxPayoutCap: number;
  capHandling: ProjectCapHandling;
  startDate: string;
  endDate?: string;
  notes: string;
  documents: AttachedDocument[];
}

export interface TimeEntry {
  id: string;
  clientId: string;
  projectId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationHours: number;
  billingRate?: number;
  billable: boolean;
  invoiced: boolean;
  invoiceId: string | null;
  notes: string;
  status: "running" | "completed" | "invoiced";
}

export type InvoiceBillingMode = "range" | "outstanding";
export type InvoiceGrouping = "none" | "day" | "week";

export interface InvoiceLineItem {
  id: string;
  description: string;
  date: string;
  hours: number;
  rate: number;
  amount: number;
  timeEntryIds: string[];
}

export interface WorkSession {
  isActive: boolean;
  isPaused?: boolean;
  clientId?: string;
  projectId?: string;
  billingRate?: number;
  startedAt?: string;
  pausedAt?: string;
  pausedDurationSeconds?: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  billingMode: InvoiceBillingMode;
  rangeStart?: string;
  rangeEnd?: string;
  grouping: InvoiceGrouping;
  createdAt: string;
  dueDate: string;
  entryIds: string[];
  timeEntryIds: string[];
  lineItems: InvoiceLineItem[];
  projectIds: string[];
  totalHours: number;
  hourlyRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  hasMixedRates: boolean;
  status: "draft" | "issued" | "sent" | "paid";
  issuedAt?: string;
  paidAt?: string;
}

export interface AppSettings {
  businessName: string;
  defaultClientId?: string;
  invoiceFrequency: "weekly" | "biweekly" | "monthly";
  invoiceNotes: string;
  paymentInstructions: string;
  invoiceLogoDataUrl?: string;
  invoiceBannerDataUrl?: string;
  companyViewerAccess: boolean;
  emailTemplate: string;
  /** Day the work week / period starts on. 0 = Sunday, 1 = Monday (default), …, 6 = Saturday */
  periodWeekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Target billable hours for the current period (0 = no target set) */
  periodTargetHours: number;
  /** Target earnings for the current period (0 = no target set) */
  periodTargetEarnings: number;
}

export interface EmailDraft {
  invoiceId: string;
  subject: string;
  body: string;
  readyToSend: boolean;
}

export interface InvoiceDraftPreview {
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  billingMode: InvoiceBillingMode;
  rangeStart?: string;
  rangeEnd?: string;
  grouping: InvoiceGrouping;
  dueDate: string;
  entryIds: string[];
  timeEntryIds: string[];
  lineItems: InvoiceLineItem[];
  projectIds: string[];
  totalHours: number;
  hourlyRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  hasMixedRates: boolean;
}

export type InvoiceDisplayStatus = Invoice["status"] | "overdue";
