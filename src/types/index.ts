export type UserRole = "owner" | "admin" | "manager" | "employee" | "viewer" | "contractor" | "client_viewer";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type ProjectBillingType = "hourly_uncapped" | "hourly_capped" | "fixed_fee";
export type ProjectInvoiceBillingType = "hourly" | "fixed" | "mixed";
export type ProjectCapHandling = "allow_overage" | "warn_only" | "block_billable";
export type AttachedDocumentStatus = "active" | "archived";
export type PayPeriodFrequency = "weekly" | "biweekly" | "monthly";
export type ExpenseBillingTarget = "client" | "project";
export type ExpenseStatus = "draft" | "billable" | "invoiced" | "reimbursed" | "non_billable";
export type ProjectBillStatus = "draft" | "issued" | "paid" | "void";
export type InvoiceSourceType = "time_entries" | "manual_project" | "partial_project" | "expense_billback" | "mixed";
export type OrganizationStatus = "active" | "archived";
export type OrganizationMemberRole = "owner" | "admin" | "manager" | "employee" | "viewer";
export type OrganizationMemberStatus = "invited" | "active" | "disabled";
export type EmployeeType = "employee" | "contractor" | "volunteer";
export type ProjectAssignmentRole = "worker" | "lead" | "manager";
export type TimeEntryStatus =
  | "running"
  | "active"
  | "open"
  | "completed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "invoiced"
  | "paid"
  | "voided";

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  status: OrganizationStatus;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId?: string;
  email: string;
  name: string;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  invitedAt?: string;
  joinedAt?: string;
}

export interface EmployeeProfile {
  memberId: string;
  organizationId: string;
  displayName: string;
  email: string;
  phone?: string;
  employeeType: EmployeeType;
  defaultHourlyRate?: number;
  payPeriodType?: PayPeriodFrequency;
  canClockIn: boolean;
  active: boolean;
}

export interface ProjectAssignment {
  id: string;
  organizationId: string;
  projectId: string;
  memberId: string;
  roleOnProject?: ProjectAssignmentRole;
  active: boolean;
}

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
  organizationId?: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contacts?: ClientContact[];
  hourlyRate?: number;
  companyViewerEnabled: boolean;
  canViewActiveClockIns?: boolean;
  clientVisibility?: {
    canViewActiveClockIns?: boolean;
    canViewWorkerNames?: boolean;
    canViewProjectNames?: boolean;
    canViewLiveDuration?: boolean;
  };
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  documents: AttachedDocument[];
}

export interface Project {
  id: string;
  organizationId?: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  description: string;
  billingType: ProjectBillingType;
  hourlyRate: number;
  maxPayoutCap: number;
  capHandling: ProjectCapHandling;
  projectBillingType?: ProjectInvoiceBillingType;
  fixedProjectAmount?: number;
  billingNotes?: string;
  startDate: string;
  endDate?: string;
  notes: string;
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  documents: AttachedDocument[];
}

export interface ProjectBill {
  id: string;
  organizationId?: string;
  projectId: string;
  clientId: string;
  title: string;
  amount: number;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  status: ProjectBillStatus;
  paidAt?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  organizationId?: string;
  employeeMemberId?: string;
  userId?: string;
  clientId: string;
  projectId?: string;
  workerName?: string;
  date: string;
  startTime: string;
  endTime?: string;
  clockInAt?: string;
  clockOutAt?: string;
  durationMinutes?: number;
  durationHours: number;
  billingRate?: number;
  billable: boolean;
  invoiced: boolean;
  invoiceId: string | null;
  notes: string;
  status: TimeEntryStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Expense {
  id: string;
  organizationId?: string;
  amount: number;
  category: "travel" | "software" | "meals" | "supplies" | "other";
  billableToClient?: boolean;
  billTo?: ExpenseBillingTarget;
  clientId?: string;
  date: string;
  description: string;
  excludedFromPayPeriod?: boolean;
  includedInPayPeriod?: boolean;
  invoiceId?: string | null;
  notes: string;
  projectId?: string;
  receiptAttached?: boolean;
  status?: ExpenseStatus;
  vendor?: string;
}

export type InvoiceBillingMode = "range" | "outstanding";
export type InvoiceGrouping = "none" | "day" | "week";

export interface InvoiceLineItem {
  id: string;
  description: string;
  date: string;
  hours: number;
  lineType?: "time" | "expense" | "manual";
  rate: number;
  amount: number;
  projectId?: string;
  expenseId?: string;
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
  organizationId?: string;
  clientId: string;
  projectId?: string;
  invoiceSourceType?: InvoiceSourceType;
  sourceDescription?: string;
  fixedBillingAmount?: number;
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
  payPeriodFrequency: PayPeriodFrequency;
  payPeriodStartDate?: string;
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
  projectId?: string;
  invoiceSourceType?: InvoiceSourceType;
  sourceDescription?: string;
  fixedBillingAmount?: number;
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
