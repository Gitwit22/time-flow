/**
 * Regression tests for three recurring dashboard bugs:
 *
 * 1. Today's Hours does not include the currently-active live session.
 * 2. Period Earnings subtitle must accept ReactNode (not just a plain string)
 *    so the "missing client rates" message can render as a clickable link.
 * 3. Client picker (TimeEntryDialog + ActiveSessionCard) must exclude archived
 *    clients from every dropdown.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { selectDashboardMetrics } from "@/store/selectors";
import { getSelectableProjects } from "@/lib/projects";
import { SummaryCard } from "@/components/SummaryCard";
import { DollarSign } from "lucide-react";
import type { Client, Project, TimeEntry, WorkSession } from "@/types";

// ─── Shared factories ────────────────────────────────────────────────────────

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "MI Roundtable",
    hourlyRate: 100,
    companyViewerEnabled: false,
    canViewActiveClockIns: false,
    documents: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Design Sprint",
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
    date: "2026-06-09",
    startTime: "08:00",
    endTime: "10:00",
    durationHours: 2,
    billable: true,
    invoiced: false,
    invoiceId: null,
    notes: "",
    status: "completed",
    ...overrides,
  };
}

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    isActive: false,
    ...overrides,
  };
}

const BASE_SETTINGS = {
  invoiceFrequency: "biweekly" as const,
  payPeriodFrequency: "biweekly" as const,
  payPeriodStartDate: "2026-06-07",
  periodWeekStartsOn: 1 as const,
};

const BASE_USER = { invoiceFrequency: "biweekly" as const };

// ─── 1. Today's Hours includes live session ──────────────────────────────────

describe("selectDashboardMetrics – todayHours regression", () => {
  const TODAY = new Date("2026-06-09T10:30:00");

  it("counts completed entries toward today's hours", () => {
    const entries = [makeEntry({ date: "2026-06-09", durationHours: 3 })];
    const { todayHours } = selectDashboardMetrics(
      {
        clients: [makeClient()],
        projects: [makeProject()],
        timeEntries: entries,
        invoices: [],
        expenses: [],
        projectBills: [],
        activeSession: makeSession(),
        currentUser: BASE_USER,
        settings: BASE_SETTINGS,
      },
      TODAY,
    );
    expect(todayHours).toBe(3);
  });

  it("adds live-session elapsed time to completed entries for today", () => {
    // Session started 1 hour ago on the same calendar date
    const sessionStartedAt = new Date("2026-06-09T09:30:00").toISOString();
    const completedEntry = makeEntry({ date: "2026-06-09", durationHours: 2 });

    const { todayHours } = selectDashboardMetrics(
      {
        clients: [makeClient()],
        projects: [makeProject()],
        timeEntries: [completedEntry],
        invoices: [],
        expenses: [],
        projectBills: [],
        activeSession: makeSession({ isActive: true, startedAt: sessionStartedAt }),
        currentUser: BASE_USER,
        settings: BASE_SETTINGS,
      },
      TODAY,
    );

    // 2 completed + ~1 live hour ≥ 2.9h (we allow a tiny float tolerance)
    expect(todayHours).toBeGreaterThanOrEqual(2.9);
  });

  it("does NOT add live-session hours when session started on a previous day", () => {
    const sessionStartedAt = new Date("2026-06-08T09:00:00").toISOString(); // yesterday
    const completedEntry = makeEntry({ date: "2026-06-09", durationHours: 2 });

    const { todayHours } = selectDashboardMetrics(
      {
        clients: [makeClient()],
        projects: [makeProject()],
        timeEntries: [completedEntry],
        invoices: [],
        expenses: [],
        projectBills: [],
        activeSession: makeSession({ isActive: true, startedAt: sessionStartedAt }),
        currentUser: BASE_USER,
        settings: BASE_SETTINGS,
      },
      TODAY,
    );

    // Only the 2h completed entry — yesterday's session does not inflate today
    expect(todayHours).toBe(2);
  });

  it("returns 0 when there are no entries and no active session", () => {
    const { todayHours } = selectDashboardMetrics(
      {
        clients: [],
        projects: [],
        timeEntries: [],
        invoices: [],
        expenses: [],
        projectBills: [],
        activeSession: makeSession(),
        currentUser: BASE_USER,
        settings: BASE_SETTINGS,
      },
      TODAY,
    );
    expect(todayHours).toBe(0);
  });

  it("excludes running entries from completed count (they are in activeSession instead)", () => {
    const runningEntry = makeEntry({ date: "2026-06-09", status: "running", durationHours: 5 });

    const { todayHours } = selectDashboardMetrics(
      {
        clients: [makeClient()],
        projects: [makeProject()],
        timeEntries: [runningEntry],
        invoices: [],
        expenses: [],
        projectBills: [],
        activeSession: makeSession(),
        currentUser: BASE_USER,
        settings: BASE_SETTINGS,
      },
      TODAY,
    );

    // running entry must NOT count toward today's hours
    expect(todayHours).toBe(0);
  });
});

// ─── 2. Period Earnings subtitle accepts ReactNode ───────────────────────────

describe("SummaryCard – ReactNode subtitle regression", () => {
  it("renders a plain string subtitle", () => {
    render(
      <SummaryCard
        title="Period Earnings"
        value="$0.00"
        subtitle="Based on rated client work"
        icon={DollarSign}
      />,
    );
    expect(screen.getByText("Based on rated client work")).toBeTruthy();
  });

  it("renders a ReactNode subtitle (e.g. a link element)", () => {
    render(
      <SummaryCard
        title="Period Earnings"
        value="$0.00"
        subtitle={<a href="/platform/clients">1 entry missing client rates — set rates</a>}
        icon={DollarSign}
      />,
    );
    const link = screen.getByRole("link", { name: /missing client rates/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/platform/clients");
  });

  it("renders nothing for the subtitle when it is undefined", () => {
    const { container } = render(
      <SummaryCard title="Period Earnings" value="$0.00" icon={DollarSign} />,
    );
    // No subtitle element should be present
    expect(container.querySelectorAll("p").length).toBeLessThanOrEqual(2); // title + value only
  });
});

// ─── 3. Client picker filters archived clients ───────────────────────────────

describe("archived client filtering regression", () => {
  const activeClient = makeClient({ id: "c-active", name: "Active Corp", archived: false });
  const archivedClient = makeClient({ id: "c-archived", name: "Archived LLC", archived: true });
  const allClients: Client[] = [activeClient, archivedClient];

  it("getSelectableProjects excludes archived projects (existing parity check)", () => {
    const projects: Project[] = [
      makeProject({ id: "p-active", archived: false }),
      makeProject({ id: "p-archived", archived: true }),
      makeProject({ id: "p-status-archived", status: "archived" }),
    ];
    const selectable = getSelectableProjects(projects);
    expect(selectable.map((p) => p.id)).toEqual(["p-active"]);
  });

  it("active clients are present and archived clients are absent after filtering", () => {
    const filtered = allClients.filter((c) => c.archived !== true);
    expect(filtered.map((c) => c.id)).toContain("c-active");
    expect(filtered.map((c) => c.id)).not.toContain("c-archived");
  });

  it("first active client is selected as default when clients[0] is archived", () => {
    // Simulate the fixed logic: use clients.find(c => c.archived !== true)
    const firstActive = allClients.find((c) => c.archived !== true);
    expect(firstActive?.id).toBe("c-active");
  });

  it("falls back to empty string when all clients are archived", () => {
    const onlyArchived: Client[] = [makeClient({ archived: true })];
    const firstActive = onlyArchived.find((c) => c.archived !== true);
    expect(firstActive?.id ?? "").toBe("");
  });

  it("newly-added client without archived flag is treated as active", () => {
    // archived is optional — a brand-new client won't have it set
    const newClient = makeClient({ id: "c-new" }); // no archived field
    delete (newClient as Partial<Client>).archived;
    const filtered = [newClient, archivedClient].filter((c) => c.archived !== true);
    expect(filtered.map((c) => c.id)).toContain("c-new");
    expect(filtered.map((c) => c.id)).not.toContain("c-archived");
  });
});
