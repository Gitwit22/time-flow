import type { AttachedDocument, Client, Invoice, Project, ProjectCapHandling, TimeEntry } from "@/types";

export interface ProjectBillingContext {
  client?: Client;
  project?: Project;
  hourlyRate?: number;
}

export interface ProjectBudgetSnapshot {
  totalBilled: number;
  remainingBudget: number;
  percentUsed: number;
  maxHours: number;
  remainingHours: number;
  warningLevel: "safe" | "fifty" | "seventy_five" | "ninety" | "limit";
  isOverCap: boolean;
  shouldWarn: boolean;
  isBlocked: boolean;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function clampPercent(value: number) {
  return Math.min(999, Math.max(0, Number(value.toFixed(1))));
}

export function getProjectById(projectId: string | undefined, projects: Project[]) {
  if (!projectId) {
    return undefined;
  }

  return projects.find((project) => project.id === projectId);
}

export function getProjectClient(project: Project | undefined, clients: Client[]) {
  if (!project) {
    return undefined;
  }

  return clients.find((client) => client.id === project.clientId);
}

export function resolveTimeEntryBillingContext(entry: Pick<TimeEntry, "clientId" | "projectId" | "billingRate">, clients: Client[], projects: Project[]): ProjectBillingContext {
  const project = getProjectById(entry.projectId, projects);
  const clientId = project?.clientId ?? entry.clientId;
  const client = clients.find((item) => item.id === clientId);
  const hourlyRate = typeof entry.billingRate === "number" && entry.billingRate > 0
    ? entry.billingRate
    : project?.hourlyRate && project.hourlyRate > 0
      ? project.hourlyRate
      : client?.hourlyRate && client.hourlyRate > 0
        ? client.hourlyRate
        : undefined;

  return {
    client,
    project,
    hourlyRate,
  };
}

export function normalizeTimeEntryRecord(entry: TimeEntry, clients: Client[], projects: Project[]): TimeEntry {
  const project = getProjectById(entry.projectId, projects);
  const clientId = project?.clientId ?? entry.clientId;
  const client = clients.find((item) => item.id === clientId);
  const billingRate = typeof entry.billingRate === "number" && entry.billingRate > 0
    ? entry.billingRate
    : project?.hourlyRate && project.hourlyRate > 0
      ? project.hourlyRate
      : client?.hourlyRate && client.hourlyRate > 0
        ? client.hourlyRate
        : undefined;

  return {
    ...entry,
    billingRate,
    clientId,
    projectId: project?.id,
  };
}

export function getTimeEntryAmount(entry: TimeEntry, clients: Client[], projects: Project[]) {
  const context = resolveTimeEntryBillingContext(entry, clients, projects);

  if (!context.hourlyRate) {
    return 0;
  }

  return roundCurrency(entry.durationHours * context.hourlyRate);
}

export function getProjectBilledAmount(project: Project, entries: TimeEntry[], clients: Client[], projects: Project[]) {
  return roundCurrency(
    entries
      .filter((entry) => entry.status !== "running" && entry.projectId === project.id)
      .reduce((sum, entry) => sum + getTimeEntryAmount(entry, clients, projects), 0),
  );
}

export function getProjectBudgetSnapshot(project: Project, entries: TimeEntry[], clients: Client[], projects: Project[], additionalAmount = 0): ProjectBudgetSnapshot {
  const totalBilled = roundCurrency(getProjectBilledAmount(project, entries, clients, projects) + additionalAmount);
  const cap = Math.max(0, project.maxPayoutCap);
  const remainingBudget = roundCurrency(cap - totalBilled);
  const percentUsed = cap > 0 ? clampPercent((totalBilled / cap) * 100) : 0;
  const maxHours = project.hourlyRate > 0 && cap > 0 ? Number((cap / project.hourlyRate).toFixed(2)) : 0;
  const remainingHours = project.hourlyRate > 0 ? Number((Math.max(0, remainingBudget) / project.hourlyRate).toFixed(2)) : 0;

  let warningLevel: ProjectBudgetSnapshot["warningLevel"] = "safe";
  if (percentUsed >= 100) {
    warningLevel = "limit";
  } else if (percentUsed >= 90) {
    warningLevel = "ninety";
  } else if (percentUsed >= 75) {
    warningLevel = "seventy_five";
  } else if (percentUsed >= 50) {
    warningLevel = "fifty";
  }

  const isOverCap = cap > 0 && totalBilled > cap;
  const shouldWarn = warningLevel !== "safe" && project.capHandling !== "allow_overage";
  const isBlocked = warningLevel === "limit" && project.capHandling === "block_billable";

  return {
    totalBilled,
    remainingBudget,
    percentUsed,
    maxHours,
    remainingHours,
    warningLevel,
    isOverCap,
    shouldWarn,
    isBlocked,
  };
}

export function getProjectWarningMessage(project: Project, snapshot: ProjectBudgetSnapshot) {
  if (snapshot.warningLevel === "safe") {
    return null;
  }

  if (snapshot.warningLevel === "limit") {
    if (project.capHandling === "block_billable") {
      return "This project has reached its payout cap and blocks additional billable entries.";
    }

    if (project.capHandling === "warn_only") {
      return "This project has reached its payout cap. You can continue logging time, but budget warnings stay active.";
    }

    return "This project has reached its payout cap and is allowing overage.";
  }

  const percentLabel = snapshot.warningLevel === "ninety"
    ? "90%"
    : snapshot.warningLevel === "seventy_five"
      ? "75%"
      : "50%";

  return `This project has used ${percentLabel} or more of its payout cap.`;
}

export function getProjectLinkedInvoices(projectId: string, invoices: Invoice[]) {
  return invoices.filter((invoice) => invoice.projectIds.includes(projectId));
}

export function getProjectDerivedMetrics(project: Project, entries: TimeEntry[], invoices: Invoice[], clients: Client[], projects: Project[]) {
  const snapshot = getProjectBudgetSnapshot(project, entries, clients, projects);

  return {
    ...snapshot,
    invoiceCount: getProjectLinkedInvoices(project.id, invoices).length,
    timeEntryCount: entries.filter((entry) => entry.projectId === project.id).length,
    documentCount: project.documents.length,
  };
}

export function getProjectCapHandlingLabel(value: ProjectCapHandling) {
  if (value === "block_billable") {
    return "Block further billable entries";
  }

  if (value === "warn_only") {
    return "Warn only";
  }

  return "Allow overage";
}

export function uniqueProjectIds(entries: TimeEntry[]) {
  return Array.from(new Set(entries.map((entry) => entry.projectId).filter((projectId): projectId is string => Boolean(projectId))));
}
