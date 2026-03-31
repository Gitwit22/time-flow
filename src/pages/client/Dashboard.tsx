import { ArrowRight, Calendar, Clock, DollarSign, Eye } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { UpcomingInvoiceCard } from "@/components/dashboard/UpcomingInvoiceCard";
import { RecentTimeEntriesTable } from "@/components/time-tracker/RecentTimeEntriesTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getBillingSummary } from "@/lib/billing";
import { getBillingPeriod } from "@/lib/date";
import { getPeriodHours, getTodaysHours } from "@/lib/calculations";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/appStore";
import { selectViewerScope } from "@/store/selectors";
import { formatCurrency, formatHours, formatPeriodLabel } from "@/lib/date";

export default function ClientDashboard() {
  const currentUser = useAppStore((state) => state.currentUser);
  const { activeClient, clients, invoices, projects, timeEntries, viewerClientId } = useAppStore(useShallow(selectViewerScope));
  const recentEntries = [...timeEntries]
    .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`))
    .slice(0, 5);
  const recentInvoices = [...invoices].slice(0, 4);
  const billingPeriod = getBillingPeriod(new Date(), currentUser.invoiceFrequency);
  const periodHours = getPeriodHours(timeEntries, billingPeriod.start, billingPeriod.end);
  const periodBilling = getBillingSummary(timeEntries, clients, projects, { start: billingPeriod.start, end: billingPeriod.end });
  const todaysHours = getTodaysHours(timeEntries, new Date());

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Client Dashboard</h1>
        <p className="page-subtitle">{activeClient ? `Viewing ${activeClient.name}'s work logs and invoice progress in real time.` : "Select a company to preview what that client would see."}</p>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>You have read-only access. Contact your contractor for any changes.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Status" value="Read-only" subtitle="Viewer access" icon={Eye} iconClassName="bg-muted text-muted-foreground" />
        <SummaryCard title="Today's Hours" value={formatHours(todaysHours)} subtitle="Logged today" icon={Clock} iconClassName="bg-accent/10 text-accent" />
        <SummaryCard title="Period Hours" value={formatHours(periodHours)} subtitle={formatPeriodLabel(billingPeriod.start, billingPeriod.end)} icon={Calendar} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard title="Period Earnings" value={formatCurrency(periodBilling.totalAmount)} subtitle={periodBilling.missingRateEntries.length ? `${periodBilling.missingRateEntries.length} entries missing rates` : "Based on rated client work"} icon={DollarSign} iconClassName="bg-success/10 text-success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <UpcomingInvoiceCard clientId={viewerClientId} />
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to="/client/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">{formatPeriodLabel(inv.periodStart, inv.periodEnd)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(inv.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{inv.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Recent Time Entries</CardTitle>
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/client/time-logs">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <RecentTimeEntriesTable entries={recentEntries} clients={clients} projects={projects} readOnly />
        </CardContent>
      </Card>
    </div>
  );
}
