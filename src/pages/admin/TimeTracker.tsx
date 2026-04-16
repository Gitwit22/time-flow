import { useMemo, useState } from "react";
import { endOfWeek, isWithinInterval, parseISO, startOfDay, startOfWeek } from "date-fns";
import { Filter, Plus, Search } from "lucide-react";

import { ActiveSessionCard } from "@/components/dashboard/ActiveSessionCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { RecentTimeEntriesTable } from "@/components/time-tracker/RecentTimeEntriesTable";
import { TimeEntryDialog } from "@/components/time-tracker/TimeEntryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getBillingPeriod } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import type { TimeEntry } from "@/types";

export default function TimeTracker() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const addTimeEntry = useAppStore((state) => state.addTimeEntry);
  const updateTimeEntry = useAppStore((state) => state.updateTimeEntry);
  const deleteTimeEntry = useAppStore((state) => state.deleteTimeEntry);
  const unmarkTimeEntryInvoiced = useAppStore((state) => state.unmarkTimeEntryInvoiced);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "invoiced">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "period">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const isReadonly = currentUser.role === "client_viewer";
  const billingFrequency = settings.invoiceFrequency ?? currentUser.invoiceFrequency;

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const period = getBillingPeriod(now, billingFrequency, settings.periodWeekStartsOn);
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: settings.periodWeekStartsOn });
    const weekEnd = endOfWeek(now, { weekStartsOn: settings.periodWeekStartsOn });

    return [...timeEntries]
      .filter((entry) => {
        const matchesSearch = searchQuery.trim()
          ? entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (clients.find((client) => client.id === entry.clientId)?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
            || (projects.find((project) => project.id === entry.projectId)?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
          : true;

        const matchesStatus = statusFilter === "all" ? true : entry.status === statusFilter;
        const matchesClient = clientFilter === "all" ? true : entry.clientId === clientFilter;
        const matchesProject = projectFilter === "all" ? true : (projectFilter === "client-only" ? !entry.projectId : entry.projectId === projectFilter);

        const entryDate = parseISO(entry.date);
        const matchesDate =
          dateFilter === "all"
            ? true
            : dateFilter === "today"
              ? isWithinInterval(entryDate, { start: todayStart, end: now })
              : dateFilter === "week"
                ? isWithinInterval(entryDate, { start: weekStart, end: weekEnd })
                : isWithinInterval(entryDate, { start: period.start, end: period.end });

          return matchesSearch && matchesStatus && matchesClient && matchesProject && matchesDate;
      })
      .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));
        }, [billingFrequency, clientFilter, clients, dateFilter, projectFilter, projects, searchQuery, settings.periodWeekStartsOn, statusFilter, timeEntries]);

  const handleAddManual = () => {
    if (isReadonly) {
      return;
    }

    setEditingEntry(null);
    setIsEntryDialogOpen(true);
  };

  const handleEdit = (entry: TimeEntry) => {
    if (isReadonly) {
      return;
    }

    setEditingEntry(entry);
    setIsEntryDialogOpen(true);
  };

  const handleSaveEntry = (entry: Omit<TimeEntry, "id">) => {
    if (isReadonly) {
      return;
    }

    if (editingEntry) {
      updateTimeEntry(editingEntry.id, entry);
      toast({ title: "Entry updated", description: "Your time entry was updated." });
    } else {
      addTimeEntry(entry);
      toast({ title: "Entry added", description: "Manual time entry saved." });
    }

    setEditingEntry(null);
    setIsEntryDialogOpen(false);
  };

  const handleDelete = (entry: TimeEntry) => {
    if (isReadonly) {
      return;
    }

    deleteTimeEntry(entry.id);
    toast({ title: "Entry deleted", description: "The selected entry was removed." });
  };

  const handleUnmarkInvoiced = (entry: TimeEntry) => {
    if (isReadonly) {
      return;
    }

    unmarkTimeEntryInvoiced(entry.id);
    toast({
      title: "Entry released",
      description: entry.invoiceId
        ? `Entry moved back to billable. Note: invoice ${entry.invoiceId} still exists.`
        : "Entry moved back to billable status.",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Time Tracker"
        subtitle="Clock in, log hours, and manage your time entries."
        actions={
          !isReadonly ? (
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleAddManual}>
              <Plus className="mr-2 h-4 w-4" />
              Add Manual Entry
            </Button>
          ) : undefined
        }
      />

      {isReadonly ? <div className="readonly-banner">Viewer mode: tracking and edits are disabled.</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActiveSessionCard />

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search client or notes..." className="pl-8 h-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              </div>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  <SelectItem value="client-only">Client only</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="h-9">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="period">Current period</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-1 lg:col-start-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setDateFilter("all");
                    setClientFilter("all");
                    setProjectFilter("all");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Time Entries</CardTitle>
          <div className="text-xs text-muted-foreground">{filteredEntries.length} entries</div>
        </CardHeader>
        <CardContent>
          <RecentTimeEntriesTable
            entries={filteredEntries}
            clients={clients}
            projects={projects}
            readOnly={isReadonly}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUnmarkInvoiced={handleUnmarkInvoiced}
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
