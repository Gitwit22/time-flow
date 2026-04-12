import type { AppSettings, Client, EmailDraft, Invoice, Project, TimeEntry, UserProfile, WorkSession } from "@/types";

export function createSeedData() {
  const clients: Client[] = [
    {
      id: "client-demo-1",
      name: "Riverfront Media",
      contactName: "Alex Rivera",
      contactEmail: "alex@riverfrontmedia.com",
      hourlyRate: 120,
      companyViewerEnabled: false,
      documents: [],
    },
    {
      id: "client-demo-2",
      name: "Beacon Nonprofit Services",
      contactName: "Jordan Kim",
      contactEmail: "jordan@beaconnps.org",
      hourlyRate: 95,
      companyViewerEnabled: false,
      documents: [],
    },
    {
      id: "client-demo-3",
      name: "Summit Tech Solutions",
      contactName: "Morgan Lee",
      contactEmail: "morgan@summittech.io",
      hourlyRate: 150,
      companyViewerEnabled: false,
      documents: [],
    },
  ];

  const projects: Project[] = [
    {
      id: "project-demo-1",
      name: "Brand Refresh",
      clientId: "client-demo-1",
      status: "active",
      description: "Full brand identity overhaul including logo, color palette, and style guide.",
      billingType: "hourly_uncapped",
      hourlyRate: 120,
      maxPayoutCap: 0,
      capHandling: "allow_overage",
      startDate: "2026-01-15",
      notes: "Client prefers weekly check-ins on Thursdays.",
      documents: [],
    },
    {
      id: "project-demo-2",
      name: "Annual Report Design",
      clientId: "client-demo-2",
      status: "active",
      description: "Design and layout for the FY2025 annual impact report.",
      billingType: "fixed_fee",
      hourlyRate: 95,
      maxPayoutCap: 4000,
      capHandling: "warn_only",
      startDate: "2026-02-01",
      endDate: "2026-04-30",
      notes: "Must go to print by end of April.",
      documents: [],
    },
    {
      id: "project-demo-3",
      name: "Developer Portal v2",
      clientId: "client-demo-3",
      status: "active",
      description: "Redesign and rebuild of the public developer documentation portal.",
      billingType: "hourly_capped",
      hourlyRate: 150,
      maxPayoutCap: 18000,
      capHandling: "allow_overage",
      startDate: "2026-03-01",
      notes: "New tech stack — confirm dependencies before sprint 2.",
      documents: [],
    },
  ];

  const today = new Date();
  const d = (daysAgo: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - daysAgo);
    return dt.toISOString().slice(0, 10);
  };

  const timeEntries: TimeEntry[] = [
    {
      id: "entry-demo-1",
      clientId: "client-demo-1",
      projectId: "project-demo-1",
      date: d(1),
      startTime: "09:00",
      endTime: "12:30",
      durationHours: 3.5,
      billingRate: 120,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Initial brand discovery call and moodboard review.",
      status: "completed",
    },
    {
      id: "entry-demo-2",
      clientId: "client-demo-1",
      projectId: "project-demo-1",
      date: d(2),
      startTime: "13:00",
      endTime: "16:00",
      durationHours: 3,
      billingRate: 120,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Logo concept sketches — round 1.",
      status: "completed",
    },
    {
      id: "entry-demo-3",
      clientId: "client-demo-2",
      projectId: "project-demo-2",
      date: d(3),
      startTime: "10:00",
      endTime: "14:00",
      durationHours: 4,
      billingRate: 95,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Annual report content review with stakeholders.",
      status: "completed",
    },
    {
      id: "entry-demo-4",
      clientId: "client-demo-3",
      projectId: "project-demo-3",
      date: d(5),
      startTime: "08:30",
      endTime: "12:00",
      durationHours: 3.5,
      billingRate: 150,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Information architecture and sitemap planning.",
      status: "completed",
    },
    {
      id: "entry-demo-5",
      clientId: "client-demo-3",
      projectId: "project-demo-3",
      date: d(6),
      startTime: "14:00",
      endTime: "17:30",
      durationHours: 3.5,
      billingRate: 150,
      billable: true,
      invoiced: false,
      invoiceId: null,
      notes: "Wireframes for home, docs index, and API reference pages.",
      status: "completed",
    },
  ];

  const currentUser: UserProfile = {
    id: "user-demo",
    name: "Demo User",
    email: "demo@timeflow.app",
    role: "contractor",
    hourlyRate: 120,
    invoiceFrequency: "monthly",
    invoiceDueDays: 14,
    currency: "USD",
  };

  const settings: AppSettings = {
    businessName: "Demo Freelance Studio",
    defaultClientId: "client-demo-1",
    invoiceNotes: "Payment due within {{dueDays}} days. Thank you for your business.",
    paymentInstructions: "ACH transfer or check accepted. Contact billing@demo.com for wire details.",
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
