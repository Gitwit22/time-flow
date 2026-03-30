import { ArrowLeft, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useParams } from "react-router-dom";

const lineItems = [
  { date: "Mar 3, 2026", description: "API endpoint development", hours: 8.0, rate: 150, amount: 1200 },
  { date: "Mar 4, 2026", description: "Frontend integration", hours: 7.5, rate: 150, amount: 1125 },
  { date: "Mar 5, 2026", description: "Testing & bug fixes", hours: 8.0, rate: 150, amount: 1200 },
  { date: "Mar 6, 2026", description: "Code review & documentation", hours: 6.5, rate: 150, amount: 975 },
  { date: "Mar 7, 2026", description: "Feature development", hours: 8.5, rate: 150, amount: 1275 },
  { date: "Mar 10, 2026", description: "Database optimization", hours: 8.0, rate: 150, amount: 1200 },
  { date: "Mar 11, 2026", description: "UI polish & responsive fixes", hours: 7.0, rate: 150, amount: 1050 },
  { date: "Mar 12, 2026", description: "Deployment & monitoring", hours: 9.0, rate: 150, amount: 1350 },
];

const total = lineItems.reduce((s, l) => s + l.amount, 0);

export default function ClientInvoiceDetail() {
  const { id } = useParams();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/client/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>This invoice is read-only.</span>
      </div>

      <Card className="shadow-md">
        <CardContent className="p-8 sm:p-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold font-heading">INVOICE</h1>
              <p className="text-muted-foreground text-sm mt-1">{id || "INV-2026-003"}</p>
            </div>
            <div className="text-right">
              <h2 className="font-heading font-semibold">John Doe</h2>
              <p className="text-sm text-muted-foreground">Software Development</p>
              <p className="text-sm text-muted-foreground">john@contractor.com</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Date</p>
              <p className="font-medium text-sm mt-1">Mar 31, 2026</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              <p className="font-medium text-sm mt-1">Apr 15, 2026</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing Period</p>
              <p className="font-medium text-sm mt-1">Mar 1 – 31, 2026</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <span className="status-badge-warning mt-1">Sent</span>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-medium">Acme Corp</p>
            <p className="text-sm text-muted-foreground">Sarah Johnson</p>
            <p className="text-sm text-muted-foreground">billing@acme.com</p>
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
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2.5">{item.date}</td>
                  <td className="py-2.5">{item.description}</td>
                  <td className="py-2.5 text-right">{item.hours}</td>
                  <td className="py-2.5 text-right">${item.rate}</td>
                  <td className="py-2.5 text-right font-medium">${item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${total.toLocaleString()}.00</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-heading font-bold">Total Due</span>
                <span className="font-heading font-bold">${total.toLocaleString()}.00</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Payment Instructions</p>
            <p className="text-sm">Bank Transfer: First National Bank, Acct #12345678, Routing #987654321</p>
            <p className="text-sm text-muted-foreground mt-2">Payment due within 15 days of invoice date.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
