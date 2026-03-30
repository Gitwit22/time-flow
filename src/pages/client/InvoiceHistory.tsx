import { Download, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const invoices = [
  { id: "INV-2026-003", period: "Mar 1–31, 2026", date: "Mar 31, 2026", amount: 9375, status: "draft" },
  { id: "INV-2026-002", period: "Feb 1–28, 2026", date: "Feb 28, 2026", amount: 10800, status: "sent" },
  { id: "INV-2026-001", period: "Jan 1–31, 2026", date: "Jan 31, 2026", amount: 12000, status: "paid" },
  { id: "INV-2025-012", period: "Dec 1–31, 2025", date: "Dec 31, 2025", amount: 5000, status: "paid" },
];

const statusStyles: Record<string, string> = {
  draft: "status-badge-muted",
  sent: "status-badge-warning",
  paid: "status-badge-success",
};

export default function ClientInvoiceHistory() {
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
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-3 px-4 font-medium">{inv.id}</td>
                    <td className="py-3 px-4">{inv.period}</td>
                    <td className="py-3 px-4">{inv.date}</td>
                    <td className="py-3 px-4 font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={statusStyles[inv.status]}>{inv.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild>
                          <Link to={`/client/invoices/${inv.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
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
