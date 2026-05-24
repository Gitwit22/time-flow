import { describe, expect, it } from "vitest";

import { getInvoiceStatusCounts } from "@/lib/calculations";
import { getInvoiceDisplayStatus } from "@/lib/invoice";
import { summarizePayPeriod } from "@/lib/payPeriods";
import { getProjectBillingSnapshot } from "@/lib/projects";
import type { Invoice, Project } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "INV-2026-001",
    clientId: "client-1",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    billingMode: "range",
    grouping: "none",
    createdAt: "2026-05-31",
    dueDate: "2026-06-15",
    entryIds: [],
    timeEntryIds: [],
    lineItems: [],
    projectIds: [],
    totalHours: 0,
    hourlyRate: 0,
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 100,
    hasMixedRates: false,
    status: "draft",
    ...overrides,
  };
}

describe("invoice revision workflow metrics", () => {
  it("marks sent invoices overdue for display", () => {
    const display = getInvoiceDisplayStatus(
      makeInvoice({ status: "sent", dueDate: "2026-04-01" }),
      new Date("2026-05-01"),
    );

    expect(display).toBe("overdue");
  });

  it("tracks partially paid and void invoice counts", () => {
    const counts = getInvoiceStatusCounts([
      makeInvoice({ id: "INV-1", status: "paid" }),
      makeInvoice({ id: "INV-2", status: "partially_paid" }),
      makeInvoice({ id: "INV-3", status: "void" }),
      makeInvoice({ id: "INV-4", status: "sent", dueDate: "2026-04-01" }),
    ], new Date("2026-05-01"));

    expect(counts.paid).toBe(1);
    expect(counts.partiallyPaid).toBe(1);
    expect(counts.void).toBe(1);
    expect(counts.overdue).toBe(1);
  });

  it("excludes void invoices from pay period totals", () => {
    const summary = summarizePayPeriod({
      entries: [],
      expenses: [],
      invoices: [
        makeInvoice({ id: "INV-1", status: "sent", totalAmount: 400 }),
        makeInvoice({ id: "INV-2", status: "void", totalAmount: 250 }),
      ],
      period: {
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      },
    });

    expect(summary.invoiceTotal).toBe(400);
  });

  it("excludes void and revised project invoices from active project billing totals", () => {
    const project: Project = {
      id: "project-1",
      name: "Website",
      clientId: "client-1",
      status: "active",
      description: "",
      billingType: "hourly_uncapped",
      hourlyRate: 150,
      maxPayoutCap: 0,
      capHandling: "allow_overage",
      projectBillingType: "fixed",
      fixedProjectAmount: 3000,
      billingNotes: "",
      startDate: "2026-05-01",
      notes: "",
      documents: [],
    };

    const snapshot = getProjectBillingSnapshot(project, [
      makeInvoice({ id: "INV-1", projectId: "project-1", projectIds: ["project-1"], invoiceSourceType: "partial_project", totalAmount: 900, status: "sent" }),
      makeInvoice({ id: "INV-2", projectId: "project-1", projectIds: ["project-1"], invoiceSourceType: "partial_project", totalAmount: 500, status: "void" }),
      makeInvoice({ id: "INV-3", projectId: "project-1", projectIds: ["project-1"], invoiceSourceType: "partial_project", totalAmount: 300, status: "revised" }),
    ]);

    expect(snapshot.totalProjectInvoiced).toBe(900);
    expect(snapshot.remainingProjectBillableAmount).toBe(2100);
  });
});
