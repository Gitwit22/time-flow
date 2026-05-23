import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Eye, FileText, Paperclip, RotateCcw, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateForInput, formatHours, formatLongDate, formatPeriodLabel, parseDateInput, toDateOnlyString } from "@/lib/date";
import { downloadInvoiceExport, type InvoiceReceiptAttachment } from "@/lib/export";
import { getInvoiceDisplayStatus, getInvoiceSourceTypeLabel, groupInvoiceLaborByProject } from "@/lib/invoice";
import { calculateInvoiceExpenseSubtotal, calculateInvoiceLaborSubtotal } from "@/lib/billing";
import { getEntryBillableAmount, getEntryHours, getEntryType } from "@/lib/timeEntries";
import { listTimeflowDocuments, getTimeflowDocumentViewUrl } from "@/lib/timeflowDocumentsApi";
import { useAppStore } from "@/store/appStore";
import type { AttachedDocument } from "@/types";
import { Link, useNavigate, useParams } from "react-router-dom";

const statusStyles: Record<string, string> = {
  draft: "status-badge-muted",
  issued: "status-badge-warning",
  paid: "status-badge-success",
  overdue: "status-badge-warning",
};

export default function InvoiceDetail() {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const invoices = useAppStore((state) => state.invoices);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const expenses = useAppStore((state) => state.expenses);
  const updateInvoice = useAppStore((state) => state.updateInvoice);
  const deleteInvoice = useAppStore((state) => state.deleteInvoice);
  const isReadonly = currentUser.role === "client_viewer";

  // Receipt attachment state
  const [expenseReceiptMap, setExpenseReceiptMap] = useState<Record<string, AttachedDocument[]>>({});
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const invoice = invoices.find((item) => item.id === id);

  if (!invoice) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/platform/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8">
            <EmptyState icon={Eye} title="Invoice not found" description="The requested invoice could not be located in your current data." />
          </CardContent>
        </Card>
      </div>
    );
  }

  const client = clients.find((item) => item.id === invoice.clientId);
  const clientContacts = (client?.contacts?.length
    ? client.contacts
    : client?.contactName || client?.contactEmail
      ? [{ name: client.contactName ?? "", email: client.contactEmail ?? "" }]
      : [])
    .filter((contact) => contact.name || contact.email);
  const entries = timeEntries
    .filter((entry) => invoice.entryIds.includes(entry.id))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const lineItems = invoice.lineItems.length > 0
    ? invoice.lineItems
    : entries.map((entry, index) => ({
      id: `legacy-${entry.id}-${index}`,
      description: entry.notes || (getEntryType(entry) === "fixed" ? "Fixed charge" : "Tracked work"),
      date: entry.date,
      hours: getEntryHours(entry),
      projectId: entry.projectId,
      rate: getEntryType(entry) === "fixed" ? 0 : (entry.billingRate ?? invoice.hourlyRate),
      amount: getEntryType(entry) === "fixed"
        ? getEntryBillableAmount(entry)
        : getEntryBillableAmount(entry, entry.billingRate ?? invoice.hourlyRate),
      timeEntryIds: [entry.id],
      lineType: getEntryType(entry) === "fixed" ? ("fixed" as const) : ("time" as const),
    }));
  const laborLineItems = lineItems.filter((lineItem) => lineItem.lineType !== "expense");
  const laborGroups = groupInvoiceLaborByProject(lineItems, entries, projects);
  const expenseLineItems = lineItems.filter((lineItem) => lineItem.lineType === "expense");
  const laborSubtotal = calculateInvoiceLaborSubtotal({ lineItems });
  const expenseSubtotal = calculateInvoiceExpenseSubtotal({ lineItems });
  const displayStatus = getInvoiceDisplayStatus(invoice);
  const sourceLabel = getInvoiceSourceTypeLabel(invoice);
  const laborSectionTitle = invoice.invoiceSourceType === "partial_project" || invoice.invoiceSourceType === "manual_project"
    ? "Project Billing Line Items"
    : "Labor / Time Entry Line Items";

  // Collect expense IDs from line items for receipt loading
  const invoiceExpenseIds = expenseLineItems.map((li) => li.expenseId).filter(Boolean) as string[];

  useEffect(() => {
    if (invoiceExpenseIds.length === 0) return;
    setReceiptsLoading(true);
    listTimeflowDocuments("expense")
      .then((map) => {
        const relevant: Record<string, AttachedDocument[]> = {};
        for (const expId of invoiceExpenseIds) {
          if (map[expId]?.length) {
            relevant[expId] = map[expId].filter((d) => d.status === "active");
          }
        }
        setExpenseReceiptMap(relevant);
        // Auto-select all receipts by default
        const allIds = Object.values(relevant).flat().map((d) => d.id);
        setSelectedReceiptIds(new Set(allIds));
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setReceiptsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  const allReceipts = Object.entries(expenseReceiptMap).flatMap(([expenseId, docs]) =>
    docs.map((doc) => ({ doc, expenseId }))
  );

  const toggleReceipt = (docId: string) => {
    setSelectedReceiptIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  };

  const handleDownloadInvoice = async () => {
    let receiptAttachments: InvoiceReceiptAttachment[] | undefined;
    if (selectedReceiptIds.size > 0) {
      receiptAttachments = await Promise.all(
        allReceipts
          .filter(({ doc }) => selectedReceiptIds.has(doc.id))
          .map(async ({ doc, expenseId }) => {
            const linkedExpense = expenses.find((e) => e.id === expenseId);
            const expenseDescription = linkedExpense
              ? `${linkedExpense.vendor ? linkedExpense.vendor + " · " : ""}${linkedExpense.description || linkedExpense.category}`
              : "";
            let viewUrl = "";
            try { viewUrl = await getTimeflowDocumentViewUrl(doc.id); } catch { viewUrl = ""; }
            return {
              documentId: doc.id,
              filename: doc.originalFilename || doc.title,
              mimeType: doc.mimeType,
              viewUrl,
              expenseDescription,
            } satisfies InvoiceReceiptAttachment;
          })
      );
    }
    const opened = downloadInvoiceExport({ invoice, entries, expenses, client, currentUser, projects, settings, receiptAttachments });
    toast({
      title: opened ? "Invoice opened for download" : "Popup blocked",
      description: opened
        ? `${invoice.id} opened in a printable invoice view.`
        : "Allow popups for this site, then try download again.",
      variant: opened ? undefined : "destructive",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/platform/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void handleDownloadInvoice(); }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download Invoice
          </Button>
            <Button size="sm" variant="outline" asChild>
            <Link to="/platform/email">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Create Email Draft
            </Link>
          </Button>
            {!isReadonly && invoice.status === "draft" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateInvoice(invoice.id, { issuedAt: toDateOnlyString(new Date()), paidAt: undefined, status: "issued" });
                  toast({ title: "Invoice issued", description: `${invoice.id} is now ready to share.` });
                }}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Mark Issued
              </Button>
            ) : null}
            {!isReadonly && invoice.status === "issued" ? (
            <Button
              size="sm"
              variant="outline"
              className="text-success border-success/30 hover:bg-success/10"
              onClick={() => {
                  updateInvoice(invoice.id, { paidAt: toDateOnlyString(new Date()), status: "paid" });
                toast({ title: "Invoice paid", description: `${invoice.id} marked as paid.` });
              }}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Paid
            </Button>
          ) : null}
            {invoice.status === "paid" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateInvoice(invoice.id, { paidAt: undefined, status: "issued" });
                  toast({ title: "Invoice marked unpaid", description: `${invoice.id} was moved back to issued status.` });
                }}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Mark Unpaid
              </Button>
            ) : null}
            {!isReadonly ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Void Invoice
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void invoice {invoice.id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the invoice and release all {entries.length} linked time{" "}
                      {entries.length === 1 ? "entry" : "entries"} back to billable status so they can be re-invoiced.
                      Linked billable expenses will also be returned to an uninvoiced billable state. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteInvoice(invoice.id);
                        toast({
                          title: "Invoice voided",
                          description: `${invoice.id} was deleted and its linked time entries and expenses were released back to billable status.`,
                        });
                        navigate("/platform/invoices");
                      }}
                    >
                      Void Invoice
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
        </div>
      </div>

      <Card className="shadow-md">
        <CardContent className="p-8 sm:p-10">
          {settings.invoiceBannerDataUrl ? (
            <div className="mb-6 overflow-hidden rounded-2xl border bg-muted/30">
              <img src={settings.invoiceBannerDataUrl} alt="Invoice banner" className="h-32 w-full object-cover" />
            </div>
          ) : null}

          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold font-heading">INVOICE</h1>
              <p className="text-muted-foreground text-sm mt-1">{invoice.id}</p>
            </div>
            <div className="text-right">
              {settings.invoiceLogoDataUrl ? <img src={settings.invoiceLogoDataUrl} alt="Invoice logo" className="ml-auto mb-3 max-h-16 max-w-[180px] object-contain" /> : null}
              <h2 className="font-heading font-semibold">{settings.businessName || currentUser.name}</h2>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Date</p>
              <p className="font-medium text-sm mt-1">{formatLongDate(invoice.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Issue Date</p>
              <p className="font-medium text-sm mt-1">{invoice.issuedAt ? formatLongDate(invoice.issuedAt) : "Not issued"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              {isReadonly ? (
                <p className="font-medium text-sm mt-1">{formatLongDate(invoice.dueDate)}</p>
              ) : (
                <div className="mt-1 max-w-[180px]">
                  <Input type="date" value={formatDateForInput(invoice.dueDate)} onChange={(event) => updateInvoice(invoice.id, { dueDate: parseDateInput(event.target.value) })} />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing Period</p>
              <p className="font-medium text-sm mt-1">{formatPeriodLabel(invoice.periodStart, invoice.periodEnd)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <span className={statusStyles[displayStatus]}>{displayStatus}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Source</p>
              <p className="font-medium text-sm mt-1">{sourceLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid Date</p>
              <p className="font-medium text-sm mt-1">{invoice.paidAt ? formatLongDate(invoice.paidAt) : "Not paid"}</p>
            </div>
          </div>

          {invoice.sourceDescription ? (
            <div className="mb-8 rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Source Description</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{invoice.sourceDescription}</p>
            </div>
          ) : null}

          <div className="mb-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-medium">{client?.name ?? "Unknown client"}</p>
            {clientContacts.map((contact, index) => (
              <p key={`invoice-contact-${index}`} className="text-sm text-muted-foreground">
                {contact.name || "Unnamed"}
                {contact.email ? ` · ${contact.email}` : ""}
              </p>
            ))}
          </div>

          <div className="space-y-6 mb-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{laborSectionTitle}</p>
              {laborLineItems.length ? (
                <div className="space-y-4">
                  {laborGroups.map((group) => (
                    <div key={group.id} className="rounded-lg border">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                        <p className="text-sm font-medium">Project: {group.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatHours(group.totalHours)} · {formatCurrency(group.subtotal)}
                        </p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Hours</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Rate</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.lineItems.map((lineItem) => (
                            <tr key={lineItem.id} className="border-b last:border-0">
                              <td className="py-2.5">{formatLongDate(lineItem.date)}</td>
                              <td className="py-2.5">{lineItem.description || "Tracked work"}</td>
                              <td className="py-2.5 text-right">{formatHours(lineItem.hours)}</td>
                              <td className="py-2.5 text-right">{formatCurrency(lineItem.rate)}</td>
                              <td className="py-2.5 text-right font-medium">{formatCurrency(lineItem.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border px-3 py-3 text-sm text-muted-foreground">No labor items on this invoice.</div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Expense Reimbursement Line Items</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseLineItems.length ? (
                    expenseLineItems.map((lineItem) => {
                      const linkedExpense = lineItem.expenseId ? expenses.find((expense) => expense.id === lineItem.expenseId) : undefined;
                      return (
                        <tr key={lineItem.id} className="border-b last:border-0">
                          <td className="py-2.5">{formatLongDate(lineItem.date)}</td>
                          <td className="py-2.5">{linkedExpense?.vendor ? `${linkedExpense.vendor} — ${lineItem.description}` : lineItem.description}</td>
                          <td className="py-2.5 capitalize text-muted-foreground">{linkedExpense?.category ?? "other"}</td>
                          <td className="py-2.5 text-right font-medium">{formatCurrency(lineItem.amount)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 text-sm text-muted-foreground">No expense reimbursements on this invoice.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal labor</span>
                <span className="font-medium">{formatCurrency(laborSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal expenses</span>
                <span className="font-medium">{formatCurrency(expenseSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal || invoice.totalAmount)}</span>
              </div>
              {invoice.taxAmount > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
                </div>
              ) : null}
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-heading font-bold">Total Due</span>
                <span className="font-heading font-bold">{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Payment Instructions</p>
            <p className="text-sm">{settings.paymentInstructions || "No payment instructions set yet."}</p>
            <p className="text-sm text-muted-foreground mt-2">{settings.invoiceNotes || "No default invoice notes set."}</p>
          </div>
        </CardContent>
      </Card>

      {invoiceExpenseIds.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Expense Receipts
                {receiptsLoading ? <span className="text-xs text-muted-foreground font-normal">Loading...</span> : null}
              </CardTitle>
              {allReceipts.length > 0 ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReceiptIds(new Set(allReceipts.map(({ doc }) => doc.id)))}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReceiptIds(new Set())}>
                    Deselect All
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Select which expense receipts to include when downloading this invoice.
            </p>
          </CardHeader>
          <CardContent>
            {allReceipts.length === 0 && !receiptsLoading ? (
              <p className="text-sm text-muted-foreground">No receipt files found for the expenses on this invoice. Upload receipts from the Expenses page.</p>
            ) : (
              <div className="space-y-2">
                {allReceipts.map(({ doc, expenseId }) => {
                  const linkedExpense = expenses.find((e) => e.id === expenseId);
                  const label = linkedExpense
                    ? `${linkedExpense.vendor ? linkedExpense.vendor + " · " : ""}${linkedExpense.description || linkedExpense.category}`
                    : expenseId;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                      <Checkbox
                        id={`receipt-${doc.id}`}
                        checked={selectedReceiptIds.has(doc.id)}
                        onCheckedChange={() => toggleReceipt(doc.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.originalFilename || doc.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{label}</p>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{doc.mimeType.split("/")[1] ?? doc.mimeType}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
