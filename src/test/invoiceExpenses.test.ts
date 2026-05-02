import { describe, expect, it } from "vitest";

import {
  buildSingleClientInvoicePreview,
  calculateInvoiceExpenseSubtotal,
  calculateInvoiceGrandTotal,
  calculateInvoiceLaborSubtotal,
  getUninvoicedBillableExpenses,
} from "@/lib/billing";

describe("invoice expense billing helpers", () => {
  const clients = [{ id: "client-1", name: "Acme", companyViewerEnabled: false, documents: [] }];
  const projects = [{
    id: "project-1",
    clientId: "client-1",
    name: "Website",
    status: "active",
    description: "",
    billingType: "hourly_uncapped",
    hourlyRate: 150,
    maxPayoutCap: 0,
    capHandling: "allow_overage",
    startDate: "2026-05-01",
    notes: "",
    documents: [],
  }];

  it("returns only eligible uninvoiced billable expenses", () => {
    const expenses = [
      { id: "exp-eligible", amount: 50, category: "travel", billTo: "client", clientId: "client-1", date: "2026-05-10", description: "Taxi", notes: "", billableToClient: true, status: "billable", invoiceId: null },
      { id: "exp-non-billable", amount: 40, category: "meals", billTo: "client", clientId: "client-1", date: "2026-05-10", description: "Lunch", notes: "", billableToClient: false, status: "non_billable", invoiceId: null },
      { id: "exp-linked", amount: 30, category: "software", billTo: "client", clientId: "client-1", date: "2026-05-10", description: "Plugin", notes: "", billableToClient: true, status: "invoiced", invoiceId: "INV-1" },
      { id: "exp-missing-client", amount: 20, category: "supplies", billTo: "client", date: "2026-05-10", description: "Pens", notes: "", billableToClient: true, status: "billable", invoiceId: null },
    ];

    const eligible = getUninvoicedBillableExpenses(expenses as any, projects as any, [], "client-1", {
      dateRange: { start: "2026-05-01", end: "2026-05-31" },
    });

    expect(eligible.map((expense) => expense.id)).toEqual(["exp-eligible"]);
  });

  it("builds a preview with selected expense IDs only", () => {
    const entries = [
      {
        id: "entry-1",
        clientId: "client-1",
        projectId: "project-1",
        date: "2026-05-12",
        startTime: "09:00",
        endTime: "11:00",
        durationHours: 2,
        billingRate: 150,
        billable: true,
        invoiced: false,
        invoiceId: null,
        notes: "Dev work",
        status: "completed",
      },
    ];
    const expenses = [
      { id: "exp-1", amount: 25, category: "travel", billTo: "client", clientId: "client-1", date: "2026-05-12", description: "Parking", notes: "", billableToClient: true, status: "billable", invoiceId: null },
      { id: "exp-2", amount: 75, category: "software", billTo: "client", clientId: "client-1", date: "2026-05-12", description: "License", notes: "", billableToClient: true, status: "billable", invoiceId: null },
    ];

    const result = buildSingleClientInvoicePreview(
      entries as any,
      expenses as any,
      clients as any,
      projects as any,
      [],
      "client-1",
      "range",
      "2026-05-30",
      {
        rangeStart: "2026-05-01",
        rangeEnd: "2026-05-31",
        selectedExpenseIds: ["exp-2"],
      },
    );

    expect(result.preview?.lineItems.filter((lineItem) => lineItem.lineType === "expense").map((lineItem) => lineItem.expenseId)).toEqual(["exp-2"]);
    expect(result.preview?.subtotal).toBe(375);
  });

  it("calculates labor, expense, and grand totals", () => {
    const invoice = {
      lineItems: [
        { id: "1", lineType: "time", amount: 300, date: "2026-05-12", description: "Work", hours: 2, rate: 150, timeEntryIds: ["entry-1"] },
        { id: "2", lineType: "expense", amount: 45, date: "2026-05-12", description: "Travel", hours: 0, rate: 0, timeEntryIds: [], expenseId: "exp-1" },
      ],
      taxRate: 0.1,
      taxAmount: 34.5,
    };

    expect(calculateInvoiceLaborSubtotal(invoice as any)).toBe(300);
    expect(calculateInvoiceExpenseSubtotal(invoice as any)).toBe(45);
    expect(calculateInvoiceGrandTotal(invoice as any)).toBe(379.5);
  });
});
