import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppStore } from "@/store/appStore";
import type { Organization } from "@/types";

// Mirrors the API: settings are stored per (organizationId, userId) and the
// organization is chosen by the x-active-workspace-id header.
const serverSettings: Record<string, Record<string, unknown>> = {
  "org-a": {
    businessName: "Alpha Logistics",
    invoiceLogoDataUrl: "data:image/png;base64,ALPHA",
    paymentInstructions: "Pay Alpha",
    invoiceFrequency: "biweekly",
    payPeriodFrequency: "biweekly",
    payPeriodStartDate: "2026-04-26",
    periodWeekStartsOn: 1,
    periodTargetHours: 80,
    periodTargetEarnings: 0,
  },
  "org-b": {
    businessName: "",
    invoiceFrequency: "monthly",
    payPeriodFrequency: "monthly",
    payPeriodStartDate: null,
    periodWeekStartsOn: 1,
    periodTargetHours: 0,
    periodTargetEarnings: 0,
  },
};

const organizations: Organization[] = [
  { id: "org-a", name: "Alpha", ownerUserId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", status: "active" },
  { id: "org-b", name: "Bravo", ownerUserId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", status: "active" },
];

let settingsPuts: Array<{ workspaceId: string; body: unknown }> = [];
let settingsGetDelayMs: Record<string, number> = {};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function installFetchMock() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const workspaceId = headers["x-active-workspace-id"] ?? "org-a";
    const method = init?.method ?? "GET";

    if (url.endsWith("/settings")) {
      if (method === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        settingsPuts.push({ workspaceId, body });
        serverSettings[workspaceId] = { ...serverSettings[workspaceId], ...body };
      }
      const delay = settingsGetDelayMs[workspaceId] ?? 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return jsonResponse(serverSettings[workspaceId]);
    }
    if (url.endsWith("/organizations")) {
      return jsonResponse({ organizations });
    }
    return jsonResponse([]);
  }));
}

async function flush(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.localStorage.clear();
  settingsPuts = [];
  settingsGetDelayMs = {};
  installFetchMock();
  useAppStore.setState({
    authStatus: "authenticated",
    hydrated: true,
    organizations,
    activeOrganizationId: "org-a",
    currentUser: {
      id: "user-1",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      hourlyRate: 0,
      invoiceFrequency: "monthly",
      invoiceDueDays: 30,
      currency: "USD",
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace settings isolation", () => {
  it("loads the new workspace's own settings when switching workspaces", async () => {
    await useAppStore.getState().hydrateFromApi();
    expect(useAppStore.getState().settings.businessName).toBe("Alpha Logistics");

    useAppStore.getState().setActiveOrganization("org-b");
    // Previous workspace branding is cleared immediately, before the reload lands.
    expect(useAppStore.getState().settings.businessName).toBe("");
    expect(useAppStore.getState().settings.invoiceLogoDataUrl).toBeUndefined();

    await flush(10);
    const { settings } = useAppStore.getState();
    expect(settings.businessName).toBe("");
    expect(settings.invoiceLogoDataUrl).toBeUndefined();
    expect(settings.paymentInstructions).toBe("");
    expect(settings.payPeriodStartDate).toBeUndefined();
    expect(settings.periodTargetHours).toBe(0);
  });

  it("does not copy one workspace's cached pay period settings into another", async () => {
    await useAppStore.getState().hydrateFromApi();
    useAppStore.getState().setActiveOrganization("org-b");
    await flush(10);

    expect(useAppStore.getState().settings.payPeriodStartDate).toBeUndefined();
    expect(settingsPuts.filter((put) => put.workspaceId === "org-b")).toEqual([]);
    expect(serverSettings["org-b"].payPeriodStartDate).toBeNull();
  });

  it("ignores a stale hydrate that finishes after a workspace switch", async () => {
    settingsGetDelayMs = { "org-a": 30 };
    const staleHydrate = useAppStore.getState().hydrateFromApi();

    useAppStore.getState().setActiveOrganization("org-b");
    await staleHydrate;
    await flush(40);

    const state = useAppStore.getState();
    expect(state.activeOrganizationId).toBe("org-b");
    expect(state.settings.businessName).toBe("");
    expect(state.settings.invoiceLogoDataUrl).toBeUndefined();
  });

  it("restores each workspace's settings when switching back", async () => {
    await useAppStore.getState().hydrateFromApi();
    useAppStore.getState().setActiveOrganization("org-b");
    await flush(10);
    useAppStore.getState().setActiveOrganization("org-a");
    await flush(10);

    const { settings } = useAppStore.getState();
    expect(settings.businessName).toBe("Alpha Logistics");
    expect(settings.invoiceLogoDataUrl).toBe("data:image/png;base64,ALPHA");
    expect(settings.payPeriodStartDate).toBe("2026-04-26");
  });
});
