import { describe, expect, it } from "vitest";

import type { Client, Expense, Project, TimeEntry } from "@/types";
import {
  buildExportPayload,
  executeImport,
  parseImportPayload,
  previewImport,
  type ImportPreview,
} from "@/lib/dataTransfer";

// ── Test data helpers ─────────────────────────────────────────────────────────

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Acme Co",
    companyViewerEnabled: false,
    documents: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Website Redesign",
    clientId: "client-1",
    status: "active",
    description: "",
    billingType: "hourly_uncapped",
    hourlyRate: 100,
    maxPayoutCap: 0,
    capHandling: "allow_overage",
    startDate: "2026-01-01",
    notes: "",
    documents: [],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "entry-1",
    clientId: "client-1",
    projectId: "proj-1",
    date: "2026-04-08",
    startTime: "09:00",
    endTime: "11:00",
    durationHours: 2,
    billable: true,
    invoiced: false,
    invoiceId: null,
    notes: "Homepage updates",
    status: "completed",
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",
    amount: 125,
    category: "software",
    clientId: "client-1",
    projectId: "proj-1",
    date: "2026-04-08",
    description: "Design tool subscription",
    notes: "Monthly seat",
    ...overrides,
  };
}

// ── parseImportPayload ────────────────────────────────────────────────────────

describe("parseImportPayload", () => {
  it("rejects null", () => {
    const result = parseImportPayload(null);
    expect(result.ok).toBe(false);
  });

  it("rejects arrays", () => {
    const result = parseImportPayload([]);
    expect(result.ok).toBe(false);
  });

  it("rejects wrong source", () => {
    const result = parseImportPayload({ source: "other", version: 1, customers: [], projects: [], timeEntries: [], expenses: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("source");
  });

  it("rejects wrong version", () => {
    const result = parseImportPayload({ source: "timeflow", version: 2, customers: [], projects: [], timeEntries: [], expenses: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("version");
  });

  it("rejects missing arrays", () => {
    const result = parseImportPayload({ source: "timeflow", version: 1, customers: [] });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid payload", () => {
    const result = parseImportPayload({
      source: "timeflow",
      version: 1,
      exportedAt: "2026-04-09T13:00:00Z",
      customers: [],
      projects: [],
      timeEntries: [],
      expenses: [],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts legacy payloads without expenses", () => {
    const result = parseImportPayload({
      source: "timeflow",
      version: 1,
      exportedAt: "2026-04-09T13:00:00Z",
      customers: [],
      projects: [],
      timeEntries: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.expenses).toEqual([]);
    }
  });
});

// ── buildExportPayload ────────────────────────────────────────────────────────

describe("buildExportPayload", () => {
  const clients = [makeClient(), makeClient({ id: "client-2", name: "Beta Inc" })];
  const projects = [makeProject(), makeProject({ id: "proj-2", clientId: "client-2", name: "API Dev" })];
  const entries = [
    makeEntry(),
    makeEntry({ id: "entry-2", clientId: "client-2", projectId: "proj-2", date: "2026-04-07" }),
  ];
  const expenses = [
    makeExpense(),
    makeExpense({ id: "expense-2", clientId: "client-2", projectId: "proj-2", date: "2026-04-07", description: "API testing credits" }),
  ];

  it("includes all data when no options given", () => {
    const payload = buildExportPayload(clients, projects, entries, expenses);
    expect(payload.version).toBe(1);
    expect(payload.source).toBe("timeflow");
    expect(payload.customers).toHaveLength(2);
    expect(payload.projects).toHaveLength(2);
    expect(payload.timeEntries).toHaveLength(2);
    expect(payload.expenses).toHaveLength(2);
  });

  it("filters by clientId", () => {
    const payload = buildExportPayload(clients, projects, entries, expenses, { clientId: "client-1" });
    expect(payload.customers).toHaveLength(1);
    expect(payload.customers[0].id).toBe("client-1");
    expect(payload.projects).toHaveLength(1);
    expect(payload.timeEntries).toHaveLength(1);
    expect(payload.expenses).toHaveLength(1);
  });

  it("filters by projectId", () => {
    const payload = buildExportPayload(clients, projects, entries, expenses, { projectId: "proj-2" });
    expect(payload.projects).toHaveLength(1);
    expect(payload.projects[0].id).toBe("proj-2");
    expect(payload.timeEntries).toHaveLength(1);
    expect(payload.timeEntries[0].id).toBe("entry-2");
    expect(payload.expenses).toHaveLength(1);
    expect(payload.expenses[0].id).toBe("expense-2");
  });

  it("filters by date range", () => {
    const payload = buildExportPayload(clients, projects, entries, expenses, { dateFrom: "2026-04-08", dateTo: "2026-04-09" });
    expect(payload.timeEntries).toHaveLength(1);
    expect(payload.timeEntries[0].date).toBe("2026-04-08");
    expect(payload.expenses).toHaveLength(1);
    expect(payload.expenses[0].date).toBe("2026-04-08");
  });

  it("does not include secrets (documents/dataUrl)", () => {
    const clientWithDoc: Client = {
      ...makeClient(),
      documents: [{ id: "doc-1", title: "Contract", originalFilename: "contract.pdf", uploadedBy: "user", uploadedAt: "2026-01-01", status: "active", mimeType: "application/pdf", sizeBytes: 1000, dataUrl: "data:application/pdf;base64,SECRET" }],
    };
    const payload = buildExportPayload([clientWithDoc], [], [], []);
    // Customers export should not include documents
    expect(JSON.stringify(payload)).not.toContain("SECRET");
  });

  it("keeps clients and projects referenced only by expenses in date-range exports", () => {
    const payload = buildExportPayload(clients, projects, [], expenses, { dateFrom: "2026-04-08", dateTo: "2026-04-08" });
    expect(payload.customers).toHaveLength(1);
    expect(payload.projects).toHaveLength(1);
    expect(payload.expenses).toHaveLength(1);
  });
});

// ── previewImport ─────────────────────────────────────────────────────────────

describe("previewImport", () => {
  const existing = {
    clients: [makeClient()],
    projects: [makeProject()],
    entries: [makeEntry()],
    expenses: [makeExpense()],
  };

  const newPayload = {
    version: 1 as const,
    exportedAt: "2026-04-09T13:00:00Z",
    source: "timeflow" as const,
    customers: [
      { id: "client-1", name: "Acme Co", hourlyRate: 100 },
      { id: "client-3", name: "New Client" },
    ],
    projects: [
      { id: "proj-1", clientId: "client-1", name: "Website Redesign", status: "active", description: "", billingType: "hourly_uncapped", hourlyRate: 100, maxPayoutCap: 0, capHandling: "allow_overage", startDate: "2026-01-01", notes: "" },
      { id: "proj-3", clientId: "client-3", name: "Brand New Project", status: "active", description: "", billingType: "hourly_uncapped", hourlyRate: 150, maxPayoutCap: 0, capHandling: "allow_overage", startDate: "2026-01-01", notes: "" },
    ],
    timeEntries: [
      { id: "entry-1", clientId: "client-1", projectId: "proj-1", date: "2026-04-08", startTime: "09:00", endTime: "11:00", durationHours: 2, billable: true, invoiced: false, notes: "Homepage", status: "completed" },
      { id: "entry-99", clientId: "client-3", projectId: "proj-3", date: "2026-04-09", startTime: "10:00", durationHours: 1, billable: true, invoiced: false, notes: "New work", status: "completed" },
    ],
    expenses: [
      { id: "expense-1", amount: 125, category: "software", clientId: "client-1", projectId: "proj-1", date: "2026-04-08", description: "Design tool subscription", notes: "Monthly seat" },
      { id: "expense-99", amount: 80, category: "travel", clientId: "client-3", projectId: "proj-3", date: "2026-04-09", description: "Site visit", notes: "Parking and mileage" },
    ],
  };

  it("skip strategy: existing records go to skip list", () => {
    const preview: ImportPreview = previewImport(newPayload, existing.clients, existing.projects, existing.entries, existing.expenses, "skip");
    expect(preview.customersToSkip).toHaveLength(1);
    expect(preview.customersToSkip[0].id).toBe("client-1");
    expect(preview.customersToCreate).toHaveLength(1);
    expect(preview.customersToCreate[0].id).toBe("client-3");
    expect(preview.entriesToSkip).toHaveLength(1);
    expect(preview.entriesToCreate).toHaveLength(1);
    expect(preview.expensesToSkip).toHaveLength(1);
    expect(preview.expensesToCreate).toHaveLength(1);
  });

  it("merge strategy: existing records go to update list", () => {
    const preview: ImportPreview = previewImport(newPayload, existing.clients, existing.projects, existing.entries, existing.expenses, "merge");
    expect(preview.customersToUpdate).toHaveLength(1);
    expect(preview.customersToCreate).toHaveLength(1);
    expect(preview.projectsToUpdate).toHaveLength(1);
    expect(preview.projectsToCreate).toHaveLength(1);
    expect(preview.expensesToCreate).toHaveLength(2);
  });

  it("create_new strategy: all records go to create list", () => {
    const preview: ImportPreview = previewImport(newPayload, existing.clients, existing.projects, existing.entries, existing.expenses, "create_new");
    expect(preview.customersToCreate).toHaveLength(2);
    expect(preview.customersToSkip).toHaveLength(0);
    expect(preview.customersToUpdate).toHaveLength(0);
    expect(preview.expensesToCreate).toHaveLength(2);
  });
});

// ── executeImport ─────────────────────────────────────────────────────────────

describe("executeImport", () => {
  it("creates new customers and projects", () => {
    const addedClients: Array<Omit<Client, "id">> = [];
    const addedProjects: Array<Omit<Project, "id">> = [];
    const addedEntries: Array<Parameters<typeof actions.addTimeEntry>[0]> = [];
    const addedExpenses: Array<Omit<Expense, "id">> = [];

    const actions = {
      addClient: (c: Omit<Client, "id">) => { addedClients.push(c); },
      updateClient: () => {},
      addProject: (p: Omit<Project, "id">) => { addedProjects.push(p); },
      updateProject: () => {},
      addTimeEntry: (e: Parameters<typeof actions.addTimeEntry>[0]) => { addedEntries.push(e); },
      updateTimeEntry: () => {},
      addExpense: (expense: Omit<Expense, "id">) => { addedExpenses.push(expense); },
      getClients: () => [] as Client[],
      getProjects: () => [] as Project[],
    };

    const preview: ImportPreview = {
      customersToCreate: [{ id: "c1", name: "New Client" }],
      customersToUpdate: [],
      customersToSkip: [],
      projectsToCreate: [{ id: "p1", clientId: "c1", name: "Project A", status: "active", description: "", billingType: "hourly_uncapped", hourlyRate: 100, maxPayoutCap: 0, capHandling: "allow_overage", startDate: "2026-01-01", notes: "" }],
      projectsToUpdate: [],
      projectsToSkip: [],
      entriesToCreate: [{ id: "e1", clientId: "c1", projectId: "p1", date: "2026-04-08", startTime: "09:00", durationHours: 2, billable: true, invoiced: false, notes: "Work", status: "completed" }],
      entriesToSkip: [],
      expensesToCreate: [{ id: "expense-1", amount: 42, category: "supplies", clientId: "c1", projectId: "p1", date: "2026-04-08", description: "Printer ink", notes: "Office restock" }],
      expensesToSkip: [],
      conflicts: [],
      totalCustomers: 1,
      totalProjects: 1,
      totalEntries: 1,
      totalExpenses: 1,
    };

    const result = executeImport(preview, "skip", actions);
    expect(result.customersImported).toBe(1);
    expect(result.projectsImported).toBe(1);
    expect(result.entriesImported).toBe(1);
    expect(result.expensesImported).toBe(1);
    expect(result.failed).toBe(0);
    expect(addedClients).toHaveLength(1);
    expect(addedProjects).toHaveLength(1);
    expect(addedEntries).toHaveLength(1);
    expect(addedExpenses).toHaveLength(1);
  });

  it("counts skipped correctly", () => {
    const actions = {
      addClient: () => {},
      updateClient: () => {},
      addProject: () => {},
      updateProject: () => {},
      addTimeEntry: () => {},
      updateTimeEntry: () => {},
      addExpense: () => {},
      getClients: () => [] as Client[],
      getProjects: () => [] as Project[],
    };

    const preview: ImportPreview = {
      customersToCreate: [],
      customersToUpdate: [],
      customersToSkip: [{ id: "c1", name: "Existing" }],
      projectsToCreate: [],
      projectsToUpdate: [],
      projectsToSkip: [{ id: "p1", clientId: "c1", name: "Existing Project", status: "active", description: "", billingType: "hourly_uncapped", hourlyRate: 100, maxPayoutCap: 0, capHandling: "allow_overage", startDate: "2026-01-01", notes: "" }],
      entriesToCreate: [],
      entriesToSkip: [{ id: "e1", clientId: "c1", date: "2026-04-08", startTime: "09:00", durationHours: 1, billable: true, invoiced: false, notes: "", status: "completed" }],
      expensesToCreate: [],
      expensesToSkip: [{ id: "expense-1", amount: 10, category: "other", clientId: "c1", date: "2026-04-08", description: "Existing expense", notes: "" }],
      conflicts: [],
      totalCustomers: 1,
      totalProjects: 1,
      totalEntries: 1,
      totalExpenses: 1,
    };

    const result = executeImport(preview, "skip", actions);
    expect(result.customersSkipped).toBe(1);
    expect(result.projectsSkipped).toBe(1);
    expect(result.entriesSkipped).toBe(1);
    expect(result.expensesSkipped).toBe(1);
    expect(result.customersImported).toBe(0);
  });
});
