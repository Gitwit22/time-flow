import { Clock, DollarSign, FileText, Calendar, Eye } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const recentLogs = [
  { date: "Mar 28, 2026", start: "09:00", end: "17:00", hours: 8.0, notes: "API integration" },
  { date: "Mar 27, 2026", start: "09:30", end: "17:00", hours: 7.5, notes: "Frontend polish" },
  { date: "Mar 26, 2026", start: "08:00", end: "16:00", hours: 8.0, notes: "Code review" },
];

const recentInvoices = [
  { id: "INV-2026-002", period: "Feb 1–28, 2026", amount: 10800, status: "sent" },
  { id: "INV-2026-001", period: "Jan 1–31, 2026", amount: 12000, status: "paid" },
];

export default function ClientDashboard() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Client Dashboard</h1>
        <p className="page-subtitle">View your contractor's work logs and invoices.</p>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>You have read-only access. Contact your contractor for any changes.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Period Hours" value="62.5h" subtitle="Mar 1 – 31" icon={Clock} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard title="Est. Amount" value="$9,375" subtitle="@ $150/hr" icon={DollarSign} iconClassName="bg-accent/10 text-accent" />
        <SummaryCard title="Latest Invoice" value="INV-002" subtitle="$10,800 — Sent" icon={FileText} iconClassName="bg-warning/10 text-warning" />
        <SummaryCard title="Next Invoice" value="Apr 5" subtitle="Upcoming" icon={Calendar} iconClassName="bg-muted text-muted-foreground" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Recent Work Logs</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to="/client/time-logs">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{log.date}</p>
                    <p className="text-xs text-muted-foreground">{log.start} – {log.end}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{log.hours}h</p>
                    <p className="text-xs text-muted-foreground">{log.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to="/client/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">{inv.period}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-medium">${inv.amount.toLocaleString()}</span>
                    <Badge variant={inv.status === "paid" ? "secondary" : "outline"} className="text-xs">
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
