import { FileText, Download, Eye, CheckCircle2, Filter } from "lucide-react";
import { useMemo, useState } from "react";

import { GenerateInvoiceDialog } from "@/components/invoices/GenerateInvoiceDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatHours, formatPeriodLabel } from "@/lib/date";
import { downloadInvoiceExport } from "@/lib/export";
import { getInvoiceDisplayStatus } from "@/lib/invoice";

const statusStyles: Record<string, string> = {
  draft: "status-badge-muted",
  issued: "status-badge-warning",
  paid: "status-badge-success",
  overdue: "status-badge-warning",
};

export default function InvoiceCenter() {
  const { toast } = useToast();
  const isReadonly = useAppStore((state) => state.currentUser.role === "client_viewer");
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const invoices = useAppStore((state) => state.invoices);
  const clients = useAppStore((state) => state.clients);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const updateInvoice = useAppStore((state) => state.updateInvoice);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = useMemo(
    () =>
      [...invoices]
        .map((invoice) => ({
          ...invoice,
          displayStatus: getInvoiceDisplayStatus(invoice),
          clientName: clients.find((client) => client.id === invoice.clientId)?.name ?? "Unknown client",
        }))
        .filter((invoice) => (clientFilter === "all" ? true : invoice.clientId === clientFilter))
        .filter((invoice) => (statusFilter === "all" ? true : invoice.displayStatus === statusFilter)),
    [clientFilter, clients, invoices, statusFilter],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Generate, preview, and manage your invoices.</p>
        </div>
        {!isReadonly ? (
          <GenerateInvoiceDialog
            trigger={
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <FileText className="mr-2 h-4 w-4" />
                Generate Invoice
              </Button>
            }
          />
        ) : null}
      </div>

      {isReadonly ? <div className="readonly-banner">Viewer mode: invoice generation and status updates are disabled.</div> : null}

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-4 font-medium">Invoice #</th>
                  <th className="text-left py-3 px-4 font-medium">Client</th>
                  <th className="text-left py-3 px-4 font-medium">Period</th>
                  <th className="text-left py-3 px-4 font-medium">Hours</th>
                  <th className="text-left py-3 px-4 font-medium">Rate</th>
                  <th className="text-left py-3 px-4 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{inv.id}</td>
                    <td className="py-3 px-4">{inv.clientName}</td>
                    <td className="py-3 px-4">{formatPeriodLabel(inv.periodStart, inv.periodEnd)}</td>
                    <td className="py-3 px-4">{formatHours(inv.totalHours)}</td>
                    <td className="py-3 px-4">{formatCurrency(inv.hourlyRate)}/hr</td>
                    <td className="py-3 px-4 font-semibold">{formatCurrency(inv.totalAmount)}</td>
                    <td className="py-3 px-4">
                      <span className={statusStyles[inv.displayStatus]}>{inv.displayStatus}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild>
                          <Link to={`/admin/invoices/${inv.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => {
                            const client = clients.find((item) => item.id === inv.clientId);
                            const entries = timeEntries.filter((entry) => inv.entryIds.includes(entry.id));
                            const opened = downloadInvoiceExport({
                              invoice: inv,
                              entries,
                              client,
                              currentUser,
                              settings,
                            });

                            toast({
                              title: opened ? "Invoice opened for download" : "Popup blocked",
                              description: opened ? `${inv.id} opened in a printable invoice view.` : "Allow popups for this site, then try download again.",
                              variant: opened ? undefined : "destructive",
                            });
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {!isReadonly && inv.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => {
                              updateInvoice(inv.id, { paidAt: undefined, issuedAt: new Date().toISOString(), status: "issued" });
                              toast({ title: "Invoice issued", description: `${inv.id} is now ready to share with the client.` });
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {!isReadonly && inv.status === "issued" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success"
                            onClick={() => {
                              updateInvoice(inv.id, { paidAt: new Date().toISOString(), status: "paid" });
                              toast({ title: "Invoice paid", description: `${inv.id} marked as paid.` });
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {inv.status === "paid" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!rows.length ? <EmptyState icon={FileText} title="No invoices yet" description="Generate invoices from completed time entries to see them here." className="m-4" /> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
