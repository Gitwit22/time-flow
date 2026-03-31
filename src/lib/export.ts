import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import type { AppSettings, Client, Invoice, TimeEntry, UserProfile } from "@/types";

interface InvoiceExportInput {
  invoice: Invoice;
  entries: TimeEntry[];
  client?: Client;
  currentUser: UserProfile;
  settings: AppSettings;
}

const PRINT_SCRIPT = `
  window.addEventListener("load", () => {
    window.focus();
    window.setTimeout(() => {
      window.print();
    }, 250);
  });
`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMultilineHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function buildInvoiceExportHtml({ invoice, entries, client, currentUser, settings }: InvoiceExportInput) {
  const businessName = settings.businessName || currentUser.name;
  const issueDate = invoice.issuedAt ?? invoice.createdAt;
  const paidDate = invoice.paidAt ? formatLongDate(invoice.paidAt) : "Not paid";
  const bannerMarkup = settings.invoiceBannerDataUrl
    ? `<div class="banner"><img src="${escapeHtml(settings.invoiceBannerDataUrl)}" alt="Invoice banner" /></div>`
    : "";
  const logoMarkup = settings.invoiceLogoDataUrl
    ? `<img class="logo" src="${escapeHtml(settings.invoiceLogoDataUrl)}" alt="${escapeHtml(businessName)} logo" />`
    : "";
  const lineItems = entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(formatLongDate(entry.date))}</td>
          <td>${escapeHtml(entry.notes || "Tracked work")}</td>
          <td class="numeric">${escapeHtml(formatHours(entry.durationHours))}</td>
          <td class="numeric">${escapeHtml(formatCurrency(invoice.hourlyRate))}</td>
          <td class="numeric">${escapeHtml(formatCurrency(entry.durationHours * invoice.hourlyRate))}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoice.id)}</title>
    <style>
      body { font-family: Georgia, "Times New Roman", serif; color: #111827; margin: 40px; }
      .banner { margin-bottom: 24px; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg, #dbeafe, #f8fafc); }
      .banner img { display: block; width: 100%; max-height: 180px; object-fit: cover; }
      .header, .meta, .totals { display: flex; justify-content: space-between; gap: 24px; }
      .header { margin-bottom: 32px; }
      .brand-lockup { display: flex; align-items: center; gap: 16px; }
      .logo { max-width: 160px; max-height: 72px; object-fit: contain; display: block; }
      .meta { margin-bottom: 24px; }
      .meta-block { flex: 1; }
      h1 { margin: 0; font-size: 28px; letter-spacing: 0.04em; }
      h2 { margin: 0 0 6px 0; font-size: 16px; }
      p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #d1d5db; padding: 10px 8px; text-align: left; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
      .numeric { text-align: right; }
      .totals { margin-top: 24px; justify-content: flex-end; }
      .totals-card { min-width: 280px; }
      .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
      .totals-row.total { font-weight: 700; font-size: 18px; border-top: 1px solid #111827; margin-top: 8px; padding-top: 12px; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #d1d5db; }
      .status { display: inline-block; padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 999px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
      @media (max-width: 720px) {
        body { margin: 20px; }
        .header, .meta { display: block; }
        .brand-lockup { margin-top: 16px; }
      }
      @media print { body { margin: 20px; } }
    </style>
    <script>${PRINT_SCRIPT}</script>
  </head>
  <body>
    ${bannerMarkup}
    <div class="header">
      <div>
        <h1>Invoice</h1>
        <p>${escapeHtml(invoice.id)}</p>
      </div>
      <div class="brand-lockup">
        ${logoMarkup}
        <div>
          <h2>${escapeHtml(businessName)}</h2>
          <p>${escapeHtml(currentUser.email)}</p>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-block">
        <h2>Bill To</h2>
        <p>${escapeHtml(client?.name ?? "Unknown client")}</p>
        <p>${escapeHtml(client?.contactName ?? "")}</p>
        <p>${escapeHtml(client?.contactEmail ?? "")}</p>
      </div>
      <div class="meta-block">
        <h2>Invoice Details</h2>
        <p>Issue Date: ${escapeHtml(formatLongDate(issueDate))}</p>
        <p>Due Date: ${escapeHtml(formatLongDate(invoice.dueDate))}</p>
        <p>Billing Period: ${escapeHtml(formatPeriodLabel(invoice.periodStart, invoice.periodEnd))}</p>
        <p>Status: <span class="status">${escapeHtml(invoice.status)}</span></p>
        <p>Paid Date: ${escapeHtml(paidDate)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th class="numeric">Hours</th>
          <th class="numeric">Hourly Rate</th>
          <th class="numeric">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-card">
        <div class="totals-row"><span>Total Hours</span><span>${escapeHtml(formatHours(invoice.totalHours))}</span></div>
        <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(invoice.totalAmount))}</span></div>
        <div class="totals-row total"><span>Total</span><span>${escapeHtml(formatCurrency(invoice.totalAmount))}</span></div>
      </div>
    </div>

    <div class="footer">
      <h2>Payment Instructions</h2>
      <p>${formatMultilineHtml(settings.paymentInstructions || "No payment instructions set.")}</p>
      <h2>Notes</h2>
      <p>${formatMultilineHtml(settings.invoiceNotes || "No invoice notes set.")}</p>
    </div>
  </body>
</html>`;
}

export function downloadInvoiceExport(input: InvoiceExportInput) {
  try {
    const printWindow = window.open("about:blank", "_blank", "width=960,height=720");

    if (!printWindow) {
      return false;
    }

    printWindow.document.title = input.invoice.id;
    printWindow.document.body.innerHTML = `
      <div style="font-family: Georgia, 'Times New Roman', serif; padding: 32px; color: #111827;">
        <h1 style="margin: 0 0 12px; font-size: 24px;">Preparing invoice...</h1>
        <p style="margin: 0;">${escapeHtml(input.invoice.id)} is loading in a printable view.</p>
      </div>
    `;

    const html = buildInvoiceExportHtml(input);
    const blob = new Blob([html], { type: "text/html" });
    const objectUrl = URL.createObjectURL(blob);
    printWindow.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

    return true;
  } catch {
    return false;
  }
}
