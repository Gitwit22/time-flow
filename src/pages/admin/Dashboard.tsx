import { useMemo, useState } from "react";
import { ArrowRight, Calendar, Clock, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

import { ActiveSessionCard } from "@/components/dashboard/ActiveSessionCard";
import { UpcomingInvoiceCard } from "@/components/dashboard/UpcomingInvoiceCard";
import { SummaryCard } from "@/components/SummaryCard";
import { RecentTimeEntriesTable } from "@/components/time-tracker/RecentTimeEntriesTable";
import { TimeEntryDialog } from "@/components/time-tracker/TimeEntryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatHours, formatPeriodLabel } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import { selectDashboardMetrics, selectIsReadonly } from "@/store/selectors";
import type { TimeEntry } from "@/types";

export default function AdminDashboard() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const invoices = useAppStore((state) => state.invoices);
  const timeEntries = useAppStore((state) => state.timeEntries);
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
        activeSession,
      }),
    [activeSession, clients, currentUser.invoiceFrequency, invoices, projects, timeEntries],
  );
  const isReadonly = useAppStore(selectIsReadonly);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActiveSessionCard />
        <UpcomingInvoiceCard />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Recent Time Entries</CardTitle>
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/admin/time">
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
