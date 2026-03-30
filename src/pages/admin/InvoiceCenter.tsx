import { FileText, Download, Eye, Send, CheckCircle2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";

const invoices = [
  { id: "INV-2026-003", client: "Acme Corp", period: "Mar 1–31, 2026", hours: 62.5, rate: 150, amount: 9375, status: "draft" },
  { id: "INV-2026-002", client: "Acme Corp", period: "Feb 1–28, 2026", hours: 72, rate: 150, amount: 10800, status: "sent" },
  { id: "INV-2026-001", client: "Acme Corp", period: "Jan 1–31, 2026", hours: 80, rate: 150, amount: 12000, status: "paid" },
  { id: "INV-2025-012", client: "Beta Inc", period: "Dec 1–31, 2025", hours: 40, rate: 125, amount: 5000, status: "paid" },
];

const statusStyles: Record<string, string> = {
  draft: "status-badge-muted",
  ready: "status-badge-accent",
  sent: "status-badge-warning",
  paid: "status-badge-success",
};

export default function InvoiceCenter() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Generate, preview, and manage your invoices.</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <FileText className="mr-2 h-4 w-4" />
          Generate Invoice
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select defaultValue="all-clients">
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-clients">All Clients</SelectItem>
            <SelectItem value="acme">Acme Corp</SelectItem>
            <SelectItem value="beta">Beta Inc</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all-status">
          <SelectTrigger className="w-36">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
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
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{inv.id}</td>
                    <td className="py-3 px-4">{inv.client}</td>
                    <td className="py-3 px-4">{inv.period}</td>
                    <td className="py-3 px-4">{inv.hours}h</td>
                    <td className="py-3 px-4">${inv.rate}/hr</td>
                    <td className="py-3 px-4 font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={statusStyles[inv.status]}>{inv.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild>
                          <Link to={`/admin/invoices/${inv.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {inv.status === "draft" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {inv.status === "sent" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
