import { create } from "zustand";
import { toast } from "sonner";

import { materializeInvoiceDrafts, normalizeInvoiceRecord } from "@/lib/invoice";
import { getTrackedSessionSeconds } from "@/lib/date";
import { normalizeTimeEntryRecord } from "@/lib/projects";
import { clearPersistedActiveSession, persistActiveSession, readPersistedActiveSession } from "@/lib/storage";
import {
  apiCreateClient,
  apiUpdateClient,
  apiDeleteClient,
  apiCreateProject,
  apiUpdateProject,
  apiDeleteProject,
  apiCreateTimeEntry,
  apiUpdateTimeEntry,
  apiDeleteTimeEntry,
  apiBulkUpdateTimeEntries,
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
  Project,
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
type AttachedDocumentDraft = Omit<AttachedDocument, "id">;
type ExpenseDraft = Omit<Expense, "id">;

const PAY_PERIOD_STORAGE_KEY = "timeflow-pay-period-settings-v1";
const EXPENSE_STORAGE_KEY = "timeflow-expenses-v1";

type PersistedPayPeriodSettings = Pick<
  AppSettings,
  "invoiceFrequency" | "payPeriodFrequency" | "payPeriodStartDate" | "periodWeekStartsOn" | "periodTargetHours" | "periodTargetEarnings"
>;

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

export interface AppState {
  authStatus: "unknown" | "authenticated" | "unauthenticated";
  hydrated: boolean;
  currentUser: UserProfile;
  viewerClientId?: string;
  viewerClientLocked: boolean;
  settings: AppSettings;
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  activeSession: WorkSession;
  invoices: Invoice[];
  emailDrafts: Record<string, EmailDraft>;
  markAuthenticated: () => void;
  markUnauthenticated: () => void;
  hydrateFromApi: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
  setRole: (role: UserRole) => void;
  setViewerClientContext: (clientId?: string, locked?: boolean) => void;
  syncCurrentUser: (updates: Pick<UserProfile, "name" | "email" | "role">) => void;
  updateCurrentUser: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addClient: (client: ClientDraft) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addClientDocument: (clientId: string, document: AttachedDocumentDraft) => void;
  updateClientDocument: (clientId: string, documentId: string, updates: Partial<AttachedDocument>) => void;
  addProject: (project: ProjectDraft) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addProjectDocument: (projectId: string, document: AttachedDocumentDraft) => void;
  updateProjectDocument: (projectId: string, documentId: string, updates: Partial<AttachedDocument>) => void;
  startSession: (clientId: string, notes?: string, projectId?: string) => boolean;
  updateActiveSession: (updates: Partial<WorkSession>) => void;
  stopSession: () => TimeEntry | null;
  addTimeEntry: (entry: TimeEntryDraft) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  addExpense: (expense: ExpenseDraft) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  markTimeEntryInvoiced: (id: string) => void;
  unmarkTimeEntryInvoiced: (id: string) => void;
  commitInvoiceDrafts: (previews: InvoiceDraftPreview[]) => Invoice[];
  commitSingleInvoice: (preview: InvoiceDraftPreview) => Invoice | null;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
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
  viewerClientId: undefined as string | undefined,
  viewerClientLocked: false,
  settings: defaultSettings,
  clients: [] as Client[],
  projects: [] as Project[],
  timeEntries: [] as TimeEntry[],
  expenses: [] as Expense[],
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
      const { clients, projects, timeEntries, invoices, settings } = await apiHydrateAll();
      const mergedSettings = { ...settings, ...readPersistedPayPeriodSettings() };
      const normalizedClients = clients.map((c) => ({ ...c, documents: [] }));
      const normalizedProjects = projects.map((p) => ({ ...p, documents: [] }));
      const normalizedEntries = timeEntries.map((e) => normalizeTimeEntryRecord(e, normalizedClients, normalizedProjects));
      const normalizedInvoices = invoices.map((inv) => normalizeInvoiceRecord(inv, normalizedEntries));
      const restoredSession = readPersistedActiveSession();
      const persistedExpenses = readPersistedExpenses();
      set({
        clients: normalizedClients,
        projects: normalizedProjects,
        timeEntries: normalizedEntries,
        expenses: persistedExpenses,
        invoices: normalizedInvoices,
        settings: mergedSettings,
        ...(restoredSession ? { activeSession: restoredSession } : {}),
        hydrated: true,
      });
    } catch (err) {
      set({ hydrated: true });
      toast.error(err instanceof Error ? err.message : "Failed to load data from server");
    }
  },

  setHydrated: (hydrated) => set({ hydrated }),

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

  syncCurrentUser: (updates) => set((state) => ({ currentUser: { ...state.currentUser, ...updates } })),

  updateCurrentUser: (updates) => {
    if (get().currentUser.role !== "contractor") return;
    set((state) => ({ currentUser: { ...state.currentUser, ...updates } }));
  },

  updateSettings: (updates) => {
    if (get().currentUser.role !== "contractor") return;
    const prev = get().settings;
    const nextSettings = { ...prev, ...updates };
    writePersistedPayPeriodSettings({
      invoiceFrequency: nextSettings.invoiceFrequency,
      payPeriodFrequency: nextSettings.payPeriodFrequency,
      payPeriodStartDate: nextSettings.payPeriodStartDate,
      periodWeekStartsOn: nextSettings.periodWeekStartsOn,
      periodTargetHours: nextSettings.periodTargetHours,
      periodTargetEarnings: nextSettings.periodTargetEarnings,
    });
    set({ settings: nextSettings });
    const { payPeriodFrequency: _payPeriodFrequency, payPeriodStartDate: _payPeriodStartDate, ...serverUpdates } = updates;
    if (Object.keys(serverUpdates).length === 0) {
      return;
    }

    void apiSaveSettings(serverUpdates)
      .then((savedSettings) => {
        const mergedSettings = { ...savedSettings, ...readPersistedPayPeriodSettings() };
        set({ settings: mergedSettings });
      })
      .catch((err) => {
        set({ settings: prev });
        toast.error(err instanceof Error ? err.message : "Failed to save settings");
      });
  },

  addClient: (client) => {
    if (get().currentUser.role !== "contractor") return;
    const id = crypto.randomUUID();
    const newClient: Client = { ...client, id, documents: [] };
    set((state) => ({ clients: [...state.clients, newClient] }));
    void apiCreateClient(newClient).catch((err) => {
      set((state) => ({ clients: state.clients.filter((c) => c.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to save client");
    });
  },

  addClientDocument: (clientId, document) => {
    if (get().currentUser.role !== "contractor") return;
    set((state) => ({
      clients: state.clients.map((client) =>
        client.id === clientId ? { ...client, documents: [...client.documents, { ...document, id: createId("client-doc") }] } : client,
      ),
    }));
  },

  updateClientDocument: (clientId, documentId, updates) => {
    if (get().currentUser.role !== "contractor") return;
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
    if (get().currentUser.role !== "contractor") return;
    const prev = get().clients.find((c) => c.id === id);
    set((state) => ({ clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)) }));
    void apiUpdateClient(id, updates).catch((err) => {
      if (prev) set((state) => ({ clients: state.clients.map((c) => (c.id === id ? prev : c)) }));
      toast.error(err instanceof Error ? err.message : "Failed to update client");
    });
  },

  deleteClient: (id) => {
    if (get().currentUser.role !== "contractor") return;
    const s = get();
    const snapshot = {
      clients: s.clients,
      projects: s.projects,
      timeEntries: s.timeEntries,
      invoices: s.invoices,
      activeSession: s.activeSession,
      viewerClientId: s.viewerClientId,
    };
    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
      projects: state.projects.filter((p) => p.clientId !== id),
      timeEntries: state.timeEntries.filter((e) => e.clientId !== id),
      invoices: state.invoices.filter((inv) => inv.clientId !== id),
      activeSession: state.activeSession.clientId === id ? (clearPersistedActiveSession(), { isActive: false } as WorkSession) : state.activeSession,
      viewerClientId:
        state.viewerClientId === id
          ? state.viewerClientLocked
            ? undefined
            : resolveViewerClientId(state.clients.filter((c) => c.id !== id), state.settings)
          : state.viewerClientId,
    }));
    void apiDeleteClient(id).catch((err) => {
      set(snapshot);
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    });
  },

  addProject: (project) => {
    if (get().currentUser.role !== "contractor") return;
    const id = crypto.randomUUID();
    const newProject: Project = { ...project, id, documents: [] };
    set((state) => ({ projects: [...state.projects, newProject] }));
    void apiCreateProject(newProject).catch((err) => {
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
      toast.error(err instanceof Error ? err.message : "Failed to save project");
    });
  },

  updateProject: (id, updates) => {
    if (get().currentUser.role !== "contractor") return;
    const prev = get().projects.find((p) => p.id === id);
    set((state) => ({ projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
    void apiUpdateProject(id, updates).catch((err) => {
      if (prev) set((state) => ({ projects: state.projects.map((p) => (p.id === id ? prev : p)) }));
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    });
  },

  deleteProject: (id) => {
    if (get().currentUser.role !== "contractor") return;
    const s = get();
    const snapshot = { projects: s.projects, timeEntries: s.timeEntries, activeSession: s.activeSession };
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      timeEntries: state.timeEntries.map((e) => (e.projectId === id ? { ...e, projectId: undefined } : e)),
      activeSession: state.activeSession.projectId === id ? (clearPersistedActiveSession(), { isActive: false } as WorkSession) : state.activeSession,
    }));
    void apiDeleteProject(id).catch((err) => {
      set(snapshot);
      toast.error(err instanceof Error ? err.message : "Failed to delete project");
    });
  },

  addProjectDocument: (projectId, document) => {
    if (get().currentUser.role !== "contractor") return;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, documents: [...project.documents, { ...document, id: createId("project-doc") }] } : project,
      ),
    }));
  },

  updateProjectDocument: (projectId, documentId, updates) => {
    if (get().currentUser.role !== "contractor") return;
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

  startSession: (clientId, notes, projectId) => {
    const state = get();
    if (state.activeSession.isActive || !clientId || state.currentUser.role === "client_viewer") return false;

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
    if (get().currentUser.role !== "contractor") return;
    set((state) => {
      const next = { ...state.activeSession, ...updates };
      persistActiveSession(next);
      return { activeSession: next };
    });
  },

  stopSession: () => {
    const state = get();
    if (state.currentUser.role !== "contractor" || !state.activeSession.isActive || !state.activeSession.startedAt || !state.activeSession.clientId) {
      return null;
    }

    const startedAt = new Date(state.activeSession.startedAt);
    const endedAt = new Date();
    const activeTrackedSeconds = getTrackedSessionSeconds(state.activeSession, endedAt);
    const durationHours = Number((activeTrackedSeconds / 60 / 60).toFixed(2));
    const id = crypto.randomUUID();
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
      status: "completed",
      billable: true,
      invoiced: false,
      invoiceId: null,
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
    if (state.currentUser.role !== "contractor") return;

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
    if (get().currentUser.role !== "contractor") return;
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
    if (get().currentUser.role !== "contractor") return;
    const prev = get().timeEntries;
    set((state) => ({ timeEntries: state.timeEntries.filter((e) => e.id !== id) }));
    void apiDeleteTimeEntry(id).catch((err) => {
      set({ timeEntries: prev });
      toast.error(err instanceof Error ? err.message : "Failed to delete time entry");
    });
  },

  addExpense: (expense) => {
    if (get().currentUser.role !== "contractor") return;

    set((state) => {
      const expenses = [normalizeExpenseRecord({ id: crypto.randomUUID(), ...expense }), ...state.expenses];
      writePersistedExpenses(expenses);
      return { expenses };
    });
  },

  updateExpense: (id, updates) => {
    if (get().currentUser.role !== "contractor") return;

    set((state) => {
      const expenses = state.expenses.map((expense) => (expense.id === id ? normalizeExpenseRecord({ ...expense, ...updates }) : expense));
      writePersistedExpenses(expenses);
      return { expenses };
    });
  },

  deleteExpense: (id) => {
    if (get().currentUser.role !== "contractor") return;

    set((state) => {
      const expenses = state.expenses.filter((expense) => expense.id !== id);
      writePersistedExpenses(expenses);
      return { expenses };
    });
  },

  markTimeEntryInvoiced: (id) => {
    if (get().currentUser.role !== "contractor") return;
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
    if (get().currentUser.role !== "contractor") return;
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
    if (state.currentUser.role !== "contractor") return [];

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
    });

    return nextInvoices;
  },

  commitSingleInvoice: (preview) => {
    const state = get();
    if (state.currentUser.role !== "contractor") return null;

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

    return invoice;
  },

  updateInvoice: (id, updates) => {
    if (get().currentUser.role !== "contractor") return;
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
    if (get().currentUser.role !== "contractor") return;
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
    void apiDeleteInvoice(id).catch((err) => {
      set({ invoices: prevInvoices, timeEntries: prevEntries, expenses: prevExpenses });
      writePersistedExpenses(prevExpenses);
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    });
  },

  saveEmailDraft: (draft) => {
    if (get().currentUser.role !== "contractor") return;
    set((state) => ({ emailDrafts: { ...state.emailDrafts, [draft.invoiceId]: draft } }));
  },

  markEmailDraftReady: (invoiceId, ready) => {
    if (get().currentUser.role !== "contractor") return;
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
}));
