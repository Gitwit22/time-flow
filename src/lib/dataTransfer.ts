import type { Client, Expense, Project, TimeEntry } from "@/types";
import { toDateOnlyString } from "@/lib/date";

export const EXPORT_VERSION = 1 as const;
export const EXPORT_SOURCE = "timeflow" as const;

// ── Export types ──────────────────────────────────────────────────────────────

export interface ExportClient {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contacts?: Array<{ name: string; email: string }>;
  hourlyRate?: number;
}

export interface ExportProject {
  id: string;
  clientId: string;
  name: string;
  status: string;
  description: string;
  billingType: string;
  hourlyRate: number;
  maxPayoutCap: number;
  capHandling: string;
  startDate: string;
  endDate?: string;
  notes: string;
}

export interface ExportTimeEntry {
  id: string;
  clientId: string;
  projectId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationHours: number;
  billingRate?: number;
  billable: boolean;
  invoiced: boolean;
  notes: string;
  status: string;
}

export interface ExportExpense {
  id: string;
  amount: number;
  billableToClient?: boolean;
  category: Expense["category"];
  billTo?: Expense["billTo"];
  clientId?: string;
  date: string;
  description: string;
  excludedFromPayPeriod?: boolean;
  includedInPayPeriod?: boolean;
  invoiceId?: string | null;
  notes: string;
  projectId?: string;
  receiptAttached?: boolean;
  status?: Expense["status"];
  vendor?: string;
}

export interface TimeFlowExport {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  source: typeof EXPORT_SOURCE;
  customers: ExportClient[];
  projects: ExportProject[];
  timeEntries: ExportTimeEntry[];
  expenses: ExportExpense[];
}

// ── Export options ────────────────────────────────────────────────────────────

export interface ExportOptions {
  clientId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Export builder ────────────────────────────────────────────────────────────

function toExportClient(client: Client): ExportClient {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contacts: client.contacts,
    hourlyRate: client.hourlyRate,
  };
}

function toExportProject(project: Project): ExportProject {
  return {
    id: project.id,
    clientId: project.clientId,
    name: project.name,
    status: project.status,
    description: project.description,
    billingType: project.billingType,
    hourlyRate: project.hourlyRate,
    maxPayoutCap: project.maxPayoutCap,
    capHandling: project.capHandling,
    startDate: project.startDate,
    endDate: project.endDate,
    notes: project.notes,
  };
}

function toExportTimeEntry(entry: TimeEntry): ExportTimeEntry {
  return {
    id: entry.id,
    clientId: entry.clientId,
    projectId: entry.projectId,
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationHours: entry.durationHours,
    billingRate: entry.billingRate,
    billable: entry.billable,
    invoiced: entry.invoiced,
    notes: entry.notes,
    status: entry.status,
  };
}

function toExportExpense(expense: Expense): ExportExpense {
  return {
    id: expense.id,
    amount: expense.amount,
    billableToClient: expense.billableToClient,
    category: expense.category,
    billTo: expense.billTo,
    clientId: expense.clientId,
    date: expense.date,
    description: expense.description,
    excludedFromPayPeriod: expense.excludedFromPayPeriod,
    includedInPayPeriod: expense.includedInPayPeriod,
    invoiceId: expense.invoiceId,
    notes: expense.notes,
    projectId: expense.projectId,
    receiptAttached: expense.receiptAttached,
    status: expense.status,
    vendor: expense.vendor,
  };
}

export function buildExportPayload(
  clients: Client[],
  projects: Project[],
  timeEntries: TimeEntry[],
  expenses: Expense[],
  options: ExportOptions = {},
): TimeFlowExport {
  let filteredClients = clients;
  let filteredProjects = projects;
  let filteredEntries = timeEntries;
  let filteredExpenses = expenses;

  if (options.clientId) {
    filteredClients = clients.filter((c) => c.id === options.clientId);
    filteredProjects = projects.filter((p) => p.clientId === options.clientId);
    filteredEntries = timeEntries.filter((e) => e.clientId === options.clientId);
    filteredExpenses = expenses.filter((expense) => expense.clientId === options.clientId);
  }

  if (options.projectId) {
    const project = projects.find((p) => p.id === options.projectId);
    filteredClients = project ? clients.filter((c) => c.id === project.clientId) : [];
    filteredProjects = projects.filter((p) => p.id === options.projectId);
    filteredEntries = timeEntries.filter((e) => e.projectId === options.projectId);
    filteredExpenses = expenses.filter((expense) => expense.projectId === options.projectId);
  }

  if (options.dateFrom) {
    filteredEntries = filteredEntries.filter((e) => e.date >= options.dateFrom!);
    filteredExpenses = filteredExpenses.filter((expense) => expense.date >= options.dateFrom!);
  }

  if (options.dateTo) {
    filteredEntries = filteredEntries.filter((e) => e.date <= options.dateTo!);
    filteredExpenses = filteredExpenses.filter((expense) => expense.date <= options.dateTo!);
  }

  // When filtering by date range without a client/project filter,
  // only include clients/projects that are referenced by the filtered records.
  if (!options.clientId && !options.projectId && (options.dateFrom || options.dateTo)) {
    const usedClientIds = new Set([
      ...filteredEntries.map((e) => e.clientId),
      ...filteredExpenses.map((expense) => expense.clientId).filter(Boolean),
    ]);
    const usedProjectIds = new Set([
      ...filteredEntries.map((e) => e.projectId).filter(Boolean),
      ...filteredExpenses.map((expense) => expense.projectId).filter(Boolean),
    ]);
    filteredClients = filteredClients.filter((c) => usedClientIds.has(c.id));
    filteredProjects = filteredProjects.filter((p) => usedProjectIds.has(p.id));
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: EXPORT_SOURCE,
    customers: filteredClients.map(toExportClient),
    projects: filteredProjects.map(toExportProject),
    timeEntries: filteredEntries.map(toExportTimeEntry),
    expenses: filteredExpenses.map(toExportExpense),
  };
}

export function downloadExportFile(payload: TimeFlowExport, filename?: string) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `timeflow-export-${toDateOnlyString(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Import validation ─────────────────────────────────────────────────────────

export interface ParseResult {
  ok: true;
  payload: TimeFlowExport;
}

export interface ParseError {
  ok: false;
  error: string;
}

export function parseImportPayload(raw: unknown): ParseResult | ParseError {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "File does not contain a valid JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.source !== EXPORT_SOURCE) {
    return { ok: false, error: `Unrecognised export source "${String(obj.source ?? "")}". Expected "timeflow".` };
  }

  if (obj.version !== EXPORT_VERSION) {
    return { ok: false, error: `Unsupported export version "${String(obj.version ?? "")}". Only version 1 is supported.` };
  }

  if (!Array.isArray(obj.customers)) {
    return { ok: false, error: "Missing or invalid 'customers' array." };
  }

  if (!Array.isArray(obj.projects)) {
    return { ok: false, error: "Missing or invalid 'projects' array." };
  }

  if (!Array.isArray(obj.timeEntries)) {
    return { ok: false, error: "Missing or invalid 'timeEntries' array." };
  }

  if (obj.expenses !== undefined && !Array.isArray(obj.expenses)) {
    return { ok: false, error: "Invalid 'expenses' array." };
  }

  return {
    ok: true,
    payload: {
      ...(obj as unknown as Omit<TimeFlowExport, "expenses">),
      expenses: Array.isArray(obj.expenses) ? (obj.expenses as ExportExpense[]) : [],
    },
  };
}

export async function readImportFile(file: File): Promise<ParseResult | ParseError> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        resolve(parseImportPayload(parsed));
      } catch {
        resolve({ ok: false, error: "The file is not valid JSON." });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: "Failed to read the file." });
    reader.readAsText(file);
  });
}

// ── Import preview ────────────────────────────────────────────────────────────

export type ConflictStrategy = "skip" | "merge" | "create_new";

export interface ImportConflict {
  type: "customer" | "project" | "time_entry" | "expense";
  sourceId: string;
  sourceName: string;
  existingId: string;
  existingName: string;
}

export interface ImportPreview {
  customersToCreate: ExportClient[];
  customersToUpdate: ExportClient[];
  customersToSkip: ExportClient[];
  projectsToCreate: ExportProject[];
  projectsToUpdate: ExportProject[];
  projectsToSkip: ExportProject[];
  entriesToCreate: ExportTimeEntry[];
  entriesToSkip: ExportTimeEntry[];
  expensesToCreate: ExportExpense[];
  expensesToSkip: ExportExpense[];
  conflicts: ImportConflict[];
  totalCustomers: number;
  totalProjects: number;
  totalEntries: number;
  totalExpenses: number;
}

export function previewImport(
  payload: TimeFlowExport,
  existingClients: Client[],
  existingProjects: Project[],
  existingEntries: TimeEntry[],
  existingExpenses: Expense[],
  strategy: ConflictStrategy,
): ImportPreview {
  const existingClientById = new Map(existingClients.map((c) => [c.id, c]));
  const existingProjectById = new Map(existingProjects.map((p) => [p.id, p]));
  const existingEntryById = new Map(existingEntries.map((e) => [e.id, e]));
  const existingExpenseById = new Map(existingExpenses.map((expense) => [expense.id, expense]));

  // Match clients by ID, fall back to name match for new-ID strategies
  const existingClientByName = new Map(existingClients.map((c) => [c.name.toLowerCase().trim(), c]));
  const existingProjectByName = new Map(existingProjects.map((p) => [`${p.clientId}::${p.name.toLowerCase().trim()}`, p]));

  const customersToCreate: ExportClient[] = [];
  const customersToUpdate: ExportClient[] = [];
  const customersToSkip: ExportClient[] = [];
  const conflicts: ImportConflict[] = [];

  for (const customer of payload.customers) {
    const byId = existingClientById.get(customer.id);
    const byName = existingClientByName.get(customer.name.toLowerCase().trim());
    const existing = byId ?? byName;

    if (!existing) {
      customersToCreate.push(customer);
    } else if (strategy === "skip") {
      customersToSkip.push(customer);
      conflicts.push({ type: "customer", sourceId: customer.id, sourceName: customer.name, existingId: existing.id, existingName: existing.name });
    } else if (strategy === "merge") {
      customersToUpdate.push(customer);
    } else {
      // create_new — treat as brand new regardless
      customersToCreate.push(customer);
    }
  }

  const projectsToCreate: ExportProject[] = [];
  const projectsToUpdate: ExportProject[] = [];
  const projectsToSkip: ExportProject[] = [];

  for (const project of payload.projects) {
    const byId = existingProjectById.get(project.id);
    // For name-match we use the mapped client id for create_new strategy too
    const nameKey = `${project.clientId}::${project.name.toLowerCase().trim()}`;
    const byName = existingProjectByName.get(nameKey);
    const existing = byId ?? byName;

    if (!existing) {
      projectsToCreate.push(project);
    } else if (strategy === "skip") {
      projectsToSkip.push(project);
      conflicts.push({ type: "project", sourceId: project.id, sourceName: project.name, existingId: existing.id, existingName: existing.name });
    } else if (strategy === "merge") {
      projectsToUpdate.push(project);
    } else {
      projectsToCreate.push(project);
    }
  }

  const entriesToCreate: ExportTimeEntry[] = [];
  const entriesToSkip: ExportTimeEntry[] = [];

  for (const entry of payload.timeEntries) {
    const existing = existingEntryById.get(entry.id);
    if (!existing) {
      entriesToCreate.push(entry);
    } else if (strategy === "skip") {
      entriesToSkip.push(entry);
    } else if (strategy === "merge") {
      // Re-import with same ID overwrites
      entriesToCreate.push(entry);
    } else {
      // create_new — always create
      entriesToCreate.push(entry);
    }
  }

  const expensesToCreate: ExportExpense[] = [];
  const expensesToSkip: ExportExpense[] = [];

  for (const expense of payload.expenses) {
    const existing = existingExpenseById.get(expense.id);
    if (!existing) {
      expensesToCreate.push(expense);
    } else if (strategy === "skip") {
      expensesToSkip.push(expense);
      conflicts.push({
        type: "expense",
        sourceId: expense.id,
        sourceName: expense.description || expense.id,
        existingId: existing.id,
        existingName: existing.description || existing.id,
      });
    } else {
      expensesToCreate.push(expense);
    }
  }

  return {
    customersToCreate,
    customersToUpdate,
    customersToSkip,
    projectsToCreate,
    projectsToUpdate,
    projectsToSkip,
    entriesToCreate,
    entriesToSkip,
    expensesToCreate,
    expensesToSkip,
    conflicts,
    totalCustomers: payload.customers.length,
    totalProjects: payload.projects.length,
    totalEntries: payload.timeEntries.length,
    totalExpenses: payload.expenses.length,
  };
}

// ── Import execution ──────────────────────────────────────────────────────────

export interface ImportResult {
  customersImported: number;
  customersUpdated: number;
  customersSkipped: number;
  projectsImported: number;
  projectsUpdated: number;
  projectsSkipped: number;
  entriesImported: number;
  entriesSkipped: number;
  expensesImported: number;
  expensesSkipped: number;
  failed: number;
  errors: string[];
}

export interface ImportActions {
  addClient: (client: Omit<Client, "id">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addTimeEntry: (entry: Omit<TimeEntry, "id" | "status" | "durationHours"> & { durationHours?: number; status?: TimeEntry["status"] }) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  getClients: () => Client[];
  getProjects: () => Project[];
}

function clientFromExport(src: ExportClient): Omit<Client, "id"> {
  return {
    name: src.name,
    contactName: src.contactName,
    contactEmail: src.contactEmail,
    contacts: src.contacts ?? [],
    hourlyRate: src.hourlyRate,
    companyViewerEnabled: false,
    documents: [],
  };
}

function projectFromExport(src: ExportProject, clientIdMap: Map<string, string>): Omit<Project, "id"> {
  const resolvedClientId = clientIdMap.get(src.clientId) ?? src.clientId;
  return {
    name: src.name,
    clientId: resolvedClientId,
    status: src.status as Project["status"],
    description: src.description,
    billingType: src.billingType as Project["billingType"],
    hourlyRate: src.hourlyRate,
    maxPayoutCap: src.maxPayoutCap,
    capHandling: src.capHandling as Project["capHandling"],
    startDate: src.startDate,
    endDate: src.endDate,
    notes: src.notes,
    documents: [],
  };
}

function entryFromExport(
  src: ExportTimeEntry,
  clientIdMap: Map<string, string>,
  projectIdMap: Map<string, string>,
  existingProjectIds: Set<string>,
): Omit<TimeEntry, "id"> {
  const resolvedClientId = clientIdMap.get(src.clientId) ?? src.clientId;
  // Prefer a mapped project ID; fall back to the raw ID only if it already
  // exists in the DB (partial exports). Otherwise null it to avoid a
  // foreign-key violation.
  const resolvedProjectId = src.projectId
    ? (projectIdMap.get(src.projectId) ?? (existingProjectIds.has(src.projectId) ? src.projectId : undefined))
    : undefined;
  return {
    clientId: resolvedClientId,
    projectId: resolvedProjectId,
    date: src.date,
    startTime: src.startTime,
    endTime: src.endTime,
    durationHours: src.durationHours,
    billingRate: src.billingRate,
    billable: src.billable,
    invoiced: src.invoiced,
    invoiceId: null,
    notes: src.notes,
    status: src.status === "running" || src.status === "completed" ? src.status : "completed",
  };
}

function expenseFromExport(
  src: ExportExpense,
  clientIdMap: Map<string, string>,
  projectIdMap: Map<string, string>,
  existingClientIds: Set<string>,
  existingProjectIds: Set<string>,
): Omit<Expense, "id"> {
  const billTo = src.billTo ?? (src.projectId ? "project" : "client");
  const resolvedClientId = src.clientId
    ? (clientIdMap.get(src.clientId) ?? (existingClientIds.has(src.clientId) ? src.clientId : undefined))
    : undefined;
  const resolvedProjectId = src.projectId
    ? (projectIdMap.get(src.projectId) ?? (existingProjectIds.has(src.projectId) ? src.projectId : undefined))
    : undefined;

  return {
    amount: src.amount,
    billableToClient: src.billableToClient ?? true,
    billTo,
    category: src.category,
    clientId: resolvedClientId,
    date: src.date,
    description: src.description,
    excludedFromPayPeriod: src.excludedFromPayPeriod,
    includedInPayPeriod: src.includedInPayPeriod,
    invoiceId: src.invoiceId ?? null,
    notes: src.notes,
    projectId: billTo === "project" ? resolvedProjectId : undefined,
    receiptAttached: src.receiptAttached ?? false,
    status: src.status ?? (src.billableToClient === false ? "non_billable" : "billable"),
    vendor: src.vendor,
  };
}

export function executeImport(
  preview: ImportPreview,
  strategy: ConflictStrategy,
  actions: ImportActions,
): ImportResult {
  const result: ImportResult = {
    customersImported: 0,
    customersUpdated: 0,
    customersSkipped: 0,
    projectsImported: 0,
    projectsUpdated: 0,
    projectsSkipped: 0,
    entriesImported: 0,
    entriesSkipped: 0,
    expensesImported: 0,
    expensesSkipped: 0,
    failed: 0,
    errors: [],
  };

  // We need stable ID maps to wire up relationships
  // For "create_new", newly created clients get new IDs; we can't predict them
  // without store access. So we use getClients/getProjects snapshots before/after.

  const clientIdMap = new Map<string, string>(); // sourceId → destinationId
  const projectIdMap = new Map<string, string>(); // sourceId → destinationId

  // 1. Customers
  const clientsBefore = actions.getClients();
  const clientsBeforeIds = new Set(clientsBefore.map((c) => c.id));

  for (const customer of preview.customersToCreate) {
    try {
      actions.addClient(clientFromExport(customer));
      result.customersImported++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to import customer "${customer.name}": ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // Map new IDs: find newly created clients by name
  const clientsAfterCreate = actions.getClients();
  for (const customer of preview.customersToCreate) {
    const newClient = clientsAfterCreate.find(
      (c) => !clientsBeforeIds.has(c.id) && c.name.toLowerCase().trim() === customer.name.toLowerCase().trim(),
    );
    if (newClient) {
      clientIdMap.set(customer.id, newClient.id);
    } else {
      clientIdMap.set(customer.id, customer.id);
    }
  }

  for (const customer of preview.customersToUpdate) {
    try {
      const existing = clientsBefore.find((c) => c.id === customer.id) ?? clientsBefore.find((c) => c.name.toLowerCase().trim() === customer.name.toLowerCase().trim());
      if (existing) {
        actions.updateClient(existing.id, { name: customer.name, contactName: customer.contactName, contactEmail: customer.contactEmail, hourlyRate: customer.hourlyRate });
        clientIdMap.set(customer.id, existing.id);
        result.customersUpdated++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to update customer "${customer.name}": ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const customer of preview.customersToSkip) {
    const existing = clientsBefore.find((c) => c.id === customer.id) ?? clientsBefore.find((c) => c.name.toLowerCase().trim() === customer.name.toLowerCase().trim());
    if (existing) {
      clientIdMap.set(customer.id, existing.id);
    }
    result.customersSkipped++;
  }

  // 2. Projects
  const projectsBefore = actions.getProjects();
  const projectsBeforeIds = new Set(projectsBefore.map((p) => p.id));

  for (const project of preview.projectsToCreate) {
    try {
      actions.addProject(projectFromExport(project, clientIdMap));
      result.projectsImported++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to import project "${project.name}": ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const projectsAfterCreate = actions.getProjects();
  for (const project of preview.projectsToCreate) {
    const resolvedClientId = clientIdMap.get(project.clientId) ?? project.clientId;
    const newProject = projectsAfterCreate.find(
      (p) => !projectsBeforeIds.has(p.id) && p.name.toLowerCase().trim() === project.name.toLowerCase().trim() && p.clientId === resolvedClientId,
    );
    if (newProject) {
      projectIdMap.set(project.id, newProject.id);
    } else {
      projectIdMap.set(project.id, project.id);
    }
  }

  for (const project of preview.projectsToUpdate) {
    try {
      const existing = projectsBefore.find((p) => p.id === project.id) ?? projectsBefore.find((p) => {
        const resolvedClientId = clientIdMap.get(project.clientId) ?? project.clientId;
        return p.clientId === resolvedClientId && p.name.toLowerCase().trim() === project.name.toLowerCase().trim();
      });
      if (existing) {
        actions.updateProject(existing.id, { name: project.name, status: project.status as Project["status"], hourlyRate: project.hourlyRate, notes: project.notes });
        projectIdMap.set(project.id, existing.id);
        result.projectsUpdated++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to update project "${project.name}": ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const project of preview.projectsToSkip) {
    const existing = projectsBefore.find((p) => p.id === project.id) ?? projectsBefore.find((p) => p.name.toLowerCase().trim() === project.name.toLowerCase().trim());
    if (existing) {
      projectIdMap.set(project.id, existing.id);
    }
    result.projectsSkipped++;
  }

  // 3. Time entries
  const existingProjectIds = new Set(actions.getProjects().map((p) => p.id));
  for (const entry of preview.entriesToCreate) {
    try {
      actions.addTimeEntry(entryFromExport(entry, clientIdMap, projectIdMap, existingProjectIds));
      result.entriesImported++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to import time entry ${entry.id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const _entry of preview.entriesToSkip) {
    result.entriesSkipped++;
  }

  // 4. Expenses
  const existingClientIds = new Set(actions.getClients().map((client) => client.id));
  for (const expense of preview.expensesToCreate) {
    try {
      actions.addExpense(expenseFromExport(expense, clientIdMap, projectIdMap, existingClientIds, existingProjectIds));
      result.expensesImported++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to import expense ${expense.id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const _expense of preview.expensesToSkip) {
    result.expensesSkipped++;
  }

  return result;
}
