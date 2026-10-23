import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFixedBillInvoicePreview,
  invoicePrefixFromBusinessName,
  materializeInvoiceDrafts,
  nextInvoiceId,
  resolveInvoicePrefix,
} from "@/lib/invoice";
import { useAppStore } from "@/store/appStore";
import type { Client, Invoice, Organization, TimeEntry } from "@/types";

const REF_DATE = new Date("2026-10-23T12:00:00Z");

function invoice(id: string, createdAt = "2026-09-01T00:00:00.000Z"): Invoice {
  return { id, createdAt } as Invoice;
}

describe("invoice numbering per business", () => {
  it("numbers a business with no invoices from its initials, not INV-…-001", () => {
    const prefix = resolveInvoicePrefix({ businessName: "Premiere Project Management", existingInvoices: [] });

    expect(prefix).toBe("PPM");
    expect(nextInvoiceId([], REF_DATE, prefix)).toBe("PPM-2026-001");
  });

  it("keeps an established business on its existing prefix and sequence", () => {
    const nxtLvlInvoices = [invoice("INV-2026-019"), invoice("INV-2026-020", "2026-09-26T00:00:00.000Z")];
    const prefix = resolveInvoicePrefix({ businessName: "Nxt Lvl Technology Solutions", existingInvoices: nxtLvlInvoices });

    expect(prefix).toBe("INV");
    expect(nextInvoiceId(nxtLvlInvoices, REF_DATE, prefix)).toBe("INV-2026-021");
  });

  it("uses a configured prefix over everything else", () => {
    expect(
      resolveInvoicePrefix({ configuredPrefix: "ael", businessName: "All Encompass Logistics", existingInvoices: [invoice("INV-2026-004")] }),
    ).toBe("AEL");
  });

  it("treats the wizard's default INV as unset for a business with no invoices", () => {
    expect(resolveInvoicePrefix({ configuredPrefix: "INV", businessName: "All Encompass Logistics", existingInvoices: [] })).toBe("AEL");
  });

  it("derives a usable prefix from short business names", () => {
    expect(invoicePrefixFromBusinessName("MRJC")).toBe("MRJ");
    expect(invoicePrefixFromBusinessName("")).toBeUndefined();
  });

  it("only counts invoices with the same prefix", () => {
    expect(nextInvoiceId([invoice("INV-2026-020"), invoice("PPM-2026-002")], REF_DATE, "PPM")).toBe("PPM-2026-003");
  });

  it("threads the prefix through every new draft", () => {
    const client = { id: "client-1", name: "MRJC", hourlyRate: 100 } as Client;
    const preview = createFixedBillInvoicePreview("client-1", client, 500, "Stage work", undefined, "2026-11-01");
    const [first, second] = materializeInvoiceDrafts([preview, preview], [], REF_DATE, "PPM");

    expect([first.id, second.id]).toEqual(["PPM-2026-001", "PPM-2026-002"]);
  });
});

// ── Store: an invoice is only kept (and its work marked) once the server has it ──

const PREMIERE: Organization = {
  id: "org-premiere",
  name: "Premiere Project Management",
  ownerUserId: "user-1",
  createdAt: "2026-07-21T00:00:00.000Z",
  status: "active",
};
const CLIENT = { id: "client-1", name: "MRJC", hourlyRate: 100, workspaceId: PREMIERE.id } as Client;
const ENTRY = {
  id: "entry-1",
  clientId: CLIENT.id,
  workspaceId: PREMIERE.id,
  date: "2026-10-20",
  startTime: "09:00",
  durationHours: 2,
  billable: true,
  invoiced: false,
  invoiceId: null,
  notes: "",
  status: "completed",
} as unknown as TimeEntry;

let createInvoiceResponse: (body: Record<string, unknown>) => Response;
let requests: Array<{ method: string; url: string; body?: Record<string, unknown> }>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  window.localStorage.clear();
  requests = [];
  createInvoiceResponse = (body) => json({ ...body }, 201);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, url, body });
    if (method === "POST" && url.endsWith("/invoices")) return createInvoiceResponse(body);
    return json({});
  }));
  useAppStore.setState({
    authStatus: "authenticated",
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
    organizations: [PREMIERE],
    activeOrganizationId: PREMIERE.id,
    clients: [CLIENT],
    projects: [],
    invoices: [],
    expenses: [],
    timeEntries: [ENTRY],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createInvoiceForEntry() {
  const preview = {
    ...createFixedBillInvoicePreview(CLIENT.id, CLIENT, 200, "Stage work", undefined, "2026-11-01"),
    entryIds: [ENTRY.id],
  };
  return useAppStore.getState().commitSingleInvoice(preview);
}

describe("creating an invoice", () => {
  it("numbers it with the business's own prefix and marks work only after the save", async () => {
    const created = createInvoiceForEntry();
    expect(created?.id).toBe("PPM-2026-001");

    await settle();

    const createCall = requests.findIndex((r) => r.method === "POST" && r.url.endsWith("/invoices"));
    const markCall = requests.findIndex((r) => r.url.includes("/time-entries/bulk"));
    expect(requests[createCall].body?.id).toBe("PPM-2026-001");
    expect(markCall).toBeGreaterThan(createCall);
    expect(requests[markCall].body).toMatchObject({ invoiceId: "PPM-2026-001", invoiced: true });
  });

  it("uses the number the server stored when it had to pick another", async () => {
    createInvoiceResponse = (body) => json({ ...body, id: "PPM-2026-002" }, 201);

    createInvoiceForEntry();
    await settle();

    const state = useAppStore.getState();
    expect(state.invoices.map((inv) => inv.id)).toEqual(["PPM-2026-002"]);
    expect(state.timeEntries[0].invoiceId).toBe("PPM-2026-002");
    expect(requests.find((r) => r.url.includes("/time-entries/bulk"))?.body).toMatchObject({ invoiceId: "PPM-2026-002" });
  });

  it("removes the invoice and restores the time entry when the save fails", async () => {
    createInvoiceResponse = () => json({ error: "Unique constraint failed" }, 500);

    createInvoiceForEntry();
    expect(useAppStore.getState().invoices).toHaveLength(1);
    await settle();

    const state = useAppStore.getState();
    expect(state.invoices).toHaveLength(0);
    expect(state.timeEntries[0]).toMatchObject({ invoiced: false, invoiceId: null, status: "completed" });
    // Nothing was marked invoiced on the server for an invoice it doesn't have.
    expect(requests.some((r) => r.url.includes("/time-entries/bulk"))).toBe(false);
  });
});
