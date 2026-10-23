import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditInvoiceDialog } from "@/components/invoices/EditInvoiceDialog";
import { getInvoiceEditLockReason, validateInvoiceLineItems } from "@/lib/invoice";
import { useAppStore } from "@/store/appStore";
import type { Invoice, InvoiceLineItem, TimeEntry } from "@/types";

const ORG = "org-premiere";

function line(overrides: Partial<InvoiceLineItem>): InvoiceLineItem {
  return {
    id: "line-1",
    description: "Stage work",
    date: "2026-10-20",
    hours: 2,
    rate: 100,
    amount: 200,
    lineType: "time",
    timeEntryIds: [],
    ...overrides,
  };
}

function entry(id: string): TimeEntry {
  return {
    id,
    clientId: "client-1",
    workspaceId: ORG,
    date: "2026-10-20",
    startTime: "09:00",
    durationHours: 2,
    billable: true,
    invoiced: true,
    invoiceId: "PPM-2026-001",
    notes: "",
    status: "invoiced",
  } as unknown as TimeEntry;
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  const lineItems = overrides.lineItems ?? [
    line({ id: "line-a", timeEntryIds: ["entry-a"] }),
    line({ id: "line-b", description: "Setup", timeEntryIds: ["entry-b"] }),
  ];
  return {
    id: "PPM-2026-001",
    organizationId: ORG,
    workspaceId: ORG,
    clientId: "client-1",
    status: "draft",
    lineItems,
    entryIds: ["entry-a", "entry-b"],
    timeEntryIds: ["entry-a", "entry-b"],
    totalHours: 4,
    hourlyRate: 100,
    hasMixedRates: false,
    subtotal: 400,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 400,
    paidAmount: 0,
    balanceDue: 400,
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    dueDate: "2026-11-30",
    createdAt: "2026-10-23T00:00:00.000Z",
    ...overrides,
  } as Invoice;
}

let requests: Array<{ method: string; url: string; body?: Record<string, unknown> }>;
let failInvoiceSave = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  window.localStorage.clear();
  requests = [];
  failInvoiceSave = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, url, body });
    if (method === "PUT" && url.includes("/invoices/")) {
      return failInvoiceSave ? json({ error: "Server unavailable" }, 503) : json({ ...body, id: "PPM-2026-001" });
    }
    return json({});
  }));
  useAppStore.setState({
    currentUser: {
      id: "user-1",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      hourlyRate: 100,
      invoiceFrequency: "monthly",
      invoiceDueDays: 30,
      currency: "USD",
    },
    activeOrganizationId: ORG,
    invoices: [invoice()],
    timeEntries: [entry("entry-a"), entry("entry-b")],
    expenses: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const invoicePut = () => requests.find((r) => r.method === "PUT" && r.url.includes("/invoices/"));
const bulkRelease = () => requests.find((r) => r.url.includes("/time-entries/bulk"));

describe("saveInvoiceEdits", () => {
  it("saves edited lines with recalculated totals", async () => {
    const result = await useAppStore.getState().saveInvoiceEdits("PPM-2026-001", [
      line({ id: "line-a", hours: 3, amount: 300, timeEntryIds: ["entry-a"] }),
      line({ id: "line-b", description: "Setup", timeEntryIds: ["entry-b"] }),
    ]);

    expect(result.ok).toBe(true);
    expect(invoicePut()?.body).toMatchObject({ subtotal: 500, totalAmount: 500, totalHours: 5 });
    expect(useAppStore.getState().invoices[0].totalAmount).toBe(500);
  });

  it("frees only the time on removed lines, after the save succeeds", async () => {
    await useAppStore.getState().saveInvoiceEdits("PPM-2026-001", [line({ id: "line-a", timeEntryIds: ["entry-a"] })]);

    const putIndex = requests.findIndex((r) => r === invoicePut());
    const releaseIndex = requests.findIndex((r) => r === bulkRelease());
    expect(releaseIndex).toBeGreaterThan(putIndex);
    expect(bulkRelease()?.body).toMatchObject({ ids: ["entry-b"], invoiced: false, invoiceId: null });

    const [a, b] = useAppStore.getState().timeEntries;
    expect(a).toMatchObject({ invoiced: true, invoiceId: "PPM-2026-001" });
    expect(b).toMatchObject({ invoiced: false, invoiceId: null, status: "completed" });
    expect(useAppStore.getState().invoices[0].entryIds).toEqual(["entry-a"]);
  });

  it("adds a manual line", async () => {
    await useAppStore.getState().saveInvoiceEdits("PPM-2026-001", [
      ...invoice().lineItems,
      line({ id: "line-new", description: "Travel fee", hours: 0, rate: 0, amount: 75, lineType: "manual" }),
    ]);

    expect(useAppStore.getState().invoices[0]).toMatchObject({ subtotal: 475, totalAmount: 475 });
    expect(bulkRelease()).toBeUndefined();
  });

  it("reopens a sent invoice as a draft and keeps its time billed", async () => {
    useAppStore.setState({ invoices: [invoice({ status: "sent", issuedAt: "2026-10-22", revisionNumber: 1 })] });

    const result = await useAppStore.getState().saveInvoiceEdits("PPM-2026-001", invoice().lineItems);

    expect(result.ok).toBe(true);
    const saved = useAppStore.getState().invoices[0];
    expect(saved).toMatchObject({ status: "draft", revisionNumber: 2, issuedAt: undefined });
    expect(saved.auditLog?.at(-1)).toMatchObject({ actionType: "moved_back_to_draft", previousStatus: "sent" });
    expect(useAppStore.getState().timeEntries.every((e) => e.invoiced)).toBe(true);
    expect(bulkRelease()).toBeUndefined();
  });

  it("refuses to edit a paid invoice", async () => {
    useAppStore.setState({ invoices: [invoice({ status: "paid", paidAmount: 400 })] });

    const result = await useAppStore.getState().saveInvoiceEdits("PPM-2026-001", [line({ amount: 1 })]);

    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/locked/) });
    expect(invoicePut()).toBeUndefined();
  });

  it("leaves everything unchanged when the save fails", async () => {
    failInvoiceSave = true;
    const before = useAppStore.getState();

    const result = await useAppStore.getState().saveInvoiceEdits("PPM-2026-001", [line({ id: "line-a", timeEntryIds: ["entry-a"] })]);

    expect(result.ok).toBe(false);
    const after = useAppStore.getState();
    expect(after.invoices).toEqual(before.invoices);
    expect(after.timeEntries).toEqual(before.timeEntries);
    expect(bulkRelease()).toBeUndefined();
  });

  it("rejects invalid lines", async () => {
    expect(validateInvoiceLineItems([])).toMatch(/at least one line/);
    expect(validateInvoiceLineItems([line({ description: " " })])).toMatch(/description/);
    expect(validateInvoiceLineItems([line({ amount: -5 })])).toMatch(/amount/);
    expect(getInvoiceEditLockReason({ status: "void" })).toMatch(/Void/);
    expect(getInvoiceEditLockReason({ status: "sent" })).toBeUndefined();
  });
});

describe("updateInvoice", () => {
  it("sends recalculated totals when line items change", async () => {
    useAppStore.getState().updateInvoice("PPM-2026-001", { lineItems: [line({ amount: 250, hours: 2.5 })] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(invoicePut()?.body).toMatchObject({ subtotal: 250, totalAmount: 250 });
  });
});

describe("EditInvoiceDialog", () => {
  it("recalculates the total as lines change and blocks invalid input", () => {
    render(<EditInvoiceDialog invoice={invoice()} />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getAllByText("$400.00").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Line 1 hours"), { target: { value: "4" } });
    expect(screen.getAllByText("$600.00").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Line 2 description"), { target: { value: "" } });
    expect(screen.getByText(/Line 2 needs a description/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("warns that saving reopens a sent invoice as a draft", () => {
    render(<EditInvoiceDialog invoice={invoice({ status: "sent" })} />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByText(/Saving reopens it as a draft/)).toBeTruthy();
  });

  it("is not offered for paid invoices", () => {
    render(<EditInvoiceDialog invoice={invoice({ status: "paid", paidAmount: 400 })} />);

    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });
});
