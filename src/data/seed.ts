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
