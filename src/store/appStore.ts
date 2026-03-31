import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createSeedData } from "@/data/seed";
import { materializeInvoiceDrafts, normalizeInvoiceRecord } from "@/lib/invoice";
import { APP_STORAGE_KEY, appStorage } from "@/lib/storage";
import type { AppSettings, Client, EmailDraft, Invoice, InvoiceDraftPreview, TimeEntry, UserProfile, UserRole, WorkSession } from "@/types";

type TimeEntryDraft = Omit<TimeEntry, "id" | "status" | "durationHours"> & { durationHours?: number; status?: TimeEntry["status"] };
type ClientDraft = Omit<Client, "id">;

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
  settings: AppSettings;
  clients: Client[];
  timeEntries: TimeEntry[];
  activeSession: WorkSession;
  invoices: Invoice[];
  emailDrafts: Record<string, EmailDraft>;
  setHydrated: (hydrated: boolean) => void;
  setRole: (role: UserRole) => void;
  syncCurrentUser: (updates: Pick<UserProfile, "name" | "email" | "role">) => void;
  updateCurrentUser: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addClient: (client: ClientDraft) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  startSession: (clientId: string, notes?: string) => boolean;
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
      setHydrated: (hydrated) => set({ hydrated }),
      setRole: (role) => set((state) => ({ currentUser: { ...state.currentUser, role } })),
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
            timeEntries: state.timeEntries.filter((entry) => entry.clientId !== id),
            invoices: state.invoices.filter((invoice) => invoice.clientId !== id),
            activeSession: state.activeSession.clientId === id ? { isActive: false } : state.activeSession,
          };
        }),
      startSession: (clientId, notes) => {
        const state = get();

        if (state.activeSession.isActive || !clientId || state.currentUser.role === "client_viewer") {
          return false;
        }

        set({
          activeSession: {
            isActive: true,
            clientId,
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
          date: startedAt.toISOString().slice(0, 10),
          startTime: startedAt.toTimeString().slice(0, 5),
          endTime: endedAt.toTimeString().slice(0, 5),
          durationHours,
          notes: state.activeSession.notes?.trim() || "Tracked work session",
          status: "completed",
        };

        set((current) => ({
          timeEntries: [entry, ...current.timeEntries],
          activeSession: { isActive: false },
        }));

        return entry;
      },
      addTimeEntry: (entry) => {
        if (get().currentUser.role !== "contractor") {
          return;
        }

        set((state) => ({
          timeEntries: [
            {
              id: createId("entry"),
              ...entry,
              durationHours: entry.durationHours ?? calculateDurationHours(entry.startTime, entry.endTime),
              status: entry.status ?? "completed",
            },
            ...state.timeEntries,
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

              return nextEntry;
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
      resetApp: () => set({ ...createSeedData(), hydrated: true }),
    }),
    {
      name: APP_STORAGE_KEY,
      storage: appStorage,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppState>),
        invoices: ((persistedState as Partial<AppState>)?.invoices ?? currentState.invoices).map((invoice) => normalizeInvoiceRecord(invoice)),
        hydrated: true,
      }),
    },
  ),
);
