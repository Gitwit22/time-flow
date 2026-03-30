import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { formatLongDate, formatHours } from "@/lib/date";
import { Pencil, ReceiptText, Trash2 } from "lucide-react";
import type { Client, TimeEntry } from "@/types";

interface RecentTimeEntriesTableProps {
  entries: TimeEntry[];
  clients: Client[];
  readOnly?: boolean;
  onEdit?: (entry: TimeEntry) => void;
  onDelete?: (entry: TimeEntry) => void;
  onMarkInvoiced?: (entry: TimeEntry) => void;
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

export function RecentTimeEntriesTable({ entries, clients, readOnly, onEdit, onDelete, onMarkInvoiced }: RecentTimeEntriesTableProps) {
  const getClientName = (clientId: string) => clients.find((client) => client.id === clientId)?.name ?? "Unknown client";

  return (
    <DataTable
      rows={entries}
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
                {entry.status === "completed" ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMarkInvoiced?.(entry)}>
                    <ReceiptText className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit?.(entry)}>
                  <Pencil className="h-4 w-4" />
                </Button>
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
