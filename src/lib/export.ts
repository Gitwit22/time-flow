import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import type { AppSettings, Client, Invoice, TimeEntry, UserProfile } from "@/types";

interface InvoiceExportInput {
  invoice: Invoice;
  entries: TimeEntry[];
  client?: Client;
  currentUser: UserProfile;
  settings: AppSettings;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildInvoiceExportText({ invoice, entries, client, currentUser, settings }: InvoiceExportInput) {
  const lines = [
    `Invoice: ${invoice.id}`,
    `Business: ${settings.businessName || currentUser.name}`,
    `Contractor Email: ${currentUser.email}`,
    `Client: ${client?.name ?? "Unknown client"}`,
    `Billing Period: ${formatPeriodLabel(invoice.periodStart, invoice.periodEnd)}`,
    `Due Date: ${formatLongDate(invoice.dueDate)}`,
    `Status: ${invoice.status}`,
    "",
    "Line Items:",
  ];

  entries.forEach((entry) => {
    lines.push(
      `- ${formatLongDate(entry.date)} | ${entry.notes || "Tracked work"} | ${formatHours(entry.durationHours)} @ ${formatCurrency(invoice.hourlyRate)} = ${formatCurrency(
        entry.durationHours * invoice.hourlyRate,
      )}`,
    );
  });

  lines.push(
    "",
    `Total Hours: ${formatHours(invoice.totalHours)}`,
    `Total Amount: ${formatCurrency(invoice.totalAmount)}`,
    "",
    "Payment Instructions:",
    settings.paymentInstructions || "No payment instructions set.",
    "",
    "Notes:",
    settings.invoiceNotes || "No invoice notes set.",
    "",
    `Generated at: ${new Date().toISOString()}`,
  );

  return lines.join("\n");
}

export function downloadInvoiceExport(input: InvoiceExportInput) {
  const content = buildInvoiceExportText(input);
  downloadTextFile(`${input.invoice.id}.txt`, content);
}
