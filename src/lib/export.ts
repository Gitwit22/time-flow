import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import { groupInvoiceLaborByProject } from "@/lib/invoice";
import { resolveTimeEntryBillingContext } from "@/lib/projects";
import { calculateInvoiceExpenseSubtotal, calculateInvoiceLaborSubtotal } from "@/lib/billing";
import type { AppSettings, Client, Expense, Invoice, TimeEntry, UserProfile } from "@/types";
import type { Project } from "@/types";

interface InvoiceExportInput {
  invoice: Invoice;
  entries: TimeEntry[];
  expenses: Expense[];
  client?: Client;
  currentUser: UserProfile;
  projects: Project[];
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

function buildInvoiceExportHtml({ invoice, entries, expenses, client, currentUser, projects, settings }: InvoiceExportInput) {
  const businessName = settings.businessName || currentUser.name;
  const issueDate = invoice.issuedAt ?? invoice.createdAt;
  const paidDate = invoice.paidAt ? formatLongDate(invoice.paidAt) : "Not paid";
  const contactLines = (client?.contacts?.length
    ? client.contacts
    : client?.contactName || client?.contactEmail
      ? [{ name: client.contactName ?? "", email: client.contactEmail ?? "" }]
      : [])
    .filter((contact) => contact.name || contact.email)
    .map((contact) => `${contact.name || "Unnamed"}${contact.email ? ` - ${contact.email}` : ""}`);
  const contactMarkup = contactLines.length ? contactLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "";
  const bannerMarkup = settings.invoiceBannerDataUrl
    ? `<div class="banner"><img src="${escapeHtml(settings.invoiceBannerDataUrl)}" alt="Invoice banner" /></div>`
    : "";
  const logoMarkup = settings.invoiceLogoDataUrl
    ? `<img class="logo" src="${escapeHtml(settings.invoiceLogoDataUrl)}" alt="${escapeHtml(businessName)} logo" />`
    : "";
  const fallbackLineItems = entries.map((entry, index) => {
    const billingContext = resolveTimeEntryBillingContext(entry, client ? [client] : [], projects);
    const hourlyRate = billingContext.hourlyRate ?? invoice.hourlyRate;

    return {
      id: `legacy-${entry.id}-${index}`,
      description: entry.notes || "Tracked work",
      date: entry.date,
      hours: entry.durationHours,
      lineType: "time" as const,
      projectId: entry.projectId,
      rate: hourlyRate,
      amount: entry.durationHours * hourlyRate,
      timeEntryIds: [entry.id],
    };
  });

  const displayLineItems = invoice.lineItems.length > 0 ? invoice.lineItems : fallbackLineItems;
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));

  const laborLineItems = displayLineItems.filter((lineItem) => lineItem.lineType !== "expense");
  const groupedLaborLineItems = groupInvoiceLaborByProject(displayLineItems, entries, projects);
  const expenseLineItems = displayLineItems.filter((lineItem) => lineItem.lineType === "expense");

  const laborRows = groupedLaborLineItems
    .map((group) => {
      const groupHeader = `
        <tr class="project-group-row">
          <td colspan="5">
            <div class="project-group-header">
              <span class="project-group-title">Project: ${escapeHtml(group.projectName)}</span>
              <span class="project-group-summary">${escapeHtml(formatHours(group.totalHours))} · ${escapeHtml(formatCurrency(group.subtotal))}</span>
            </div>
          </td>
        </tr>`;

      const rows = group.lineItems.map((lineItem) => {
        const hours = formatHours(lineItem.hours);
        const rate = formatCurrency(lineItem.rate);

        return `
          <tr>
            <td>${escapeHtml(formatLongDate(lineItem.date))}</td>
            <td>${escapeHtml(lineItem.description || "Tracked work")}</td>
            <td class="numeric">${escapeHtml(hours)}</td>
            <td class="numeric">${escapeHtml(rate)}</td>
            <td class="numeric">${escapeHtml(formatCurrency(lineItem.amount))}</td>
          </tr>`;
      }).join("");

      return `${groupHeader}${rows}`;
    })
    .join("");

  const expenseRows = expenseLineItems
    .map((lineItem) => {
      const linkedExpense = lineItem.expenseId ? expenseById.get(lineItem.expenseId) : undefined;
      const description = linkedExpense?.vendor ? `${linkedExpense.vendor} - ${lineItem.description}` : lineItem.description;

      return `
        <tr>
          <td>${escapeHtml(formatLongDate(lineItem.date))}</td>
          <td>${escapeHtml(linkedExpense?.category ?? "other")}</td>
          <td>${escapeHtml(description || (linkedExpense ? `Expense (${linkedExpense.category})` : "Expense"))}</td>
          <td class="numeric">${escapeHtml(formatCurrency(lineItem.amount))}</td>
        </tr>`;
    })
    .join("");

  const laborSubtotal = calculateInvoiceLaborSubtotal({ lineItems: displayLineItems });
  const expenseSubtotal = calculateInvoiceExpenseSubtotal({ lineItems: displayLineItems });

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
      .project-group-row td { background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
      .project-group-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
      .project-group-title { font-weight: 600; }
      .project-group-summary { font-size: 12px; color: #6b7280; }
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
        ${contactMarkup}
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

    <h2>Labor / Time Entry Line Items</h2>
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
        ${laborRows || `<tr><td colspan="5">No labor items.</td></tr>`}
      </tbody>
    </table>

    <h2 style="margin-top: 24px;">Expense Reimbursements</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Description</th>
          <th class="numeric">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenseRows || `<tr><td colspan="4">No expense reimbursements.</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-card">
        <div class="totals-row"><span>Total Hours</span><span>${escapeHtml(formatHours(invoice.totalHours))}</span></div>
        <div class="totals-row"><span>Subtotal labor</span><span>${escapeHtml(formatCurrency(laborSubtotal))}</span></div>
        <div class="totals-row"><span>Subtotal expenses</span><span>${escapeHtml(formatCurrency(expenseSubtotal))}</span></div>
        <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(invoice.subtotal || invoice.totalAmount))}</span></div>
        ${invoice.taxAmount > 0 ? `<div class="totals-row"><span>Tax</span><span>${escapeHtml(formatCurrency(invoice.taxAmount))}</span></div>` : ""}
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
