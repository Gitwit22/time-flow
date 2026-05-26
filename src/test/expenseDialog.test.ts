import { describe, expect, it } from "vitest";

import { canSubmitExpenseForm } from "@/components/expenses/ExpenseDialog";
import type { Expense } from "@/types";

function makeExpenseForm(overrides: Partial<Omit<Expense, "id">> = {}): Omit<Expense, "id"> {
  return {
    amount: 120,
    billableToClient: true,
    billTo: "client",
    category: "other",
    clientId: "client-1",
    date: "2026-05-25",
    description: "Office supplies",
    excludedFromPayPeriod: false,
    includedInPayPeriod: false,
    invoiceId: null,
    notes: "",
    projectId: undefined,
    receiptAttached: false,
    status: "billable",
    vendor: "Staples",
    ...overrides,
  };
}

describe("canSubmitExpenseForm", () => {
  it("allows non-billable expenses without client or project", () => {
    const form = makeExpenseForm({
      billableToClient: false,
      status: "non_billable",
      clientId: undefined,
      projectId: undefined,
    });

    expect(canSubmitExpenseForm(form)).toBe(true);
  });

  it("requires a client when billable and billed to client", () => {
    const form = makeExpenseForm({
      billableToClient: true,
      billTo: "client",
      clientId: undefined,
    });

    expect(canSubmitExpenseForm(form)).toBe(false);
  });

  it("requires a project when billable and billed to project", () => {
    const form = makeExpenseForm({
      billableToClient: true,
      billTo: "project",
      projectId: undefined,
    });

    expect(canSubmitExpenseForm(form)).toBe(false);
  });
});
