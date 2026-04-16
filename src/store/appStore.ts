import { create } from "zustand";
import { toast } from "sonner";

import { materializeInvoiceDrafts, normalizeInvoiceRecord } from "@/lib/invoice";
import { normalizeTimeEntryRecord } from "@/lib/projects";
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
  companyViewerAccess: false,
  emailTemplate: "",
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
      const normalizedClients = clients.map((c) => ({ ...c, documents: [] }));
      const normalizedProjects = projects.map((p) => ({ ...p, documents: [] }));
      const normalizedEntries = timeEntries.map((e) => normalizeTimeEntryRecord(e, normalizedClients, normalizedProjects));
      const normalizedInvoices = invoices.map((inv) => normalizeInvoiceRecord(inv, normalizedEntries));
      set({
        clients: normalizedClients,
        projects: normalizedProjects,
        timeEntries: normalizedEntries,
        invoices: normalizedInvoices,
        settings,
        hydrated: true,
      });
    } catch (err) {
      set({ hydrated: true });
      toast.error(err instanceof Error ? err.message : "Failed to load data from server");
    }
  },

  setHydrated: (hydrated) => set({ hydrated }),

  setRole: (role) =>
    set((state) => ({
      currentUser: { ...state.currentUser, role },
      viewerClientId:
        role === "client_viewer"
          ? resolveViewerClientId(state.clients, state.settings, state.viewerClientId)
          : state.viewerClientId,
      viewerClientLocked: role === "client_viewer" ? state.viewerClientLocked : false,
    })),

  setViewerClientContext: (clientId, locked = false) =>
    set((state) => ({
      viewerClientId: locked ? clientId : resolveViewerClientId(state.clients, state.settings, clientId),
      viewerClientLocked: locked,
    })),

  syncCurrentUser: (updates) => set((state) => ({ currentUser: { ...state.currentUser, ...updates } })),

  updateCurrentUser: (updates) => {
    if (get().currentUser.role !== "contractor") return;
    set((state) => ({ currentUser: { ...state.currentUser, ...updates } }));
  },

  updateSettings: (updates) => {
    if (get().currentUser.role !== "contractor") return;
    const prev = get().settings;
    set((state) => ({ settings: { ...state.settings, ...updates } }));
    void apiSaveSettings(updates).catch((err) => {
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
      activeSession: state.activeSession.clientId === id ? { isActive: false } : state.activeSession,
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
      activeSession: state.activeSession.projectId === id ? { isActive: false } : state.activeSession,
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

    set({
      activeSession: {
        isActive: true,
        clientId,
        projectId,
        billingRate: projectId ? state.projects.find((p) => p.id === projectId)?.hourlyRate : state.clients.find((c) => c.id === clientId)?.hourlyRate,
        startedAt: new Date().toISOString(),
        notes: notes?.trim(),
      },
    });

    return true;
  },

  updateActiveSession: (updates) => {
    if (get().currentUser.role !== "contractor") return;
    set((state) => ({ activeSession: { ...state.activeSession, ...updates } }));
  },

  stopSession: () => {
    const state = get();
    if (state.currentUser.role !== "contractor" || !state.activeSession.isActive || !state.activeSession.startedAt || !state.activeSession.clientId) {
      return null;
    }

    const startedAt = new Date(state.activeSession.startedAt);
    const endedAt = new Date();
    const durationHours = Number((((endedAt.getTime() - startedAt.getTime()) / 1000 / 60 / 60)).toFixed(2));
    const id = crypto.randomUUID();
    const entry: TimeEntry = {
      id,
      clientId: state.activeSession.clientId,
      projectId: state.activeSession.projectId,
      date: startedAt.toISOString().slice(0, 10),
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
    previews.forEach((preview, i) => {
      const invoice = nextInvoices[i];
      if (invoice) preview.entryIds.forEach((eid) => entryToInvoiceId.set(eid, invoice.id));
    });

    set((current) => ({
      invoices: [...nextInvoices, ...current.invoices],
      timeEntries: current.timeEntries.map((entry) => {
        const invoiceId = entryToInvoiceId.get(entry.id);
        return invoiceId ? { ...entry, status: "invoiced" as const, invoiced: true, invoiceId } : entry;
      }),
    }));

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

    set((current) => ({
      invoices: [invoice, ...current.invoices],
      timeEntries: current.timeEntries.map((entry) =>
        preview.entryIds.includes(entry.id) ? { ...entry, status: "invoiced" as const, invoiced: true, invoiceId: invoice.id } : entry,
      ),
    }));

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
    set((state) => ({ invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)) }));
    void apiUpdateInvoice(id, updates).catch((err) => {
      if (prev) set((state) => ({ invoices: state.invoices.map((inv) => (inv.id === id ? prev : inv)) }));
      toast.error(err instanceof Error ? err.message : "Failed to update invoice");
    });
  },

  deleteInvoice: (id) => {
    if (get().currentUser.role !== "contractor") return;
    const s = get();
    const invoice = s.invoices.find((inv) => inv.id === id);
    const linkedEntryIds = new Set(invoice?.entryIds ?? []);
    const prevInvoices = s.invoices;
    const prevEntries = s.timeEntries;
    set((state) => ({
      invoices: state.invoices.filter((inv) => inv.id !== id),
      timeEntries: state.timeEntries.map((entry) =>
        linkedEntryIds.has(entry.id) ? { ...entry, status: "completed" as const, invoiced: false, invoiceId: null } : entry,
      ),
    }));
    void apiDeleteInvoice(id).catch((err) => {
      set({ invoices: prevInvoices, timeEntries: prevEntries });
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

  resetApp: () =>
    set({
      ...emptyState,
      authStatus: "unauthenticated",
      hydrated: true,
    }),
}));
