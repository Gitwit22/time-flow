import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const timeLogs = [
  { date: "2026-03-28", start: "09:00", end: "17:00", hours: 8.0, notes: "API integration & testing", period: "Mar 2026" },
  { date: "2026-03-27", start: "09:30", end: "17:00", hours: 7.5, notes: "Frontend polish & review", period: "Mar 2026" },
  { date: "2026-03-26", start: "08:00", end: "16:00", hours: 8.0, notes: "Code review & refactor", period: "Mar 2026" },
  { date: "2026-03-25", start: "10:00", end: "16:30", hours: 6.5, notes: "Database migration", period: "Mar 2026" },
  { date: "2026-03-24", start: "09:00", end: "17:30", hours: 8.5, notes: "Feature development", period: "Mar 2026" },
  { date: "2026-03-21", start: "09:00", end: "17:00", hours: 8.0, notes: "Sprint planning & dev", period: "Mar 2026" },
  { date: "2026-03-20", start: "08:30", end: "16:30", hours: 8.0, notes: "CI/CD pipeline setup", period: "Mar 2026" },
  { date: "2026-03-19", start: "09:00", end: "16:00", hours: 7.0, notes: "Testing & QA", period: "Mar 2026" },
];

export default function ClientTimeLogs() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Time Logs</h1>
        <p className="page-subtitle">View your contractor's logged work hours.</p>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>This page is view-only. Contact the contractor for corrections.</span>
      </div>

      <div className="flex gap-3">
        <Select defaultValue="current">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current Period</SelectItem>
            <SelectItem value="feb">Feb 2026</SelectItem>
            <SelectItem value="jan">Jan 2026</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Start</th>
                  <th className="text-left py-3 px-4 font-medium">End</th>
                  <th className="text-left py-3 px-4 font-medium">Hours</th>
                  <th className="text-left py-3 px-4 font-medium">Description</th>
                  <th className="text-left py-3 px-4 font-medium">Period</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 px-4 font-medium">{log.date}</td>
                    <td className="py-3 px-4">{log.start}</td>
                    <td className="py-3 px-4">{log.end}</td>
                    <td className="py-3 px-4 font-medium">{log.hours}h</td>
                    <td className="py-3 px-4 text-muted-foreground">{log.notes}</td>
                    <td className="py-3 px-4">{log.period}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50">
                  <td className="py-3 px-4 font-semibold" colSpan={3}>Total</td>
                  <td className="py-3 px-4 font-semibold">{timeLogs.reduce((s, l) => s + l.hours, 0)}h</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
