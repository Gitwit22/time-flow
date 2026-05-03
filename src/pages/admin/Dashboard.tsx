import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calendar, Clock, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

import { ActiveSessionCard } from "@/components/dashboard/ActiveSessionCard";
import { ActiveClockInsCard } from "@/components/dashboard/ActiveClockInsCard";
import { UpcomingInvoiceCard } from "@/components/dashboard/UpcomingInvoiceCard";
import { SummaryCard } from "@/components/SummaryCard";
import { RecentTimeEntriesTable } from "@/components/time-tracker/RecentTimeEntriesTable";
import { TimeEntryDialog } from "@/components/time-tracker/TimeEntryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatHours, formatPeriodLabel } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import { getActiveTimeEntries, selectDashboardMetrics, selectIsReadonly } from "@/store/selectors";
import type { TimeEntry } from "@/types";

export default function AdminDashboard() {
  const [now, setNow] = useState(() => new Date());
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const invoices = useAppStore((state) => state.invoices);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const expenses = useAppStore((state) => state.expenses);
  const activeSession = useAppStore((state) => state.activeSession);
  const updateTimeEntry = useAppStore((state) => state.updateTimeEntry);
  const deleteTimeEntry = useAppStore((state) => state.deleteTimeEntry);
  const metrics = useMemo(
    () =>
      selectDashboardMetrics({
        clients,
        currentUser: {
          invoiceFrequency: currentUser.invoiceFrequency,
        },
        invoices,
        projects,
        timeEntries,
        expenses,
        activeSession,
        settings: {
          invoiceFrequency: settings.invoiceFrequency,
          payPeriodFrequency: settings.payPeriodFrequency,
          payPeriodStartDate: settings.payPeriodStartDate,
          periodWeekStartsOn: settings.periodWeekStartsOn,
        },
      }),
    [activeSession, clients, currentUser.invoiceFrequency, expenses, invoices, projects, settings.invoiceFrequency, settings.payPeriodFrequency, settings.payPeriodStartDate, settings.periodWeekStartsOn, timeEntries],
  );
  const isReadonly = useAppStore(selectIsReadonly);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const activeClockIns = useMemo(
    () =>
      getActiveTimeEntries(timeEntries, projects, clients, {
        currentUserName: currentUser.name,
        now,
      }),
    [clients, currentUser.name, now, projects, timeEntries],
  );

  const handleEditEntry = (entry: TimeEntry) => {
    if (isReadonly) {
      return;
    }

    setEditingEntry(entry);
    setIsEntryDialogOpen(true);
  };

  const handleSaveEntry = (entry: Omit<TimeEntry, "id">) => {
    if (!editingEntry || isReadonly) {
      return;
    }

    updateTimeEntry(editingEntry.id, entry);
    setEditingEntry(null);
    setIsEntryDialogOpen(false);
    toast({ title: "Entry updated", description: "Time entry details were saved." });
  };

  const handleDeleteEntry = (entry: TimeEntry) => {
    if (isReadonly) {
      return;
    }

    deleteTimeEntry(entry.id);
    toast({ title: "Entry deleted", description: "The selected time entry was removed." });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back, {currentUser.name}. Here's your overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Status"
          value={metrics.status}
          subtitle={metrics.statusSince}
          icon={Clock}
          iconClassName={metrics.status === "Clocked In" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}
        />
        <SummaryCard
          title="Today's Hours"
          value={formatHours(metrics.todayHours)}
          subtitle="Logged today"
          icon={Clock}
          iconClassName="bg-accent/10 text-accent"
        />
        <SummaryCard
          title="Period Hours"
          value={formatHours(metrics.periodHours)}
          subtitle={formatPeriodLabel(metrics.periodStart, metrics.periodEnd)}
          icon={Calendar}
          iconClassName="bg-primary/10 text-primary"
        />
        <SummaryCard
          title="Period Earnings"
          value={formatCurrency(metrics.periodEarnings)}
          subtitle={metrics.unratedEntryCount ? `${metrics.unratedEntryCount} entries missing client rates` : "Based on rated client work"}
          icon={DollarSign}
          iconClassName="bg-success/10 text-success"
        />
      </div>

      {!metrics.payPeriodConfigured ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">Pay period start date not set</p>
              <p className="text-sm text-amber-800">TimeFlow is using a default anchor for now. Set your pay period start date once to keep period summaries and invoice presets consistent.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/platform/settings">Open Settings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Current Pay Period</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Range</p>
            <p className="mt-1 text-sm font-medium">{formatPeriodLabel(metrics.periodStart, metrics.periodEnd)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross Time Earnings</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(metrics.periodEarnings)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(metrics.periodExpenses)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Amount</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(metrics.periodNet)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActiveSessionCard />
        <UpcomingInvoiceCard />
      </div>

      <ActiveClockInsCard
        title="Active Workers"
        rows={activeClockIns}
        emptyMessage="No workers are currently clocked in."
        showClientColumn
      />

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Recent Time Entries</CardTitle>
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/platform/time">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <RecentTimeEntriesTable
            entries={metrics.recentEntries}
            clients={clients}
            projects={projects}
            readOnly={isReadonly}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
          />
        </CardContent>
      </Card>

      <TimeEntryDialog
        clients={clients}
        projects={projects}
        timeEntries={timeEntries}
        entry={editingEntry}
        open={isEntryDialogOpen}
        onOpenChange={(open) => {
          setIsEntryDialogOpen(open);
          if (!open) {
            setEditingEntry(null);
          }
        }}
        onSubmit={handleSaveEntry}
      />
    </div>
  );
}
