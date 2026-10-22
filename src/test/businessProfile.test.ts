import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiListOrganizations } from "@/lib/timeflowApi";
import { useAppStore } from "@/store/appStore";
import type { Organization } from "@/types";

const LOGO_A = "data:image/png;base64,QUxQSEE=";
const LOGO_B = "data:image/png;base64,QlJBVk8=";

let requests: Array<{ url: string; method: string; body?: unknown }> = [];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  window.localStorage.clear();
  requests = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });

    if (url.endsWith("/organizations")) {
      return jsonResponse({
        organizations: [
          { id: "org-a", name: "Alpha", status: "active", legalName: "Alpha LLC", branding: { logoDataUrl: LOGO_A } },
          { id: "org-b", name: "Bravo", status: "active", branding: { logoDataUrl: LOGO_B, primaryColor: "#112233" } },
          { id: "org-c", name: "Charlie", status: "active" },
        ],
      });
    }
    if (url.endsWith("/organizations/org-b/profile")) {
      return jsonResponse({ organizationId: "org-b", legalName: "Bravo Inc", branding: { logoDataUrl: LOGO_B } });
    }
    return jsonResponse([]);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("business profile", () => {
  it("keeps each workspace's own branding from the API", async () => {
    const organizations = await apiListOrganizations();

    expect(organizations.map((org) => org.branding?.logoDataUrl)).toEqual([LOGO_A, LOGO_B, undefined]);
    expect(organizations[0].legalName).toBe("Alpha LLC");
    expect(organizations[1].branding?.primaryColor).toBe("#112233");
  });

  it("saves the profile to the given workspace and applies only that workspace's result", async () => {
    const organizations: Organization[] = [
      { id: "org-a", name: "Alpha", ownerUserId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", status: "active", branding: { logoDataUrl: LOGO_A } },
      { id: "org-b", name: "Bravo", ownerUserId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", status: "active" },
    ];
    useAppStore.setState({ organizations, activeOrganizationId: "org-a" });

    await useAppStore.getState().saveBusinessProfile("org-b", { legalName: "Bravo Inc", branding: { logoDataUrl: LOGO_B } });

    const put = requests.find((request) => request.method === "PUT");
    expect(put?.url).toContain("/organizations/org-b/profile");
    expect(put?.body).toEqual({ legalName: "Bravo Inc", branding: { logoDataUrl: LOGO_B } });

    const [alpha, bravo] = useAppStore.getState().organizations;
    expect(alpha.branding?.logoDataUrl).toBe(LOGO_A);
    expect(bravo.legalName).toBe("Bravo Inc");
    expect(bravo.branding?.logoDataUrl).toBe(LOGO_B);
  });
});
