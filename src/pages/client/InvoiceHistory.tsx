import { Download, Eye } from "lucide-react";
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { downloadInvoiceExport } from "@/lib/export";
import { useAppStore } from "@/store/appStore";
import { formatCurrency, formatLongDate, formatPeriodLabel } from "@/lib/date";
import { getInvoiceDisplayStatus } from "@/lib/invoice";

const statusStyles: Record<string, string> = {
  draft: "status-badge-muted",
  issued: "status-badge-warning",
  paid: "status-badge-success",
  overdue: "status-badge-warning",
};

export default function ClientInvoiceHistory() {
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const invoices = useAppStore((state) => state.invoices);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const rows = useMemo(
    () =>
      [...invoices].map((invoice) => ({
        ...invoice,
        displayStatus: getInvoiceDisplayStatus(invoice),
      })),
    [invoices],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Invoice History</h1>
        <p className="page-subtitle">View and download your contractor's invoices.</p>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>Invoices are read-only. Contact your contractor with any questions.</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-4 font-medium">Invoice #</th>
                  <th className="text-left py-3 px-4 font-medium">Billing Period</th>
                  <th className="text-left py-3 px-4 font-medium">Issue Date</th>
                  <th className="text-left py-3 px-4 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-3 px-4 font-medium">{inv.id}</td>
                    <td className="py-3 px-4">{formatPeriodLabel(inv.periodStart, inv.periodEnd)}</td>
                    <td className="py-3 px-4">{formatLongDate(inv.issuedAt ?? inv.createdAt)}</td>
                    <td className="py-3 px-4 font-semibold">{formatCurrency(inv.totalAmount)}</td>
                    <td className="py-3 px-4">
                      <span className={statusStyles[inv.displayStatus]}>{inv.displayStatus}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild>
                          <Link to={`/client/invoices/${inv.id}`}>
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
                            downloadInvoiceExport({
                              invoice: inv,
                              entries,
                              client,
                              currentUser,
                              projects,
                              settings,
                            });
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
