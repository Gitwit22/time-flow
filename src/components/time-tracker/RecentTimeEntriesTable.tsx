import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency, formatLongDate, formatHours } from "@/lib/date";
import { getTimeEntryAmount } from "@/lib/projects";
import { getEntryHours, getEntryType } from "@/lib/timeEntries";
import { Archive, ArchiveRestore, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { Client, Project, TimeEntry } from "@/types";

export interface TimeEntryPayPeriodGroup {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  entries: TimeEntry[];
}

interface RecentTimeEntriesTableProps {
  entries?: TimeEntry[];
  groups?: TimeEntryPayPeriodGroup[];
  clients: Client[];
  projects: Project[];
  readOnly?: boolean;
  onEdit?: (entry: TimeEntry) => void;
  onDelete?: (entry: TimeEntry) => void;
  onUnmarkInvoiced?: (entry: TimeEntry) => void;
  onArchive?: (entry: TimeEntry) => void;
  onRestore?: (entry: TimeEntry) => void;
}

function getStatusClass(status: TimeEntry["status"]) {
  if (status === "invoiced") {
    return "status-badge-success";
  }

  if (status === "completed") {
    return "status-badge-accent";
  }

  return "status-badge-warning";
}

export function RecentTimeEntriesTable({ entries, groups, clients, projects, readOnly, onEdit, onDelete, onUnmarkInvoiced, onArchive, onRestore }: RecentTimeEntriesTableProps) {
  const getClientName = (clientId: string) => clients.find((client) => client.id === clientId)?.name ?? "Unknown client";
  const getProjectName = (projectId?: string) => (projectId ? projects.find((project) => project.id === projectId)?.name ?? "Unknown project" : "Client-only");

  if (!groups) {
    const rows = entries ?? [];

    return (
      <DataTable
        rows={rows}
        getRowKey={(entry) => entry.id}
        emptyTitle="No time entries yet"
        emptyDescription="Clock in or add a manual entry to start building your billing history."
        columns={[
          {
            id: "date",
            header: "Date",
            render: (entry) => <span className="font-medium">{formatLongDate(entry.date)}</span>,
          },
          {
            id: "client",
            header: "Client",
            render: (entry) => getClientName(entry.clientId),
          },
          {
            id: "project",
            header: "Project",
            render: (entry) => getProjectName(entry.projectId),
          },
          {
            id: "notes",
            header: "Task / Notes",
            render: (entry) => <span className="text-muted-foreground">{entry.notes}</span>,
          },
          {
            id: "hours",
            header: "Hours",
            render: (entry) => <span className="font-medium">{formatHours(entry.durationHours)}</span>,
          },
          {
            id: "rate",
            header: "Rate",
            render: (entry) => <span className="font-medium">{entry.billingRate ? `$${entry.billingRate.toFixed(2)}/hr` : "Unrated"}</span>,
          },
          {
            id: "status",
            header: "Status",
            render: (entry) => <span className={getStatusClass(entry.status)}>{entry.status}</span>,
          },
          {
            id: "actions",
            header: "Actions",
            headClassName: "text-right",
            className: "text-right",
            render: (entry) =>
              readOnly ? (
                <Badge variant="outline">View only</Badge>
              ) : (
                <div className="flex items-center justify-end gap-1">
                  {entry.status === "invoiced" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-warning"
                      title="Release back to billable"
                      onClick={() => onUnmarkInvoiced?.(entry)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit?.(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete?.(entry)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ),
          },
        ]}
      />
    );
  }

  if (!groups.length) {
    return (
      <DataTable
        rows={[]}
        getRowKey={(entry) => entry.id}
        emptyTitle="No time entries yet"
        emptyDescription="Clock in or add a manual entry to start building your billing history."
        columns={[]}
      />
    );
  }

  return (
    <Accordion type="multiple" defaultValue={groups.length ? [groups[0].key] : []} className="w-full">
      {groups.map((group) => {
        const groupHours = group.entries.reduce((sum, entry) => sum + getEntryHours(entry), 0);
        const groupAmount = group.entries.reduce((sum, entry) => sum + getTimeEntryAmount(entry, clients, projects), 0);

        return (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between pr-2 text-left">
                <div>
                  <div className="font-medium">{group.label}</div>
                  <div className="text-xs text-muted-foreground">{formatLongDate(group.startDate)} to {formatLongDate(group.endDate)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {group.entries.length} entries | {formatHours(groupHours)} | {formatCurrency(groupAmount)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <DataTable
                rows={group.entries}
                getRowKey={(entry) => entry.id}
                columns={[
                  {
                    id: "date",
                    header: "Date",
                    render: (entry) => <span className="font-medium">{formatLongDate(entry.date)}</span>,
                  },
                  {
                    id: "client",
                    header: "Client",
                    render: (entry) => getClientName(entry.clientId),
                  },
                  {
                    id: "project",
                    header: "Project",
                    render: (entry) => getProjectName(entry.projectId),
                  },
                  {
                    id: "entry-type",
                    header: "Type",
                    render: (entry) =>
                      getEntryType(entry) === "fixed"
                        ? <Badge variant="secondary">Fixed</Badge>
                        : <Badge variant="outline">Time</Badge>,
                  },
                  {
                    id: "notes",
                    header: "Description",
                    render: (entry) => <span className="text-muted-foreground">{entry.notes}</span>,
                  },
                  {
                    id: "hours",
                    header: "Hours",
                    render: (entry) =>
                      getEntryType(entry) === "fixed"
                        ? <span className="font-medium text-muted-foreground">-</span>
                        : <span className="font-medium">{formatHours(getEntryHours(entry))}</span>,
                  },
                  {
                    id: "rate",
                    header: "Rate",
                    render: (entry) =>
                      getEntryType(entry) === "fixed"
                        ? <span className="font-medium text-muted-foreground">Fixed</span>
                        : <span className="font-medium">{entry.billingRate ? `$${entry.billingRate.toFixed(2)}/hr` : "Unrated"}</span>,
                  },
                  {
                    id: "amount",
                    header: "Total",
                    render: (entry) => <span className="font-medium">{formatCurrency(getTimeEntryAmount(entry, clients, projects))}</span>,
                  },
                  {
                    id: "status",
                    header: "Status",
                    render: (entry) => <span className={getStatusClass(entry.status)}>{entry.status}</span>,
                  },
                  {
                    id: "actions",
                    header: "Actions",
                    headClassName: "text-right",
                    className: "text-right",
                    render: (entry) =>
                      readOnly ? (
                        <Badge variant="outline">View only</Badge>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {entry.status === "invoiced" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-warning"
                              title="Release back to billable"
                              onClick={() => onUnmarkInvoiced?.(entry)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit?.(entry)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {entry.archived === true ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Restore to active list"
                              onClick={() => onRestore?.(entry)}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Archive from active list"
                              onClick={() => onArchive?.(entry)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete?.(entry)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ),
                  },
                ]}
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
