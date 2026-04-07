import type { AppSettings, Client, EmailDraft, Invoice, Project, TimeEntry, UserProfile, WorkSession } from "@/types";

export function createSeedData() {
  const clients: Client[] = [];

  const projects: Project[] = [];

  const currentUser: UserProfile = {
    id: "user-default",
    name: "",
    email: "",
    role: "contractor",
    hourlyRate: 0,
    invoiceFrequency: "monthly",
    invoiceDueDays: 14,
    currency: "USD",
  };

  const settings: AppSettings = {
    businessName: "",
    defaultClientId: undefined,
    invoiceNotes: "",
    paymentInstructions: "",
    invoiceLogoDataUrl: undefined,
    invoiceBannerDataUrl: undefined,
    companyViewerAccess: false,
    emailTemplate: [
      "Hello {{clientName}},",
      "",
      "Attached is invoice {{invoiceNumber}} from {{businessName}} for work completed during {{invoicePeriod}}.",
      "",
      "Amount due: ${{amount}}",
      "Due date: {{dueDate}}",
      "",
      "Please let me know if you need anything else.",
      "",
      "Best,",
      "{{contractorName}}",
    ].join("\n"),
  };

  const timeEntries: TimeEntry[] = [];

  const activeSession: WorkSession = {
    isActive: false,
  };

  const invoices: Invoice[] = [];

  const emailDrafts: Record<string, EmailDraft> = {};

  return {
    currentUser,
    settings,
    clients,
    projects,
    timeEntries,
    activeSession,
    invoices,
    emailDrafts,
  };
}

export type SeedData = ReturnType<typeof createSeedData>;

    {
      id: "client-northwind",
      name: "Northwind Labs",
      contactName: "Ava Chen",
      contactEmail: "ava@northwindlabs.com",
      contacts: [
        { name: "Ava Chen", email: "ava@northwindlabs.com" },
        { name: "Liam Patel", email: "liam@northwindlabs.com" },
      ],
      hourlyRate: 90,
      companyViewerEnabled: true,
      documents: [
        {
          id: "client-doc-northwind-msa",
          title: "Master services agreement",
          originalFilename: "northwind-msa.txt",
          note: "Signed baseline contract.",
          uploadedBy: "John Doe",
          uploadedAt: "2026-02-09T10:00:00.000Z",
          status: "active",
          mimeType: "text/plain",
          sizeBytes: 50,
          dataUrl: "data:text/plain;base64,Tm9ydGh3aW5kIExhYnMgbWFzdGVyIHNlcnZpY2VzIGFncmVlbWVudC4=",
        },
      ],
    },
    {
      id: "client-atlas",
      name: "Atlas Commerce",
      contactName: "Marcus Reed",
      contactEmail: "marcus@atlascommerce.com",
      contacts: [
        { name: "Marcus Reed", email: "marcus@atlascommerce.com" },
      ],
      hourlyRate: 105,
      companyViewerEnabled: true,
      documents: [],
    },
    {
      id: "client-harbor",
      name: "Harbor Health",
      contactName: "Leah Morgan",
      contactEmail: "leah@harborhealth.com",
      contacts: [
        { name: "Leah Morgan", email: "leah@harborhealth.com" },
      ],
      hourlyRate: 120,
      companyViewerEnabled: false,
      documents: [],
    },
  ];

  const projects: Project[] = [
    {
      id: "project-northwind-redesign",
      name: "Northwind Redesign Sprint",
      clientId: "client-northwind",
      status: "active",
      description: "Homepage redesign, component cleanup, and design system rollout for the March launch.",
      billingType: "hourly_capped",
      hourlyRate: 95,
      maxPayoutCap: 12000,
      capHandling: "warn_only",
      startDate: "2026-02-10",
      endDate: "2026-04-25",
      notes: "Keep stakeholder reviews inside the weekly Wednesday checkpoint.",
      documents: [],
    },
    {
      id: "project-atlas-api",
      name: "Atlas API Integration",
      clientId: "client-atlas",
      status: "active",
      description: "Checkout analytics integration and webhook stabilization for the Atlas storefront.",
      billingType: "hourly_capped",
      hourlyRate: 110,
      maxPayoutCap: 8000,
      capHandling: "block_billable",
      startDate: "2026-03-01",
      endDate: "2026-05-01",
      notes: "Block new billable hours when the cap is fully exhausted.",
      documents: [
        {
          id: "doc-atlas-sow",
          title: "Atlas statement of work",
          originalFilename: "atlas-sow.txt",
          note: "Covers analytics, webhook hardening, and milestones.",
          uploadedBy: "John Doe",
          uploadedAt: "2026-03-01T09:00:00.000Z",
          status: "active",
          mimeType: "text/plain",
          sizeBytes: 68,
          dataUrl: "data:text/plain;base64,QXRsYXMgQ29tbWVyY2UgU09XIC0gY2hlY2tvdXQgYW5hbHl0aWNzLCB3ZWJob29rcywgaW50ZWdyYXRpb24gbWlsZXN0b25lcy4=",
        },
      ],
    },
    {
      id: "project-harbor-launch",
      name: "Harbor Launch Package",
      clientId: "client-harbor",
      status: "on_hold",
      description: "Campaign launch prep and QA pack with a fixed-fee wrapper for the spring launch window.",
      billingType: "fixed_fee",
      hourlyRate: 125,
      maxPayoutCap: 15000,
      capHandling: "allow_overage",
      startDate: "2026-01-15",
      endDate: "2026-05-15",
      notes: "Waiting on final content approvals before the last QA pass.",
      documents: [],
    },
  ];

  const currentUser: UserProfile = {
    id: "user-john-doe",
    name: "John Doe",
    email: "john@contractor.com",
    role: "contractor",
    hourlyRate: 0,
    invoiceFrequency: "monthly",
    invoiceDueDays: 14,
    currency: "USD",
  };

  const settings: AppSettings = {
    businessName: "TimeFlow Studio",
    defaultClientId: "client-northwind",
    invoiceNotes: "Thank you for the partnership. Please reference the invoice number on payment.",
    paymentInstructions: "ACH preferred. Net 14. Email remittance details to billing@timeflow.studio.",
    invoiceLogoDataUrl: undefined,
    invoiceBannerDataUrl: undefined,
    companyViewerAccess: false,
    emailTemplate: [
      "Hello {{clientName}},",
      "",
      "Attached is invoice {{invoiceNumber}} from {{businessName}} for work completed during {{invoicePeriod}}.",
      "",
      "Amount due: ${{amount}}",
      "Due date: {{dueDate}}",
      "",
      "Please let me know if you need anything else.",
      "",
      "Best,",
      "{{contractorName}}",
    ].join("\n"),
  };

  const timeEntries: TimeEntry[] = [
    {
      id: "entry-redesign-wireframes",
      clientId: "client-northwind",
      projectId: "project-northwind-redesign",
      date: "2026-03-24",
      startTime: "09:00",
      endTime: "13:00",
      durationHours: 4,
      billingRate: 95,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Homepage wireframe revisions and review deck prep.",
      status: "completed",
    },
    {
      id: "entry-redesign-components",
      clientId: "client-northwind",
      projectId: "project-northwind-redesign",
      date: "2026-03-25",
      startTime: "10:00",
      endTime: "15:00",
      durationHours: 5,
      billingRate: 95,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Design system component migration and QA fixes.",
      status: "completed",
    },
    {
      id: "entry-atlas-webhooks",
      clientId: "client-atlas",
      projectId: "project-atlas-api",
      date: "2026-03-18",
      startTime: "08:30",
      endTime: "12:30",
      durationHours: 4,
      billingRate: 110,
      billable: true,
      invoiced: true,
      invoiceId: "INV-2026-001",
      notes: "Webhook retry handling and observability pass.",
      status: "invoiced",
    },
    {
      id: "entry-atlas-dashboard",
      clientId: "client-atlas",
      projectId: "project-atlas-api",
      date: "2026-03-19",
      startTime: "13:00",
      endTime: "17:00",
      durationHours: 4,
      billingRate: 110,
      billable: true,
      invoiced: true,
      invoiceId: "INV-2026-001",
      notes: "Checkout analytics event mapping and QA.",
      status: "invoiced",
    },
    {
      id: "entry-harbor-audit",
      clientId: "client-harbor",
      projectId: "project-harbor-launch",
      date: "2026-03-12",
      startTime: "09:00",
      endTime: "12:00",
      durationHours: 3,
      billingRate: 125,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Launch checklist audit and asset review.",
      status: "completed",
    },
    {
      id: "entry-northwind-support",
      clientId: "client-northwind",
      date: "2026-03-26",
      startTime: "14:00",
      endTime: "16:00",
      durationHours: 2,
      billingRate: 90,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Standalone stakeholder support call and planning notes.",
      status: "completed",
    },
  ];

  const activeSession: WorkSession = {
    isActive: false,
  };

  const invoices: Invoice[] = [
    {
      id: "INV-2026-001",
      clientId: "client-atlas",
      periodStart: "2026-03-17",
      periodEnd: "2026-03-23",
      createdAt: "2026-03-24T08:30:00.000Z",
      dueDate: "2026-04-07",
      entryIds: ["entry-atlas-webhooks", "entry-atlas-dashboard"],
      projectIds: ["project-atlas-api"],
      totalHours: 8,
      hourlyRate: 110,
      totalAmount: 880,
      hasMixedRates: false,
      status: "issued",
      issuedAt: "2026-03-24T08:30:00.000Z",
    },
  ];

  const emailDrafts: Record<string, EmailDraft> = {};

  return {
    currentUser,
    settings,
    clients,
    projects,
    timeEntries,
    activeSession,
    invoices,
    emailDrafts,
  };
}

export type SeedData = ReturnType<typeof createSeedData>;
