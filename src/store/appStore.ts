import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createSeedData } from "@/data/seed";
import { normalizeAttachedDocumentRecord } from "@/lib/documents";
import { materializeInvoiceDrafts, normalizeInvoiceRecord } from "@/lib/invoice";
import { normalizeTimeEntryRecord } from "@/lib/projects";
import { APP_STORAGE_KEY, appStorage } from "@/lib/storage";
import type { AppSettings, AttachedDocument, Client, EmailDraft, Invoice, InvoiceDraftPreview, Project, TimeEntry, UserProfile, UserRole, WorkSession } from "@/types";

type TimeEntryDraft = Omit<TimeEntry, "id" | "status" | "durationHours"> & { durationHours?: number; status?: TimeEntry["status"] };
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
  if (!endTime) {
    return 0;
  }

  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const start = startHours * 60 + startMinutes;
  const end = endHours * 60 + endMinutes;
  return Math.max(0, Number(((end - start) / 60).toFixed(2)));
}

export interface AppState {
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
  commitInvoiceDrafts: (previews: InvoiceDraftPreview[]) => Invoice[];
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  saveEmailDraft: (draft: EmailDraft) => void;
  markEmailDraftReady: (invoiceId: string, ready: boolean) => void;
  resetApp: () => void;
}

const seedData = createSeedData();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...seedData,
      viewerClientId: undefined,
      viewerClientLocked: false,
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
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({ currentUser: { ...state.currentUser, ...updates } }));
      },
      updateSettings: (updates) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({ settings: { ...state.settings, ...updates } }));
      },
      addClient: (client) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({ clients: [...state.clients, { ...client, id: createId("client") }] }));
      },
      addClientDocument: (clientId, document) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === clientId ? { ...client, documents: [...client.documents, { ...document, id: createId("client-doc") }] } : client,
          ),
        }));
      },
      updateClientDocument: (clientId, documentId, updates) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === clientId
              ? {
                  ...client,
                  documents: client.documents.map((document) => (document.id === documentId ? { ...document, ...updates } : document)),
                }
              : client,
          ),
        }));
      },
      updateClient: (id, updates) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({ clients: state.clients.map((client) => (client.id === id ? { ...client, ...updates } : client)) }));
      },
      deleteClient: (id) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return {
            clients: state.clients.filter((client) => client.id !== id),
            projects: state.projects.filter((project) => project.clientId !== id),
            timeEntries: state.timeEntries.filter((entry) => entry.clientId !== id),
            invoices: state.invoices.filter((invoice) => invoice.clientId !== id),
            activeSession: state.activeSession.clientId === id ? { isActive: false } : state.activeSession,
            viewerClientId:
              state.viewerClientId === id
                ? (state.viewerClientLocked ? undefined : resolveViewerClientId(state.clients.filter((client) => client.id !== id), state.settings))
                : state.viewerClientId,
          };
        }),
      addProject: (project) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({ projects: [...state.projects, { ...project, id: createId("project") }] }));
      },
      updateProject: (id, updates) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({ projects: state.projects.map((project) => (project.id === id ? { ...project, ...updates } : project)) }));
      },
      deleteProject: (id) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return {
            projects: state.projects.filter((project) => project.id !== id),
            timeEntries: state.timeEntries.map((entry) => (entry.projectId === id ? { ...entry, projectId: undefined } : entry)),
            activeSession: state.activeSession.projectId === id ? { isActive: false } : state.activeSession,
          };
        }),
      addProjectDocument: (projectId, document) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, documents: [...project.documents, { ...document, id: createId("project-doc") }] } : project,
          ),
        }));
      },
      updateProjectDocument: (projectId, documentId, updates) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  documents: project.documents.map((document) => (document.id === documentId ? { ...document, ...updates } : document)),
                }
              : project,
          ),
        }));
      },
      startSession: (clientId, notes, projectId) => {
        const state = get();

        if (state.activeSession.isActive || !clientId || state.currentUser.role === "client_viewer") {
          return false;
        }

        set({
          activeSession: {
            isActive: true,
            clientId,
            projectId,
            billingRate: projectId ? state.projects.find((project) => project.id === projectId)?.hourlyRate : state.clients.find((client) => client.id === clientId)?.hourlyRate,
            startedAt: new Date().toISOString(),
            notes: notes?.trim(),
          },
        });

        return true;
      },
      updateActiveSession: (updates) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

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
        const entry: TimeEntry = {
          id: createId("entry"),
          clientId: state.activeSession.clientId,
          projectId: state.activeSession.projectId,
          date: startedAt.toISOString().slice(0, 10),
          startTime: startedAt.toTimeString().slice(0, 5),
          endTime: endedAt.toTimeString().slice(0, 5),
          durationHours,
          billingRate: state.activeSession.billingRate,
          notes: state.activeSession.notes?.trim() || "Tracked work session",
          status: "completed",
        };
        const normalizedEntry = normalizeTimeEntryRecord(entry, state.clients, state.projects);

        set((current) => ({
          timeEntries: [normalizedEntry, ...current.timeEntries],
          activeSession: { isActive: false },
        }));

        return normalizedEntry;
      },
      addTimeEntry: (entry) => {
        const state = get();
        if (state.currentUser.role !== "contractor") {
          return;
        }

        const nextEntry = normalizeTimeEntryRecord(
          {
            id: createId("entry"),
            ...entry,
            durationHours: entry.durationHours ?? calculateDurationHours(entry.startTime, entry.endTime),
            status: entry.status ?? "completed",
          },
          state.clients,
          state.projects,
        );

        set((current) => ({
          timeEntries: [
            nextEntry,
            ...current.timeEntries,
          ],
        }));
      },
      updateTimeEntry: (id, updates) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return {
            timeEntries: state.timeEntries.map((entry) => {
              if (entry.id !== id) {
                return entry;
              }

              const nextEntry = { ...entry, ...updates };

              if ((updates.startTime || updates.endTime) && nextEntry.endTime) {
                nextEntry.durationHours = calculateDurationHours(nextEntry.startTime, nextEntry.endTime);
              }

              return normalizeTimeEntryRecord(nextEntry, state.clients, state.projects);
            }),
          };
        }),
      deleteTimeEntry: (id) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return { timeEntries: state.timeEntries.filter((entry) => entry.id !== id) };
        }),
      markTimeEntryInvoiced: (id) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return {
            timeEntries: state.timeEntries.map((entry) => (entry.id === id ? { ...entry, status: "invoiced" } : entry)),
          };
        }),
      commitInvoiceDrafts: (previews) => {
        if (!previews.length) {
          return [];
        }

        const state = get();
        if (state.currentUser.role !== "contractor") {
          return [];
        }

        const nextInvoices = materializeInvoiceDrafts(previews, state.invoices);

        set((current) => ({
          invoices: [...nextInvoices, ...current.invoices],
          timeEntries: current.timeEntries.map((entry) =>
            previews.some((preview) => preview.entryIds.includes(entry.id)) ? { ...entry, status: "invoiced" } : entry,
          ),
        }));

        return nextInvoices;
      },
      updateInvoice: (id, updates) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return { invoices: state.invoices.map((invoice) => (invoice.id === id ? { ...invoice, ...updates } : invoice)) };
        }),
      saveEmailDraft: (draft) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return { emailDrafts: { ...state.emailDrafts, [draft.invoiceId]: draft } };
        }),
      markEmailDraftReady: (invoiceId, ready) =>
        set((state) => {
          if (state.currentUser.role !== "contractor") {
            return state;
          }

          return {
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
          };
        }),
      resetApp: () => set({ ...createSeedData(), hydrated: true, viewerClientId: undefined, viewerClientLocked: false }),
    }),
    {
      name: APP_STORAGE_KEY,
      storage: appStorage,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<AppState>) ?? {};
        const clients = (persisted.clients ?? currentState.clients).map((client) => ({
          ...client,
          documents: (client.documents ?? []).map((document) => normalizeAttachedDocumentRecord(document)),
        }));
        const projects = (persisted.projects ?? currentState.projects).map((project) => ({
          ...project,
          documents: (project.documents ?? []).map((document) => normalizeAttachedDocumentRecord(document)),
        }));
        const timeEntries = (persisted.timeEntries ?? currentState.timeEntries).map((entry) => normalizeTimeEntryRecord(entry, clients, projects));

        return {
          ...currentState,
          ...persisted,
          clients,
          projects,
          timeEntries,
          viewerClientId: (persisted as Partial<AppState>).viewerClientId,
          viewerClientLocked: (persisted as Partial<AppState>).viewerClientLocked ?? false,
          settings: {
            ...currentState.settings,
            ...(persisted.settings ?? {}),
          },
          invoices: (persisted.invoices ?? currentState.invoices).map((invoice) => normalizeInvoiceRecord(invoice, timeEntries)),
          hydrated: true,
        };
      },
    },
  ),
);
