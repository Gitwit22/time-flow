import { Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActiveClockInRow } from "@/store/selectors";

interface ActiveClockInsCardProps {
  title: string;
  rows: ActiveClockInRow[];
  emptyMessage: string;
  showClientColumn?: boolean;
}

export function ActiveClockInsCard({ title, rows, emptyMessage, showClientColumn = false }: ActiveClockInsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2.5 pr-3 font-medium">Worker</th>
                  <th className="text-left py-2.5 px-3 font-medium">Project</th>
                  {showClientColumn ? <th className="text-left py-2.5 px-3 font-medium">Client</th> : null}
                  <th className="text-left py-2.5 px-3 font-medium">Clocked In Since</th>
                  <th className="text-left py-2.5 px-3 font-medium">Duration</th>
                  <th className="text-right py-2.5 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.entryId} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{row.workerName}</td>
                    <td className="py-2.5 px-3">{row.projectName}</td>
                    {showClientColumn ? <td className="py-2.5 px-3 text-muted-foreground">{row.clientName}</td> : null}
                    <td className="py-2.5 px-3">{row.clockedInSince}</td>
                    <td className="py-2.5 px-3">{row.durationLabel}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className="status-badge-success">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            <Eye className="h-4 w-4 shrink-0" />
            <span>{emptyMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
