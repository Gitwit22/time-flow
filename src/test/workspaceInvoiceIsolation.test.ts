import { describe, expect, it } from "vitest";

import type { AppState } from "@/store/appStore";
import { selectWorkspaceInvoices } from "@/store/selectors";
import type { Client, Invoice } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "INV-2026-001",
    clientId: "client-1",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    billingMode: "range",
    grouping: "none",
    createdAt: "2026-08-28",
    dueDate: "2026-09-27",
    entryIds: [],
    timeEntryIds: [],
    lineItems: [],
    projectIds: [],
    totalHours: 0,
    hourlyRate: 0,
    subtotal: 100,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 100,
    hasMixedRates: false,
    status: "draft",
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Client One",
    status: "active",
    ...overrides,
  } as Client;
}

function makeState(clients: Client[], invoices: Invoice[]): AppState {
  return {
    activeOrganizationId: "org-2",
    clients,
    projects: [],
    timeEntries: [],
    expenses: [],
    projectBills: [],
    invoices,
  } as unknown as AppState;
}

describe("workspace invoice isolation", () => {
  it("only includes invoices whose workspace can be resolved to the active company", () => {
    const activeInvoice = makeInvoice({ id: "active", workspaceId: "org-2" });
    const foreignInvoice = makeInvoice({ id: "foreign", workspaceId: "org-1" });
    const linkedLegacyInvoice = makeInvoice({ id: "linked-legacy", clientId: "active-client" });
    const unscopedInvoice = makeInvoice({ id: "unscoped", clientId: "missing-client" });
    const state = makeState(
      [makeClient({ id: "active-client", workspaceId: "org-2" })],
      [activeInvoice, foreignInvoice, linkedLegacyInvoice, unscopedInvoice],
    );

    expect(selectWorkspaceInvoices(state).map((invoice) => invoice.id)).toEqual([
      "active",
      "linked-legacy",
    ]);
  });
});