import { create } from "zustand";
import { toast } from "sonner";

import { createFixedBillInvoicePreview, createProjectPartialInvoicePreview, materializeInvoiceDrafts, normalizeInvoiceRecord } from "@/lib/invoice";
import { getTrackedSessionSeconds } from "@/lib/date";
import { normalizeOrganizationRole } from "@/lib/organization";
import { getProjectBillingSnapshot, normalizeTimeEntryRecord } from "@/lib/projects";
import { clearPersistedActiveSession, persistActiveSession, readPersistedActiveSession } from "@/lib/storage";
import {
  apiArchiveClient,
  apiArchiveProject,
  apiCreateClient,
  apiUpdateClient,
  apiDeleteClient,
  apiCreateProject,
  apiCreateProjectBill,
  apiUpdateProject,
  apiUpdateProjectBill as apiUpdateProjectBillRequest,
  apiDeleteProject,
  apiDeleteProjectBill,
  apiRestoreClient,
  apiRestoreProject,
  apiCreateTimeEntry,
  apiUpdateTimeEntry,
  apiDeleteTimeEntry,
  apiBulkUpdateTimeEntries,
  apiCreateExpense,
  apiUpdateExpense as apiUpdateExpenseRequest,
  apiDeleteExpense as apiDeleteExpenseRequest,
  apiCreateInvoice,
  apiUpdateInvoice,
  apiDeleteInvoice,
  apiSaveSettings,
  apiHydrateAll,
} from "@/lib/timeflowApi";
import type {
  AppSettings,
  AttachedDocument,
  Client,
  EmailDraft,
  Expense,
  Invoice,
  InvoiceDraftPreview,
  Organization,
  OrganizationMember,
  ProjectBill,
  ProjectAssignment,
  Project,
  EmployeeProfile,
  TimeEntry,
  UserProfile,
  UserRole,
  WorkSession,
} from "@/types";

type TimeEntryDraft = Omit<TimeEntry, "id" | "status" | "durationHours"> & {
  durationHours?: number;
  status?: TimeEntry["status"];
};
type ClientDraft = Omit<Client, "id">;
type ProjectDraft = Omit<Project, "id">;
type ProjectBillDraft = Omit<ProjectBill, "id" | "createdAt" | "updatedAt" | "status" | "paidAt" | "voidedAt"> & {
  status?: ProjectBill["status"];
};
type AttachedDocumentDraft = Omit<AttachedDocument, "id">;
type ExpenseDraft = Omit<Expense, "id">;
type PartialProjectInvoiceDraft = {
  title: string;
  amount: number;
  dueDate: string;
  description?: string;
  notes?: string;
  status?: "draft" | "sent";
  markAsPaid?: boolean;
  projectId: string;
  clientId: string;
};
type OrganizationMemberDraft = Omit<OrganizationMember, "id" | "status" | "invitedAt" | "joinedAt"> & {
  status?: OrganizationMember["status"];
  invitedAt?: string;
  joinedAt?: string;
};
type ProjectAssignmentDraft = Omit<ProjectAssignment, "id">;
type EmployeeProfileDraft = EmployeeProfile;

const PAY_PERIOD_STORAGE_KEY = "timeflow-pay-period-settings-v1";
const EXPENSE_STORAGE_KEY = "timeflow-expenses-v1";
const WORKSPACE_STORAGE_KEY = "timeflow-workspaces-v1";

type PersistedPayPeriodSettings = Pick<
  AppSettings,
  "invoiceFrequency" | "payPeriodFrequency" | "payPeriodStartDate" | "periodWeekStartsOn" | "periodTargetHours" | "periodTargetEarnings"
>;

type WorkspaceStateSnapshot = {
  organizations: Organization[];
  activeOrganizationId?: string;
  organizationMembers: OrganizationMember[];
  employeeProfiles: EmployeeProfile[];
  projectAssignments: ProjectAssignment[];
};

function readPersistedPayPeriodSettings(): Partial<PersistedPayPeriodSettings> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PAY_PERIOD_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Partial<PersistedPayPeriodSettings>;
  } catch {
    return {};
  }
}

function writePersistedPayPeriodSettings(settings: PersistedPayPeriodSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PAY_PERIOD_STORAGE_KEY, JSON.stringify(settings));
}

function pickPersistedPayPeriodSettings(settings: AppSettings): PersistedPayPeriodSettings {
  return {
    invoiceFrequency: settings.invoiceFrequency,
    payPeriodFrequency: settings.payPeriodFrequency,
    payPeriodStartDate: settings.payPeriodStartDate,
    periodWeekStartsOn: settings.periodWeekStartsOn,
    periodTargetHours: settings.periodTargetHours,
    periodTargetEarnings: settings.periodTargetEarnings,
  };
}

function buildHydratedSettings(settings: AppSettings, persisted: Partial<PersistedPayPeriodSettings>): AppSettings {
  return {
    ...settings,
    invoiceFrequency: settings.invoiceFrequency,
    payPeriodFrequency: settings.payPeriodFrequency || persisted.payPeriodFrequency || settings.invoiceFrequency,
    payPeriodStartDate: settings.payPeriodStartDate ?? persisted.payPeriodStartDate,
    periodWeekStartsOn: settings.periodWeekStartsOn ?? persisted.periodWeekStartsOn ?? 1,
    periodTargetHours: settings.periodTargetHours ?? persisted.periodTargetHours ?? 0,
    periodTargetEarnings: settings.periodTargetEarnings ?? persisted.periodTargetEarnings ?? 0,
  };
}

function shouldPromotePersistedPayPeriodSettings(
  server: AppSettings,
  hydrated: AppSettings,
  persisted: Partial<PersistedPayPeriodSettings>,
): boolean {
  const hasPersistedValue =
    persisted.payPeriodFrequency !== undefined ||
    persisted.payPeriodStartDate !== undefined ||
    persisted.periodWeekStartsOn !== undefined ||
    persisted.periodTargetHours !== undefined ||
    persisted.periodTargetEarnings !== undefined;

  if (!hasPersistedValue) {
    return false;
  }

  return (
    server.payPeriodFrequency !== hydrated.payPeriodFrequency ||
    server.payPeriodStartDate !== hydrated.payPeriodStartDate ||
    server.periodWeekStartsOn !== hydrated.periodWeekStartsOn ||
    server.periodTargetHours !== hydrated.periodTargetHours ||
    server.periodTargetEarnings !== hydrated.periodTargetEarnings
  );
}

function readPersistedExpenses(): Expense[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(EXPENSE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return (JSON.parse(raw) as Expense[]).map(normalizeExpenseRecord);
  } catch {
    return [];
  }
}

function writePersistedExpenses(expenses: Expense[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
}

function readPersistedWorkspaceState(): Partial<WorkspaceStateSnapshot> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Partial<WorkspaceStateSnapshot>;
  } catch {
    return {};
  }
}

function writePersistedWorkspaceState(state: WorkspaceStateSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
}

function persistWorkspaceSnapshot(state: WorkspaceStateSnapshot) {
  writePersistedWorkspaceState(state);
}


function normalizeExpenseRecord(expense: Expense): Expense {
  const billTo = expense.billTo ?? (expense.projectId ? "project" : "client");
  const billableToClient = expense.billableToClient ?? true;
  const normalizedStatus = expense.status ?? (billableToClient ? "billable" : "non_billable");
  const normalizedInvoiceId = billableToClient ? expense.invoiceId ?? null : null;

  if (billTo === "project") {
    return {
      ...expense,
      billTo,
      billableToClient,
      invoiceId: normalizedInvoiceId,
      receiptAttached: expense.receiptAttached ?? false,
      status:
        normalizedInvoiceId && normalizedStatus !== "reimbursed"
          ? "invoiced"
          : normalizedStatus,
    };
  }

  return {
    ...expense,
    billTo,
    billableToClient,
    invoiceId: normalizedInvoiceId,
    projectId: undefined,
    receiptAttached: expense.receiptAttached ?? false,
    status:
      normalizedInvoiceId && normalizedStatus !== "reimbursed"
        ? "invoiced"
        : normalizedStatus,
  };
}

function getInvoiceExpenseIds(invoice: Pick<Invoice, "lineItems">) {
  return invoice.lineItems
    .map((lineItem) => lineItem.expenseId)
    .filter((expenseId): expenseId is string => Boolean(expenseId));
}

function getExpenseStatusForInvoiceStatus(status: Invoice["status"]): Expense["status"] {
  if (status === "paid") {
    return "reimbursed";
  }

  return "invoiced";
}

function releaseExpenseFromInvoice(expense: Expense): Expense {
  return normalizeExpenseRecord({
    ...expense,
    invoiceId: null,
    status: expense.billableToClient === false ? "non_billable" : "billable",
  });
}

function clearPersistedExpenses() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(EXPENSE_STORAGE_KEY);
}

function resolveViewerClientId(clients: Client[], settings: AppSettings, preferredClientId?: string) {
  if (preferredClientId && clients.some((client) => client.id === preferredClientId)) {
    return preferredClientId;
  }

  if (settings.defaultClientId && clients.some((client) => client.id === settings.defaultClientId)) {
    return settings.defaultClientId;
  }

  return clients[0]?.id;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function calculateDurationHours(startTime: string, endTime?: string) {
  if (!endTime) return 0;
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const start = startHours * 60 + startMinutes;
  const end = endHours * 60 + endMinutes;
  return Math.max(0, Number(((end - start) / 60).toFixed(2)));
}

function canManageWorkspace(role: UserRole) {
  return role === "contractor" || role === "owner" || role === "admin" || role === "manager";
}

function canTrackTime(role: UserRole) {
  return canManageWorkspace(role) || role === "employee";
}

function createDefaultOrganization(user: UserProfile, businessName: string): Organization {
  return {
    id: `org-${user.id || "default"}`,
    name: businessName || "Default Organization",
    ownerUserId: user.id || "owner",
    createdAt: new Date().toISOString(),
    status: "active",
  };
}

export interface AppState {
  authStatus: "unknown" | "authenticated" | "unauthenticated";
  hydrated: boolean;
  currentUser: UserProfile;
  organizations: Organization[];
  activeOrganizationId?: string;
  organizationMembers: OrganizationMember[];
  employeeProfiles: EmployeeProfile[];
  projectAssignments: ProjectAssignment[];
  viewerClientId?: string;
  viewerClientLocked: boolean;
  settings: AppSettings;
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  projectBills: ProjectBill[];
  activeSession: WorkSession;
  invoices: Invoice[];
  emailDrafts: Record<string, EmailDraft>;
  markAuthenticated: () => void;
  markUnauthenticated: () => void;
  hydrateFromApi: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
  setRole: (role: UserRole) => void;
  setActiveOrganization: (organizationId: string) => void;
  createOrganizationWorkspace: (name?: string) => string | undefined;
  setViewerClientContext: (clientId?: string, locked?: boolean) => void;
  switchToViewerMode: (preferredClientId?: string) => string | undefined;
  syncCurrentUser: (updates: Pick<UserProfile, "name" | "email" | "role">) => void;
  updateCurrentUser: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addClient: (client: ClientDraft) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  archiveClient: (id: string) => void;
  restoreClient: (id: string) => void;
  deleteClient: (id: string) => void;
  addClientDocument: (clientId: string, document: AttachedDocumentDraft) => void;
  updateClientDocument: (clientId: string, documentId: string, updates: Partial<AttachedDocument>) => void;
  addProject: (project: ProjectDraft) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  archiveProject: (id: string) => void;
  restoreProject: (id: string) => void;
  deleteProject: (id: string) => void;
  addProjectDocument: (projectId: string, document: AttachedDocumentDraft) => void;
  updateProjectDocument: (projectId: string, documentId: string, updates: Partial<AttachedDocument>) => void;
  inviteOrganizationMember: (member: OrganizationMemberDraft, profile?: EmployeeProfileDraft) => void;
  updateOrganizationMember: (id: string, updates: Partial<OrganizationMember>) => void;
  addProjectAssignment: (assignment: ProjectAssignmentDraft) => void;
  removeProjectAssignment: (id: string) => void;
  startSession: (clientId: string, notes?: string, projectId?: string) => boolean;
  updateActiveSession: (updates: Partial<WorkSession>) => void;
  stopSession: () => TimeEntry | null;
  approveTimeEntry: (id: string) => void;
  rejectTimeEntry: (id: string, reason: string) => void;
  addTimeEntry: (entry: TimeEntryDraft) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  addExpense: (expense: ExpenseDraft) => Expense | null;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addProjectBill: (bill: ProjectBillDraft) => void;
  updateProjectBill: (id: string, updates: Partial<ProjectBill>) => void;
  markProjectBillPaid: (id: string, paidAt?: string) => void;
  voidProjectBill: (id: string) => void;
  deleteProjectBill: (id: string) => void;
  markTimeEntryInvoiced: (id: string) => void;
  unmarkTimeEntryInvoiced: (id: string) => void;
  commitInvoiceDrafts: (previews: InvoiceDraftPreview[]) => Invoice[];
  commitSingleInvoice: (preview: InvoiceDraftPreview) => Invoice | null;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  createPartialProjectInvoice: (draft: PartialProjectInvoiceDraft) => Invoice | null;
  createInvoiceFromFixedBill: (billAmount: number, billTitle: string, clientId: string, projectId: string | undefined, dueDate: string) => Invoice | null;
  saveEmailDraft: (draft: EmailDraft) => void;
  markEmailDraftReady: (invoiceId: string, ready: boolean) => void;
  resetApp: () => void;
}

const defaultUser: UserProfile = {
  id: "",
  name: "",
  email: "",
  role: "contractor",
  hourlyRate: 0,
  invoiceFrequency: "monthly",
  invoiceDueDays: 30,
  currency: "USD",
};

const defaultSettings: AppSettings = {
  businessName: "",
  invoiceNotes: "",
  paymentInstructions: "",
  invoiceFrequency: "monthly",
  payPeriodFrequency: "monthly",
  payPeriodStartDate: undefined,
  companyViewerAccess: false,
  emailTemplate: "",
  periodWeekStartsOn: 1,
  periodTargetHours: 0,
  periodTargetEarnings: 0,
};

const emptyState = {
  authStatus: "unknown" as const,
  hydrated: false,
  currentUser: defaultUser,
  organizations: [] as Organization[],
  activeOrganizationId: undefined as string | undefined,
  organizationMembers: [] as OrganizationMember[],
  employeeProfiles: [] as EmployeeProfile[],
  projectAssignments: [] as ProjectAssignment[],
  viewerClientId: undefined as string | undefined,
  viewerClientLocked: false,
  settings: defaultSettings,
  clients: [] as Client[],
  projects: [] as Project[],
  timeEntries: [] as TimeEntry[],
  expenses: [] as Expense[],
  projectBills: [] as ProjectBill[],
  activeSession: { isActive: false } as WorkSession,
  invoices: [] as Invoice[],
  emailDrafts: {} as Record<string, EmailDraft>,
};

export const useAppStore = create<AppState>()((set, get) => ({
  ...emptyState,

  markAuthenticated: () => set({ authStatus: "authenticated" }),
  markUnauthenticated: () => set({ authStatus: "unauthenticated", hydrated: true }),

  hydrateFromApi: async () => {
    try {
      const { clients, projects, timeEntries, expenses, invoices, projectBills, settings } = await apiHydrateAll();
      const persistedPayPeriodSettings = readPersistedPayPeriodSettings();
      const mergedSettings = buildHydratedSettings(settings, persistedPayPeriodSettings);
      const state = get();
      const persistedWorkspace = readPersistedWorkspaceState();
      const defaultOrganization = createDefaultOrganization(state.currentUser, mergedSettings.businessName);
      const organizations = persistedWorkspace.organizations?.length
        ? persistedWorkspace.organizations
        : state.organizations.length > 0
          ? state.organizations
          : [defaultOrganization];
      const activeOrganizationId = persistedWorkspace.activeOrganizationId ?? state.activeOrganizationId ?? organizations[0]?.id ?? defaultOrganization.id;
      const organizationMembers = persistedWorkspace.organizationMembers?.length
        ? persistedWorkspace.organizationMembers
        : state.organizationMembers.length > 0
          ? state.organizationMembers
          : [{
            id: `member-${state.currentUser.id || "owner"}`,
            organizationId: activeOrganizationId,
            userId: state.currentUser.id || undefined,
            email: state.currentUser.email,
            name: state.currentUser.name || "Owner",
            role: normalizeOrganizationRole(state.currentUser.role),
            status: "active" as const,
            joinedAt: new Date().toISOString(),
          }];
      const employeeProfiles = persistedWorkspace.employeeProfiles?.length ? persistedWorkspace.employeeProfiles : state.employeeProfiles;
      const projectAssignments = persistedWorkspace.projectAssignments?.length ? persistedWorkspace.projectAssignments : state.projectAssignments;
      const normalizedClients = clients.map((c) => ({ ...c, documents: [] }));
      const normalizedProjects = projects.map((p) => ({ ...p, documents: [] }));
      const normalizedEntries = timeEntries.map((e) => normalizeTimeEntryRecord(e, normalizedClients, normalizedProjects));
      const normalizedInvoices = invoices.map((inv) => normalizeInvoiceRecord(inv, normalizedEntries));
      const restoredSession = readPersistedActiveSession();
      const persistedExpenses = readPersistedExpenses();
      const normalizedExpenses = expenses.length > 0
        ? expenses.map(normalizeExpenseRecord)
        : persistedExpenses;
      set({
        activeOrganizationId,
        clients: normalizedClients,
        employeeProfiles,
        projects: normalizedProjects,
        organizations,
        organizationMembers,
        projectAssignments,
        timeEntries: normalizedEntries,
        expenses: normalizedExpenses,
        projectBills,
        invoices: normalizedInvoices,
        settings: mergedSettings,
        ...(restoredSession ? { activeSession: restoredSession } : {}),
        hydrated: true,
      });
      writePersistedPayPeriodSettings(pickPersistedPayPeriodSettings(mergedSettings));
      writePersistedExpenses(normalizedExpenses);

      // Backward-compat bridge: if this browser still has older local pay period
      // values, promote them to the API once so future device logins stay aligned.
      if (shouldPromotePersistedPayPeriodSettings(settings, mergedSettings, persistedPayPeriodSettings)) {
        void apiSaveSettings({
          payPeriodFrequency: mergedSettings.payPeriodFrequency,
          payPeriodStartDate: mergedSettings.payPeriodStartDate,
          periodWeekStartsOn: mergedSettings.periodWeekStartsOn,
          periodTargetHours: mergedSettings.periodTargetHours,
          periodTargetEarnings: mergedSettings.periodTargetEarnings,
        }).catch(() => undefined);
      }

      persistWorkspaceSnapshot({
        organizations,
        activeOrganizationId,
        organizationMembers,
        employeeProfiles,
        projectAssignments,
      });
    } catch (err) {
      set({ hydrated: true });
      toast.error(err instanceof Error ? err.message : "Failed to load data from server");
    }
  },

  setHydrated: (hydrated) => set({ hydrated }),

  setActiveOrganization: (organizationId) => {
    set({ activeOrganizationId: organizationId });
    const current = get();
    persistWorkspaceSnapshot({
      organizations: current.organizations,
      activeOrganizationId: organizationId,
      organizationMembers: current.organizationMembers,
      employeeProfiles: current.employeeProfiles,
      projectAssignments: current.projectAssignments,
    });
  },

  createOrganizationWorkspace: (name) => {
    if (!canManageWorkspace(get().currentUser.role)) return undefined;

    const state = get();
    const workspaceName = name?.trim() || `${state.settings.businessName || state.currentUser.name || "Workspace"} Team`;
    const organizationId = `org-${crypto.randomUUID()}`;
    const nextOrganization: Organization = {
      id: organizationId,
      name: workspaceName,
      ownerUserId: state.currentUser.id || "owner",
      createdAt: new Date().toISOString(),
      status: "active",
    };
    const nextMember: OrganizationMember = {
      id: `member-${crypto.randomUUID()}`,
      organizationId,
      userId: state.currentUser.id || undefined,
      email: state.currentUser.email,
      name: state.currentUser.name || "Owner",
      role: normalizeOrganizationRole(state.currentUser.role),
      status: "active",
      joinedAt: new Date().toISOString(),
    };
    const organizations = [...state.organizations, nextOrganization];
    const organizationMembers = [...state.organizationMembers, nextMember];
    set({ organizations, organizationMembers, activeOrganizationId: organizationId });
    persistWorkspaceSnapshot({
      organizations,
      activeOrganizationId: organizationId,
      organizationMembers,
      employeeProfiles: state.employeeProfiles,
      projectAssignments: state.projectAssignments,
    });
    return organizationId;
  },

  setRole: (role) =>
    set((state) => {
      if (role !== "client_viewer") {
        return {
          currentUser: { ...state.currentUser, role },
          viewerClientId: state.viewerClientId,
          viewerClientLocked: false,
        };
      }

      const resolvedViewerClientId = resolveViewerClientId(state.clients, state.settings, state.viewerClientId);
      return {
        currentUser: { ...state.currentUser, role },
        viewerClientId: resolvedViewerClientId,
        // Never keep viewer mode locked without a concrete scoped client.
        viewerClientLocked: Boolean(state.viewerClientLocked && resolvedViewerClientId),
      };
    }),

  setViewerClientContext: (clientId, locked = false) =>
    set((state) => {
      const resolvedViewerClientId = resolveViewerClientId(state.clients, state.settings, clientId);

      return {
        viewerClientId: resolvedViewerClientId,
        viewerClientLocked: Boolean(locked && resolvedViewerClientId),
      };
    }),

  switchToViewerMode: (preferredClientId) => {
    // Single atomic store update: sets role + resolves viewer client id in one shot.
    // This avoids an intermediate render where role is client_viewer but clientId is still undefined.
    let resolvedId: string | undefined;
    set((state) => {
      resolvedId = resolveViewerClientId(state.clients, state.settings, preferredClientId ?? state.viewerClientId);
      return {
        currentUser: { ...state.currentUser, role: "client_viewer" as const },
        viewerClientId: resolvedId,
        viewerClientLocked: false,
      };
    });
    return resolvedId;
  },

  syncCurrentUser: (updates) => set((state) => ({ currentUser: { ...state.currentUser, ...updates } })),

  updateCurrentUser: (updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({ currentUser: { ...state.currentUser, ...updates } }));
  },

  updateSettings: (updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().settings;
    const nextSettings = { ...prev, ...updates };
    writePersistedPayPeriodSettings(pickPersistedPayPeriodSettings(nextSettings));
    set({ settings: nextSettings });
    if (Object.keys(updates).length === 0) {
      return;
    }

    void apiSaveSettings(updates)
      .then((savedSettings) => {
        const normalizedSavedSettings = buildHydratedSettings(savedSettings, {});
        writePersistedPayPeriodSettings(pickPersistedPayPeriodSettings(normalizedSavedSettings));
        set({ settings: normalizedSavedSettings });
      })
      .catch((err) => {
        set({ settings: prev });
        toast.error(err instanceof Error ? err.message : "Failed to save settings");
      });
  },

  addClient: (client) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const id = crypto.randomUUID();
    const newClient: Client = {
      ...client,
      id,
      organizationId: get().activeOrganizationId,
      canViewActiveClockIns: client.canViewActiveClockIns ?? true,
      documents: [],
    };
    set((state) => ({ clients: [...state.clients, newClient] }));
    void apiCreateClient(newClient).catch((err) => {
      set((state) => ({ clients: state.clients.filter((c) => c.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to save client");
    });
  },

  addClientDocument: (clientId, document) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      clients: state.clients.map((client) =>
        client.id === clientId ? { ...client, documents: [...client.documents, { ...document, id: createId("client-doc") }] } : client,
      ),
    }));
  },

  updateClientDocument: (clientId, documentId, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      clients: state.clients.map((client) =>
        client.id === clientId
          ? {
              ...client,
              documents: client.documents.map((doc) => (doc.id === documentId ? { ...doc, ...updates } : doc)),
            }
          : client,
      ),
    }));
  },

  updateClient: (id, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().clients.find((c) => c.id === id);
    set((state) => ({ clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)) }));
    void apiUpdateClient(id, updates).catch((err) => {
      if (prev) set((state) => ({ clients: state.clients.map((c) => (c.id === id ? prev : c)) }));
      toast.error(err instanceof Error ? err.message : "Failed to update client");
    });
  },

  archiveClient: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().clients.find((c) => c.id === id);
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c)),
    }));
    void apiArchiveClient(id).catch((err) => {
      if (prev) set((state) => ({ clients: state.clients.map((c) => (c.id === id ? prev : c)) }));
      toast.error(err instanceof Error ? err.message : "Failed to archive client");
    });
  },

  restoreClient: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().clients.find((c) => c.id === id);
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, archived: false, archivedAt: undefined, archivedReason: undefined } : c)),
    }));
    void apiRestoreClient(id).catch((err) => {
      if (prev) set((state) => ({ clients: state.clients.map((c) => (c.id === id ? prev : c)) }));
      toast.error(err instanceof Error ? err.message : "Failed to restore client");
    });
  },

  deleteClient: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const s = get();
    const snapshot = {
      clients: s.clients,
      projects: s.projects,
      timeEntries: s.timeEntries,
      projectBills: s.projectBills,
      invoices: s.invoices,
      activeSession: s.activeSession,
      viewerClientId: s.viewerClientId,
    };
    set((state) => {
      const projectBills = state.projectBills.filter((bill) => bill.clientId !== id);
      return {
        clients: state.clients.filter((c) => c.id !== id),
        projects: state.projects.filter((p) => p.clientId !== id),
        timeEntries: state.timeEntries.filter((e) => e.clientId !== id),
        projectBills,
        invoices: state.invoices.filter((inv) => inv.clientId !== id),
        activeSession: state.activeSession.clientId === id ? (clearPersistedActiveSession(), { isActive: false } as WorkSession) : state.activeSession,
        viewerClientId:
          state.viewerClientId === id
            ? state.viewerClientLocked
              ? undefined
              : resolveViewerClientId(state.clients.filter((c) => c.id !== id), state.settings)
            : state.viewerClientId,
      };
    });
    void apiDeleteClient(id).catch((err) => {
      set(snapshot);
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    });
  },

  addProject: (project) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const id = crypto.randomUUID();
    const newProject: Project = { ...project, id, organizationId: get().activeOrganizationId, documents: [] };
    set((state) => ({ projects: [...state.projects, newProject] }));
    void apiCreateProject(newProject).catch((err) => {
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to save project");
    });
  },

  updateProject: (id, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().projects.find((p) => p.id === id);
    set((state) => ({ projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
    void apiUpdateProject(id, updates).catch((err) => {
      if (prev) set((state) => ({ projects: state.projects.map((p) => (p.id === id ? prev : p)) }));
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    });
  },

  archiveProject: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().projects.find((p) => p.id === id);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, archived: true, archivedAt: new Date().toISOString() } : p)),
    }));
    void apiArchiveProject(id).catch((err) => {
      if (prev) set((state) => ({ projects: state.projects.map((p) => (p.id === id ? prev : p)) }));
      toast.error(err instanceof Error ? err.message : "Failed to archive project");
    });
  },

  restoreProject: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().projects.find((p) => p.id === id);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, archived: false, archivedAt: undefined, archivedReason: undefined } : p)),
    }));
    void apiRestoreProject(id).catch((err) => {
      if (prev) set((state) => ({ projects: state.projects.map((p) => (p.id === id ? prev : p)) }));
      toast.error(err instanceof Error ? err.message : "Failed to restore project");
    });
  },

  deleteProject: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const s = get();
    const snapshot = { projects: s.projects, timeEntries: s.timeEntries, projectBills: s.projectBills, activeSession: s.activeSession };
    set((state) => {
      const projectBills = state.projectBills.filter((bill) => bill.projectId !== id);
      return {
        projects: state.projects.filter((p) => p.id !== id),
        timeEntries: state.timeEntries.map((e) => (e.projectId === id ? { ...e, projectId: undefined } : e)),
        projectBills,
        activeSession: state.activeSession.projectId === id ? (clearPersistedActiveSession(), { isActive: false } as WorkSession) : state.activeSession,
      };
    });
    void apiDeleteProject(id).catch((err) => {
      set(snapshot);
      toast.error(err instanceof Error ? err.message : "Failed to delete project");
    });
  },

  addProjectDocument: (projectId, document) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, documents: [...project.documents, { ...document, id: createId("project-doc") }] } : project,
      ),
    }));
  },

  updateProjectDocument: (projectId, documentId, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              documents: project.documents.map((doc) => (doc.id === documentId ? { ...doc, ...updates } : doc)),
            }
          : project,
      ),
    }));
  },

  inviteOrganizationMember: (member, profile) => {
    const state = get();
    if (!canManageWorkspace(state.currentUser.role)) return;

    const id = createId("member");
    const invitedAt = member.invitedAt ?? new Date().toISOString();
    const nextMember: OrganizationMember = {
      ...member,
      id,
      invitedAt,
      joinedAt: member.status === "active" ? member.joinedAt ?? invitedAt : undefined,
      status: member.status ?? "invited",
    };

    set((current) => ({
      organizationMembers: [nextMember, ...current.organizationMembers],
      employeeProfiles:
        profile
          ? [
              {
                ...profile,
                memberId: id,
                organizationId: member.organizationId,
              },
              ...current.employeeProfiles,
            ]
          : current.employeeProfiles,
    }));
      const current = get();
      persistWorkspaceSnapshot({
        organizations: current.organizations,
        activeOrganizationId: current.activeOrganizationId,
        organizationMembers: current.organizationMembers,
        employeeProfiles: current.employeeProfiles,
        projectAssignments: current.projectAssignments,
      });
  },

  updateOrganizationMember: (id, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      organizationMembers: state.organizationMembers.map((member) =>
        member.id === id ? { ...member, ...updates } : member,
      ),
    }));
    const current = get();
    persistWorkspaceSnapshot({
      organizations: current.organizations,
      activeOrganizationId: current.activeOrganizationId,
      organizationMembers: current.organizationMembers,
      employeeProfiles: current.employeeProfiles,
      projectAssignments: current.projectAssignments,
    });
  },

  addProjectAssignment: (assignment) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      projectAssignments: [
        {
          ...assignment,
          id: createId("assignment"),
        },
        ...state.projectAssignments,
      ],
    }));
    const current = get();
    persistWorkspaceSnapshot({
      organizations: current.organizations,
      activeOrganizationId: current.activeOrganizationId,
      organizationMembers: current.organizationMembers,
      employeeProfiles: current.employeeProfiles,
      projectAssignments: current.projectAssignments,
    });
  },

  removeProjectAssignment: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      projectAssignments: state.projectAssignments.filter((assignment) => assignment.id !== id),
    }));
    const current = get();
    persistWorkspaceSnapshot({
      organizations: current.organizations,
      activeOrganizationId: current.activeOrganizationId,
      organizationMembers: current.organizationMembers,
      employeeProfiles: current.employeeProfiles,
      projectAssignments: current.projectAssignments,
    });
  },

  startSession: (clientId, notes, projectId) => {
    const state = get();
    if (state.activeSession.isActive || !clientId || !canTrackTime(state.currentUser.role)) return false;

    const session: WorkSession = {
      isActive: true,
      isPaused: false,
      clientId,
      projectId,
      billingRate: projectId ? state.projects.find((p) => p.id === projectId)?.hourlyRate : state.clients.find((c) => c.id === clientId)?.hourlyRate,
      startedAt: new Date().toISOString(),
      pausedDurationSeconds: 0,
      notes: notes?.trim(),
    };

    set({ activeSession: session });
    persistActiveSession(session);

    return true;
  },

  updateActiveSession: (updates) => {
    if (!canTrackTime(get().currentUser.role)) return;
    set((state) => {
      const next = { ...state.activeSession, ...updates };
      persistActiveSession(next);
      return { activeSession: next };
    });
  },

  stopSession: () => {
    const state = get();
    if (!canTrackTime(state.currentUser.role) || !state.activeSession.isActive || !state.activeSession.startedAt || !state.activeSession.clientId) {
      return null;
    }

    const startedAt = new Date(state.activeSession.startedAt);
    const endedAt = new Date();
    const activeTrackedSeconds = getTrackedSessionSeconds(state.activeSession, endedAt);
    const durationHours = Number((activeTrackedSeconds / 60 / 60).toFixed(2));
    const id = crypto.randomUUID();
    const requiresApproval = state.currentUser.role === "employee";
    const entry: TimeEntry = {
      id,
      clientId: state.activeSession.clientId,
      projectId: state.activeSession.projectId,
      date: startedAt.toLocaleDateString("en-CA"),
      startTime: startedAt.toTimeString().slice(0, 5),
      endTime: endedAt.toTimeString().slice(0, 5),
      durationHours,
      billingRate: state.activeSession.billingRate,
      notes: state.activeSession.notes?.trim() || "Tracked work session",
      status: requiresApproval ? "pending_approval" : "completed",
      billable: true,
      invoiced: false,
      invoiceId: null,
      organizationId: state.activeOrganizationId,
    };
    const normalizedEntry = normalizeTimeEntryRecord(entry, state.clients, state.projects);

    set((current) => ({
      timeEntries: [normalizedEntry, ...current.timeEntries],
      activeSession: { isActive: false },
    }));
    clearPersistedActiveSession();

    void apiCreateTimeEntry(normalizedEntry).catch((err) => {
      set((current) => ({ timeEntries: current.timeEntries.filter((e) => e.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to save time entry");
    });

    return normalizedEntry;
  },

  addTimeEntry: (entry) => {
    const state = get();
    if (!canTrackTime(state.currentUser.role)) return;

    const id = crypto.randomUUID();
    const nextEntry = normalizeTimeEntryRecord(
      {
        id,
        ...entry,
        durationHours: entry.durationHours ?? calculateDurationHours(entry.startTime, entry.endTime),
        status: entry.status ?? "completed",
        billable: entry.billable ?? true,
        invoiced: entry.invoiced ?? false,
        invoiceId: entry.invoiceId ?? null,
        organizationId: entry.organizationId ?? state.activeOrganizationId,
      },
      state.clients,
      state.projects,
    );

    set((current) => ({ timeEntries: [nextEntry, ...current.timeEntries] }));

    void apiCreateTimeEntry(nextEntry).catch((err) => {
      set((current) => ({ timeEntries: current.timeEntries.filter((e) => e.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to save time entry");
    });
  },

  updateTimeEntry: (id, updates) => {
    if (!canTrackTime(get().currentUser.role)) return;
    const prev = get().timeEntries.find((e) => e.id === id);
    set((state) => ({
      timeEntries: state.timeEntries.map((entry) => {
        if (entry.id !== id) return entry;
        const nextEntry = { ...entry, ...updates };
        if ((updates.startTime || updates.endTime) && nextEntry.endTime) {
          nextEntry.durationHours = calculateDurationHours(nextEntry.startTime, nextEntry.endTime);
        }
        return normalizeTimeEntryRecord(nextEntry, state.clients, state.projects);
      }),
    }));
    void apiUpdateTimeEntry(id, updates).catch((err) => {
      if (prev) set((state) => ({ timeEntries: state.timeEntries.map((e) => (e.id === id ? prev : e)) }));
      toast.error(err instanceof Error ? err.message : "Failed to update time entry");
    });
  },

  deleteTimeEntry: (id) => {
    if (!canTrackTime(get().currentUser.role)) return;
    const prev = get().timeEntries;
    set((state) => ({ timeEntries: state.timeEntries.filter((e) => e.id !== id) }));
    void apiDeleteTimeEntry(id).catch((err) => {
      set({ timeEntries: prev });
      toast.error(err instanceof Error ? err.message : "Failed to delete time entry");
    });
  },

  addExpense: (expense) => {
    if (!canManageWorkspace(get().currentUser.role)) return null;

    const id = crypto.randomUUID();
    const nextExpense = normalizeExpenseRecord({ id, ...expense });

    set((state) => {
      const expenses = [nextExpense, ...state.expenses];
      writePersistedExpenses(expenses);
      return { expenses };
    });

    void apiCreateExpense(nextExpense).catch((err) => {
      set((state) => {
        const expenses = state.expenses.filter((item) => item.id !== id);
        writePersistedExpenses(expenses);
        return { expenses };
      });
      toast.error(err instanceof Error ? err.message : "Failed to add expense");
    });

    return nextExpense;
  },

  updateExpense: (id, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;

    const prev = get().expenses.find((expense) => expense.id === id);
    if (!prev) return;

    const nextExpense = normalizeExpenseRecord({ ...prev, ...updates });

    set((state) => {
      const expenses = state.expenses.map((expense) => (expense.id === id ? nextExpense : expense));
      writePersistedExpenses(expenses);
      return { expenses };
    });

    void apiUpdateExpenseRequest(id, updates).catch((err) => {
      set((state) => {
        const expenses = state.expenses.map((expense) => (expense.id === id ? prev : expense));
        writePersistedExpenses(expenses);
        return { expenses };
      });
      toast.error(err instanceof Error ? err.message : "Failed to update expense");
    });
  },

  deleteExpense: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;

    const prev = get().expenses;

    set((state) => {
      const expenses = state.expenses.filter((expense) => expense.id !== id);
      writePersistedExpenses(expenses);
      return { expenses };
    });

    void apiDeleteExpenseRequest(id).catch((err) => {
      set({ expenses: prev });
      writePersistedExpenses(prev);
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    });
  },

  addProjectBill: (bill) => {
    if (!canManageWorkspace(get().currentUser.role)) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const next: ProjectBill = {
      ...bill,
      organizationId: get().activeOrganizationId,
      amount: Number(bill.amount || 0),
      id,
      status: bill.status ?? "issued",
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ projectBills: [next, ...state.projectBills] }));

    void apiCreateProjectBill(next).catch((err) => {
      set((state) => ({ projectBills: state.projectBills.filter((projectBill) => projectBill.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to add project bill");
    });
  },

  updateProjectBill: (id, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;

    const prev = get().projectBills.find((projectBill) => projectBill.id === id);
    set((state) => ({
      projectBills: state.projectBills.map((projectBill) =>
        projectBill.id === id
          ? {
              ...projectBill,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : projectBill,
      ),
    }));

    void apiUpdateProjectBillRequest(id, updates).catch((err) => {
      if (prev) {
        set((state) => ({ projectBills: state.projectBills.map((projectBill) => (projectBill.id === id ? prev : projectBill)) }));
      }
      toast.error(err instanceof Error ? err.message : "Failed to update project bill");
    });
  },

  markProjectBillPaid: (id, paidAt) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    get().updateProjectBill(id, {
      status: "paid",
      paidAt: paidAt ?? new Date().toISOString(),
      voidedAt: undefined,
    });
  },

  voidProjectBill: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    get().updateProjectBill(id, {
      status: "void",
      voidedAt: new Date().toISOString(),
      paidAt: undefined,
    });
  },

  deleteProjectBill: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().projectBills;
    set((state) => ({ projectBills: state.projectBills.filter((projectBill) => projectBill.id !== id) }));
    void apiDeleteProjectBill(id).catch((err) => {
      set({ projectBills: prev });
      toast.error(err instanceof Error ? err.message : "Failed to delete project bill");
    });
  },

  markTimeEntryInvoiced: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().timeEntries;
    set((state) => ({
      timeEntries: state.timeEntries.map((e) => (e.id === id ? { ...e, status: "invoiced" as const, invoiced: true } : e)),
    }));
    void apiUpdateTimeEntry(id, { status: "invoiced", invoiced: true }).catch((err) => {
      set({ timeEntries: prev });
      toast.error(err instanceof Error ? err.message : "Failed to update time entry");
    });
  },

  unmarkTimeEntryInvoiced: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().timeEntries;
    set((state) => ({
      timeEntries: state.timeEntries.map((e) =>
        e.id === id ? { ...e, status: "completed" as const, invoiced: false, invoiceId: null } : e,
      ),
    }));
    void apiUpdateTimeEntry(id, { status: "completed", invoiced: false, invoiceId: null }).catch((err) => {
      set({ timeEntries: prev });
      toast.error(err instanceof Error ? err.message : "Failed to update time entry");
    });
  },

  commitInvoiceDrafts: (previews) => {
    if (!previews.length) return [];
    const state = get();
    if (!canManageWorkspace(state.currentUser.role)) return [];

    const nextInvoices = materializeInvoiceDrafts(previews, state.invoices);

    const entryToInvoiceId = new Map<string, string>();
    const expenseToInvoiceId = new Map<string, string>();
    previews.forEach((preview, i) => {
      const invoice = nextInvoices[i];
      if (invoice) {
        preview.entryIds.forEach((eid) => entryToInvoiceId.set(eid, invoice.id));
        getInvoiceExpenseIds(invoice).forEach((expenseId) => expenseToInvoiceId.set(expenseId, invoice.id));
      }
    });

    set((current) => {
      const expenses = current.expenses.map((expense) => {
        const invoiceId = expenseToInvoiceId.get(expense.id);
        if (!invoiceId) {
          return expense;
        }

        return normalizeExpenseRecord({
          ...expense,
          invoiceId,
          status: "invoiced",
        });
      });
      writePersistedExpenses(expenses);

      return {
        invoices: [...nextInvoices, ...current.invoices],
        timeEntries: current.timeEntries.map((entry) => {
          const invoiceId = entryToInvoiceId.get(entry.id);
          return invoiceId ? { ...entry, status: "invoiced" as const, invoiced: true, invoiceId } : entry;
        }),
        expenses,
      };
    });

    nextInvoices.forEach((invoice, i) => {
      const preview = previews[i];
      if (!preview) return;
      void apiCreateInvoice(invoice.id, preview).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to save invoice");
      });
      if (preview.entryIds.length > 0) {
        void apiBulkUpdateTimeEntries(preview.entryIds, {
          invoiced: true,
          invoiceId: invoice.id,
          status: "invoiced",
        }).catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update time entries");
        });
      }

      const linkedExpenseIds = getInvoiceExpenseIds(invoice);
      linkedExpenseIds.forEach((expenseId) => {
        void apiUpdateExpenseRequest(expenseId, {
          invoiceId: invoice.id,
          status: "invoiced",
        }).catch(() => undefined);
      });
    });

    return nextInvoices;
  },

  commitSingleInvoice: (preview) => {
    const state = get();
    if (!canManageWorkspace(state.currentUser.role)) return null;

    const [invoice] = materializeInvoiceDrafts([preview], state.invoices);
    if (!invoice) return null;

    const invoiceExpenseIds = new Set(getInvoiceExpenseIds(invoice));

    set((current) => {
      const expenses = current.expenses.map((expense) => {
        if (!invoiceExpenseIds.has(expense.id)) {
          return expense;
        }

        return normalizeExpenseRecord({
          ...expense,
          invoiceId: invoice.id,
          status: "invoiced",
        });
      });
      writePersistedExpenses(expenses);

      return {
        invoices: [invoice, ...current.invoices],
        timeEntries: current.timeEntries.map((entry) =>
          preview.entryIds.includes(entry.id) ? { ...entry, status: "invoiced" as const, invoiced: true, invoiceId: invoice.id } : entry,
        ),
        expenses,
      };
    });

    void apiCreateInvoice(invoice.id, preview).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save invoice");
    });
    if (preview.entryIds.length > 0) {
      void apiBulkUpdateTimeEntries(preview.entryIds, {
        invoiced: true,
        invoiceId: invoice.id,
        status: "invoiced",
      }).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update time entries");
      });
    }

    invoiceExpenseIds.forEach((expenseId) => {
      void apiUpdateExpenseRequest(expenseId, {
        invoiceId: invoice.id,
        status: "invoiced",
      }).catch(() => undefined);
    });

    return invoice;
  },

  updateInvoice: (id, updates) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const prev = get().invoices.find((inv) => inv.id === id);
    if (!prev) return;
    const nextInvoice = { ...prev, ...updates };
    const previousExpenseIds = new Set(getInvoiceExpenseIds(prev));
    const nextExpenseIds = new Set(getInvoiceExpenseIds(nextInvoice));
    const nextExpenseStatus = getExpenseStatusForInvoiceStatus(nextInvoice.status);

    set((state) => {
      const expenses = state.expenses.map((expense) => {
        const wasLinked = previousExpenseIds.has(expense.id);
        const shouldBeLinked = nextExpenseIds.has(expense.id);

        if (shouldBeLinked) {
          return normalizeExpenseRecord({
            ...expense,
            invoiceId: id,
            status: nextExpenseStatus,
          });
        }

        if (wasLinked && expense.invoiceId === id) {
          return releaseExpenseFromInvoice(expense);
        }

        return expense;
      });
      writePersistedExpenses(expenses);

      return {
        invoices: state.invoices.map((inv) => (inv.id === id ? nextInvoice : inv)),
        expenses,
      };
    });

    nextExpenseIds.forEach((expenseId) => {
      void apiUpdateExpenseRequest(expenseId, {
        invoiceId: id,
        status: nextExpenseStatus,
      }).catch(() => undefined);
    });
    previousExpenseIds.forEach((expenseId) => {
      if (nextExpenseIds.has(expenseId)) {
        return;
      }
      void apiUpdateExpenseRequest(expenseId, {
        invoiceId: null,
        status: "billable",
      }).catch(() => undefined);
    });

    void apiUpdateInvoice(id, updates).catch((err) => {
      set((state) => {
        const previousExpenseIds = new Set(getInvoiceExpenseIds(prev));
        const restoredExpenses = state.expenses.map((expense) => {
          if (!previousExpenseIds.has(expense.id)) {
            return expense;
          }

          return normalizeExpenseRecord({
            ...expense,
            invoiceId: id,
            status: getExpenseStatusForInvoiceStatus(prev.status),
          });
        });
        writePersistedExpenses(restoredExpenses);

        return {
          invoices: state.invoices.map((inv) => (inv.id === id ? prev : inv)),
          expenses: restoredExpenses,
        };
      });
      toast.error(err instanceof Error ? err.message : "Failed to update invoice");
    });
  },

  deleteInvoice: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    const s = get();
    const invoice = s.invoices.find((inv) => inv.id === id);
    const linkedEntryIds = new Set(invoice?.entryIds ?? []);
    const linkedExpenseIds = new Set(invoice ? getInvoiceExpenseIds(invoice) : []);
    const prevInvoices = s.invoices;
    const prevEntries = s.timeEntries;
    const prevExpenses = s.expenses;
    set((state) => {
      const expenses = state.expenses.map((expense) => {
        if (!linkedExpenseIds.has(expense.id) || expense.invoiceId !== id) {
          return expense;
        }

        return releaseExpenseFromInvoice(expense);
      });
      writePersistedExpenses(expenses);

      return {
        invoices: state.invoices.filter((inv) => inv.id !== id),
        timeEntries: state.timeEntries.map((entry) =>
          linkedEntryIds.has(entry.id) ? { ...entry, status: "completed" as const, invoiced: false, invoiceId: null } : entry,
        ),
        expenses,
      };
    });

    linkedExpenseIds.forEach((expenseId) => {
      void apiUpdateExpenseRequest(expenseId, {
        invoiceId: null,
        status: "billable",
      }).catch(() => undefined);
    });

    void apiDeleteInvoice(id).catch((err) => {
      set({ invoices: prevInvoices, timeEntries: prevEntries, expenses: prevExpenses });
      writePersistedExpenses(prevExpenses);
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    });
  },

  createPartialProjectInvoice: (draft) => {
    const state = get();
    if (!canManageWorkspace(state.currentUser.role)) return null;

    const project = state.projects.find((item) => item.id === draft.projectId);
    const client = state.clients.find((item) => item.id === draft.clientId);
    if (!project || !client) {
      toast.error("Project or client not found");
      return null;
    }

    if (project.clientId !== client.id) {
      toast.error("Selected client does not match the project");
      return null;
    }

    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      toast.error("Invoice amount must be greater than zero");
      return null;
    }

    const billingSnapshot = getProjectBillingSnapshot(project, state.invoices);
    if (
      typeof billingSnapshot.remainingProjectBillableAmount === "number"
      && draft.amount > billingSnapshot.remainingProjectBillableAmount
    ) {
      toast.error("This amount exceeds the remaining project balance.");
      return null;
    }

    const normalizedTitle = draft.title.trim() || "Partial project invoice";
    const normalizedDescription = draft.description?.trim() || "Partial project invoice";
    const sourceDescription = draft.notes?.trim()
      ? `${normalizedDescription}\n\n${draft.notes.trim()}`
      : normalizedDescription;
    const preview = createProjectPartialInvoicePreview({
      amount: draft.amount,
      client,
      clientId: client.id,
      dueDate: draft.dueDate,
      invoiceSourceType: typeof billingSnapshot.fixedProjectAmount === "number" ? "partial_project" : "manual_project",
      projectId: project.id,
      sourceDescription,
      title: normalizedTitle,
    });
    const [baseInvoice] = materializeInvoiceDrafts([preview], state.invoices);
    if (!baseInvoice) {
      return null;
    }

    const shouldMarkSent = draft.status === "sent" || draft.markAsPaid === true;
    const nowDate = new Date().toISOString().split("T")[0];
    const invoice: Invoice = {
      ...baseInvoice,
      fixedBillingAmount: draft.amount,
      invoiceSourceType: preview.invoiceSourceType,
      organizationId: state.activeOrganizationId,
      projectId: project.id,
      projectIds: [project.id],
      sourceDescription,
      status: draft.markAsPaid ? "paid" : shouldMarkSent ? "issued" : "draft",
      issuedAt: shouldMarkSent ? nowDate : undefined,
      paidAt: draft.markAsPaid ? nowDate : undefined,
    };

    set((current) => ({ invoices: [invoice, ...current.invoices] }));

    void apiCreateInvoice(invoice.id, preview)
      .then(() => {
        if (invoice.status === "draft") {
          return;
        }

        void apiUpdateInvoice(invoice.id, {
          issuedAt: invoice.issuedAt,
          paidAt: invoice.paidAt,
          status: invoice.status,
        }).catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update invoice status");
        });
      })
      .catch((err) => {
        set((current) => ({ invoices: current.invoices.filter((inv) => inv.id !== invoice.id) }));
        toast.error(err instanceof Error ? err.message : "Failed to create partial invoice");
      });

    return invoice;
  },

  createInvoiceFromFixedBill: (billAmount, billTitle, clientId, projectId, dueDate) => {
    const state = get();
    if (!canManageWorkspace(state.currentUser.role)) return null;

    const client = state.clients.find((c) => c.id === clientId);
    if (!client) {
      toast.error("Client not found");
      return null;
    }

    const preview = createFixedBillInvoicePreview(clientId, client, billAmount, billTitle, projectId, dueDate);
    const [invoice] = materializeInvoiceDrafts([preview], state.invoices);
    if (!invoice) return null;

    invoice.organizationId = state.activeOrganizationId;

    set((current) => ({ invoices: [invoice, ...current.invoices] }));

    void apiCreateInvoice(invoice.id, preview).catch((err) => {
      set((current) => ({ invoices: current.invoices.filter((inv) => inv.id !== invoice.id) }));
      toast.error(err instanceof Error ? err.message : "Failed to create invoice from fixed bill");
    });

    return invoice;
  },

  saveEmailDraft: (draft) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({ emailDrafts: { ...state.emailDrafts, [draft.invoiceId]: draft } }));
  },

  markEmailDraftReady: (invoiceId, ready) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      emailDrafts: {
        ...state.emailDrafts,
        [invoiceId]: {
          ...state.emailDrafts[invoiceId],
          invoiceId,
          subject: state.emailDrafts[invoiceId]?.subject ?? "",
          body: state.emailDrafts[invoiceId]?.body ?? "",
          readyToSend: ready,
        },
      },
    }));
  },

  resetApp: () => {
    clearPersistedActiveSession();
    clearPersistedExpenses();
    set({
      ...emptyState,
      authStatus: "unauthenticated",
      hydrated: true,
    });
  },

  approveTimeEntry: (id) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      timeEntries: state.timeEntries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "approved",
              rejectionReason: undefined,
              reviewedBy: state.currentUser.id,
              reviewedAt: new Date().toISOString(),
            }
          : entry,
      ),
    }));
  },

  rejectTimeEntry: (id, reason) => {
    if (!canManageWorkspace(get().currentUser.role)) return;
    set((state) => ({
      timeEntries: state.timeEntries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "rejected",
              rejectionReason: reason,
              reviewedBy: state.currentUser.id,
              reviewedAt: new Date().toISOString(),
            }
          : entry,
      ),
    }));
  },
}));
