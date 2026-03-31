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
  dataUrl: string;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
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
  notes: string;
  status: "running" | "completed" | "invoiced";
}

export interface WorkSession {
  isActive: boolean;
  clientId?: string;
  projectId?: string;
  billingRate?: number;
  startedAt?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  dueDate: string;
  entryIds: string[];
  projectIds: string[];
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  hasMixedRates: boolean;
  status: "draft" | "issued" | "paid";
  issuedAt?: string;
  paidAt?: string;
}

export interface AppSettings {
  businessName: string;
  defaultClientId?: string;
  invoiceNotes: string;
  paymentInstructions: string;
  invoiceLogoDataUrl?: string;
  invoiceBannerDataUrl?: string;
  companyViewerAccess: boolean;
  emailTemplate: string;
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
  dueDate: string;
  entryIds: string[];
  projectIds: string[];
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  hasMixedRates: boolean;
}

export type InvoiceDisplayStatus = Invoice["status"] | "overdue";
