import { Eye } from "lucide-react";
import { useMemo } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHours, formatLongDate } from "@/lib/date";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/appStore";
import { selectViewerScope } from "@/store/selectors";

export default function ClientTimeLogs() {
  const { activeClient, clients, projects, timeEntries } = useAppStore(useShallow(selectViewerScope));
  const rows = useMemo(
    () => [...timeEntries].sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [timeEntries],
  );

  const totalHours = rows.reduce((sum, entry) => sum + entry.durationHours, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Time Logs</h1>
        <p className="page-subtitle">{activeClient ? `View ${activeClient.name}'s logged work hours.` : "Select a company to preview its time log history."}</p>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>This page is view-only. Contact the contractor for corrections.</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">All Time Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            rows={rows}
            getRowKey={(entry) => entry.id}
            emptyTitle="No time logs yet"
            emptyDescription="Your contractor has not logged any entries yet."
            columns={[
              {
                id: "date",
                header: "Date",
                render: (entry) => <span className="font-medium">{formatLongDate(entry.date)}</span>,
              },
              {
                id: "start",
                header: "Start",
                render: (entry) => entry.startTime,
              },
              {
                id: "end",
                header: "End",
                render: (entry) => entry.endTime ?? "-",
              },
              {
                id: "hours",
                header: "Hours",
                render: (entry) => <span className="font-medium">{formatHours(entry.durationHours)}</span>,
              },
              {
                id: "client",
                header: "Client",
                render: (entry) => clients.find((client) => client.id === entry.clientId)?.name ?? "Unknown client",
              },
              {
                id: "project",
                header: "Project",
                render: (entry) => entry.projectId ? projects.find((project) => project.id === entry.projectId)?.name ?? "Unknown project" : "Client-only",
              },
              {
                id: "notes",
                header: "Description",
                render: (entry) => <span className="text-muted-foreground">{entry.notes}</span>,
              },
              {
                id: "status",
                header: "Status",
                render: (entry) => <span className="status-badge-muted">{entry.status}</span>,
              },
            ]}
          />
          <div className="border-t bg-muted/30 px-4 py-3 text-sm font-medium">Total tracked: {formatHours(totalHours)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
