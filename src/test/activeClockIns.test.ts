import { describe, expect, it } from "vitest";

import { applyClientClockInVisibility, canClientViewActiveClockIns, getActiveTimeEntriesForClient } from "@/store/selectors";
import type { Client, Project, TimeEntry } from "@/types";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Acme",
    companyViewerEnabled: true,
    canViewActiveClockIns: true,
    documents: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Website Build",
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
    workerName: "John Steele",
    date: "2026-05-02",
    startTime: "09:15",
    durationHours: 0,
    billable: true,
    invoiced: false,
    invoiceId: null,
    notes: "In progress",
    status: "running",
    ...overrides,
  };
}

describe("active clock-ins", () => {
  it("returns active entries for the requested client only", () => {
    const clients: Client[] = [makeClient(), makeClient({ id: "client-2", name: "Beacon" })];
    const projects: Project[] = [makeProject(), makeProject({ id: "proj-2", clientId: "client-2", name: "App Build" })];
    const entries: TimeEntry[] = [
      makeEntry({ id: "a1", clientId: "client-1", projectId: "proj-1" }),
      makeEntry({ id: "a2", clientId: "client-2", projectId: "proj-2" }),
    ];

    const rows = getActiveTimeEntriesForClient("client-1", entries, projects, clients, {
      currentUserName: "Fallback Worker",
      now: new Date("2026-05-02T10:00:00"),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.entryId).toBe("a1");
    expect(rows[0]?.projectName).toBe("Website Build");
  });

  it("excludes completed and clocked-out entries", () => {
    const clients: Client[] = [makeClient()];
    const projects: Project[] = [makeProject()];
    const entries: TimeEntry[] = [
      makeEntry({ id: "active", status: "running" }),
      makeEntry({ id: "completed", status: "completed", endTime: "10:00" }),
      makeEntry({ id: "invoiced", status: "invoiced", endTime: "10:05" }),
      makeEntry({ id: "ended-running", status: "running", endTime: "09:45" }),
    ];

    const rows = getActiveTimeEntriesForClient("client-1", entries, projects, clients, {
      currentUserName: "Fallback Worker",
      now: new Date("2026-05-02T10:00:00"),
    });

    expect(rows.map((row) => row.entryId)).toEqual(["active"]);
  });

  it("recalculates live duration from current time without mutating stored entries", () => {
    const clients: Client[] = [makeClient()];
    const projects: Project[] = [makeProject()];
    const entries: TimeEntry[] = [makeEntry({ id: "active", startTime: "09:15" })];

    const first = getActiveTimeEntriesForClient("client-1", entries, projects, clients, {
      currentUserName: "Fallback Worker",
      now: new Date("2026-05-02T10:00:00"),
    });

    const second = getActiveTimeEntriesForClient("client-1", entries, projects, clients, {
      currentUserName: "Fallback Worker",
      now: new Date("2026-05-02T10:01:00"),
    });

    expect(first[0]?.durationMinutes).toBe(45);
    expect(second[0]?.durationMinutes).toBe(46);
    expect(entries[0]?.durationHours).toBe(0);
  });

  it("honors client visibility setting for active workers", () => {
    const hiddenClient = makeClient({ canViewActiveClockIns: false });
    const visibleClient = makeClient({ canViewActiveClockIns: true });

    expect(canClientViewActiveClockIns(hiddenClient)).toBe(false);
    expect(canClientViewActiveClockIns(visibleClient)).toBe(true);
  });

  it("masks worker/project names when visibility flags are disabled", () => {
    const client = makeClient({
      clientVisibility: {
        canViewActiveClockIns: true,
        canViewWorkerNames: false,
        canViewProjectNames: false,
        canViewLiveDuration: false,
      },
    });

    const masked = applyClientClockInVisibility(
      [
        {
          entryId: "active",
          workerName: "John Steele",
          projectName: "Website Build",
          clientName: "Acme",
          clockedInSince: "9:15 AM",
          durationLabel: "2h 14m",
          durationMinutes: 134,
          status: "Active",
        },
      ],
      client,
    );

    expect(masked[0]?.workerName).toBe("Team Member");
    expect(masked[0]?.projectName).toBe("Client Project");
    expect(masked[0]?.durationLabel).toBe("Active");
  });
});
