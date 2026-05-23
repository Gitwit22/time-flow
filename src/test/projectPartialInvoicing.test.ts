import { describe, expect, it } from "vitest";

import { createProjectPartialInvoicePreview, normalizeInvoiceRecord } from "@/lib/invoice";
import { getProjectBillingSnapshot } from "@/lib/projects";
import type { Client, Invoice, Project } from "@/types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Website Redesign",
    clientId: "client-1",
    status: "active",
    description: "",
    billingType: "hourly_capped",
    hourlyRate: 125,
    maxPayoutCap: 0,
    capHandling: "warn_only",
    projectBillingType: "fixed",
    fixedProjectAmount: 3000,
    billingNotes: "",
    startDate: "2026-05-01",
    notes: "",
    documents: [],
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "INV-2026-001",
    clientId: "client-1",
    projectId: "project-1",
    invoiceSourceType: "partial_project",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-01",
    billingMode: "range",
    grouping: "none",
    createdAt: "2026-05-01",
    dueDate: "2026-05-31",
    entryIds: [],
    timeEntryIds: [],
    lineItems: [],
    projectIds: ["project-1"],
    totalHours: 0,
    hourlyRate: 0,
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 0,
    hasMixedRates: false,
    status: "draft",
    ...overrides,
  };
}

describe("project partial invoicing helpers", () => {
  const client: Client = {
    id: "client-1",
    name: "Acme",
    companyViewerEnabled: false,
    documents: [],
  };

  it("calculates fixed project invoiced and remaining amounts", () => {
    const project = makeProject();
    const invoices: Invoice[] = [
      makeInvoice({ id: "INV-2026-001", totalAmount: 1000, status: "paid", paidAt: "2026-05-10" }),
      makeInvoice({ id: "INV-2026-002", totalAmount: 750, status: "draft" }),
      makeInvoice({ id: "INV-2026-003", totalAmount: 500, invoiceSourceType: "time_entries" }),
    ];

    const snapshot = getProjectBillingSnapshot(project, invoices);

    expect(snapshot.fixedProjectAmount).toBe(3000);
    expect(snapshot.totalProjectInvoiced).toBe(1750);
    expect(snapshot.totalProjectPaid).toBe(1000);
    expect(snapshot.remainingProjectBillableAmount).toBe(1250);
    expect(snapshot.outstandingProjectInvoiceBalance).toBe(750);
  });

  it("creates partial invoice previews without time entries", () => {
    const preview = createProjectPartialInvoicePreview({
      amount: 750,
      client,
      clientId: client.id,
      dueDate: "2026-05-30",
      projectId: "project-1",
      sourceDescription: "Second installment for website design work",
      title: "Milestone 2",
    });

    expect(preview.invoiceSourceType).toBe("partial_project");
    expect(preview.entryIds).toEqual([]);
    expect(preview.timeEntryIds).toEqual([]);
    expect(preview.totalAmount).toBe(750);
    expect(preview.lineItems[0]?.description).toBe("Milestone 2");
  });

  it("keeps backward compatibility by inferring legacy invoice source type", () => {
    const normalized = normalizeInvoiceRecord({
      id: "INV-LEGACY-1",
      clientId: "client-1",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      dueDate: "2026-06-15",
      entryIds: ["entry-1"],
      timeEntryIds: ["entry-1"],
      lineItems: [],
      totalHours: 2,
      hourlyRate: 125,
      totalAmount: 250,
      projectIds: ["project-1"],
    } as any);

    expect(normalized.invoiceSourceType).toBe("time_entries");
  });
});
