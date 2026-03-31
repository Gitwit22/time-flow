import { ArrowLeft, Download, Eye } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import { downloadInvoiceExport } from "@/lib/export";
import { getInvoiceDisplayStatus } from "@/lib/invoice";
import { useAppStore } from "@/store/appStore";
import { Link, useParams } from "react-router-dom";

const statusStyles: Record<string, string> = {
  draft: "status-badge-muted",
  issued: "status-badge-warning",
  paid: "status-badge-success",
  overdue: "status-badge-warning",
};

export default function ClientInvoiceDetail() {
  const { id } = useParams();

  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const invoices = useAppStore((state) => state.invoices);
  const clients = useAppStore((state) => state.clients);
  const timeEntries = useAppStore((state) => state.timeEntries);

  const invoice = invoices.find((item) => item.id === id);

  if (!invoice) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/client/invoices">
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
  const entries = timeEntries
    .filter((entry) => invoice.entryIds.includes(entry.id))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const displayStatus = getInvoiceDisplayStatus(invoice);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/client/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadInvoiceExport({
              invoice,
              entries,
              client,
              currentUser,
              settings,
            })
          }
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Download Invoice
        </Button>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>This invoice is read-only.</span>
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
              <p className="font-medium text-sm mt-1">{formatLongDate(invoice.dueDate)}</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid Date</p>
              <p className="font-medium text-sm mt-1">{invoice.paidAt ? formatLongDate(invoice.paidAt) : "Not paid"}</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-medium">{client?.name ?? "Unknown client"}</p>
            {client?.contactName ? <p className="text-sm text-muted-foreground">{client.contactName}</p> : null}
            {client?.contactEmail ? <p className="text-sm text-muted-foreground">{client.contactEmail}</p> : null}
          </div>

          <table className="w-full text-sm mb-6">
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
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-2.5">{formatLongDate(entry.date)}</td>
                  <td className="py-2.5">{entry.notes || "Tracked work"}</td>
                  <td className="py-2.5 text-right">{formatHours(entry.durationHours)}</td>
                  <td className="py-2.5 text-right">{formatCurrency(invoice.hourlyRate)}</td>
                  <td className="py-2.5 text-right font-medium">{formatCurrency(entry.durationHours * invoice.hourlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
              </div>
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
    </div>
  );
}
