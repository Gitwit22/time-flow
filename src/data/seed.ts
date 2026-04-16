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
        const clients: Client[] = [];
        const projects: Project[] = [];
        const timeEntries: TimeEntry[] = [];

        const currentUser: UserProfile = {
          id: "",
          name: "",
          email: "",
          role: "contractor",
          hourlyRate: 0,
          invoiceFrequency: "monthly",
          invoiceDueDays: 30,
          currency: "USD",
        };

        const activeSession: WorkSession = { isActive: false };

        const settings: AppSettings = {
          businessName: "",
          invoiceNotes: "",
          paymentInstructions: "",
          companyViewerAccess: false,
          emailTemplate: "",
        };

        const invoices: Invoice[] = [];
        const emailDrafts: Record<string, EmailDraft> = {};
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
    periodWeekStartsOn: 1,
    periodTargetHours: 0,
    periodTargetEarnings: 0,
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
