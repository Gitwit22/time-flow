import { render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { useAppStore } from "@/store/appStore";
import type { Organization, OrganizationMember, UserProfile } from "@/types";

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    name: "Solo Owner",
    email: "owner@example.com",
    role: "owner",
    hourlyRate: 0,
    invoiceFrequency: "monthly",
    invoiceDueDays: 30,
    currency: "USD",
    ...overrides,
  };
}

function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Solo Workspace",
    ownerUserId: "user-1",
    createdAt: "2026-05-16T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function makeMember(overrides: Partial<OrganizationMember> = {}): OrganizationMember {
  return {
    id: "member-1",
    organizationId: "org-1",
    userId: "user-1",
    email: "owner@example.com",
    name: "Solo Owner",
    role: "owner",
    status: "active",
    joinedAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({
    authStatus: "authenticated",
    hydrated: true,
    currentUser: makeUser(),
    organizations: [makeOrganization()],
    activeOrganizationId: "org-1",
    organizationMembers: [makeMember()],
    employeeProfiles: [],
    projectAssignments: [],
    viewerClientId: undefined,
    viewerClientLocked: false,
    settings: {
      businessName: "Solo Workspace",
      invoiceNotes: "",
      paymentInstructions: "",
      invoiceFrequency: "monthly",
      payPeriodFrequency: "monthly",
      payPeriodStartDate: undefined,
      companyViewerAccess: false,
      emailTemplate: "",
      periodWeekStartsOn: 1,
      periodTargetHours: 0,
      periodTargetEarnings: 0,
    },
    clients: [],
    projects: [],
    timeEntries: [],
    expenses: [],
    projectBills: [],
    activeSession: { isActive: false },
    invoices: [],
    emailDrafts: {},
  });
});

describe("WorkspaceSwitcher", () => {
  it("creates a team workspace for a solo account", () => {
    render(<WorkspaceSwitcher />);

    expect(screen.getByRole("button", { name: /solo workspace.*solo workspace/i })).toBeTruthy();

    act(() => {
      useAppStore.getState().createOrganizationWorkspace();
    });

    const state = useAppStore.getState();
    expect(state.organizations).toHaveLength(2);
    expect(state.activeOrganizationId).toBe(state.organizations[1]?.id);
    expect(state.organizations[1]?.name).toContain("Team");
    expect(screen.getByRole("button", { name: /team workspace/i })).toBeTruthy();
  });

  it("switches to an existing workspace", () => {
    useAppStore.setState({
      organizations: [
        makeOrganization(),
        makeOrganization({ id: "org-2", name: "Team Workspace", ownerUserId: "user-1" }),
      ],
      organizationMembers: [
        makeMember(),
        makeMember({ id: "member-2", organizationId: "org-2", name: "Team Owner" }),
      ],
      activeOrganizationId: "org-1",
    });

    render(<WorkspaceSwitcher />);

    act(() => {
      useAppStore.getState().setActiveOrganization("org-2");
    });

    expect(useAppStore.getState().activeOrganizationId).toBe("org-2");
    expect(screen.getByRole("button", { name: /team workspace/i })).toBeTruthy();
  });
});
