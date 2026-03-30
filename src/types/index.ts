export type UserRole = "contractor" | "client_viewer";

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

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  companyViewerEnabled: boolean;
}

export interface TimeEntry {
  id: string;
  clientId: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationHours: number;
  notes: string;
  status: "running" | "completed" | "invoiced";
}

export interface WorkSession {
  isActive: boolean;
  clientId?: string;
  startedAt?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  entryIds: string[];
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: "draft" | "sent" | "paid";
}

export interface AppSettings {
  businessName: string;
  defaultClientId?: string;
  invoiceNotes: string;
  paymentInstructions: string;
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
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
}

export type InvoiceDisplayStatus = Invoice["status"] | "overdue";
