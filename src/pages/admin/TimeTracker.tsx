import { useState } from "react";
import { Play, Square, Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const timeEntries = [
  { id: 1, date: "2026-03-28", start: "09:00", end: "17:00", hours: 8.0, notes: "API integration & testing", status: "uninvoiced", client: "Acme Corp" },
  { id: 2, date: "2026-03-27", start: "09:30", end: "17:00", hours: 7.5, notes: "Frontend polish & review", status: "uninvoiced", client: "Acme Corp" },
  { id: 3, date: "2026-03-26", start: "08:00", end: "16:00", hours: 8.0, notes: "Code review & refactor", status: "invoiced", client: "Acme Corp" },
  { id: 4, date: "2026-03-25", start: "10:00", end: "16:30", hours: 6.5, notes: "Database migration", status: "invoiced", client: "Acme Corp" },
  { id: 5, date: "2026-03-24", start: "09:00", end: "17:30", hours: 8.5, notes: "Feature development", status: "invoiced", client: "Acme Corp" },
  { id: 6, date: "2026-03-21", start: "09:00", end: "16:00", hours: 7.0, notes: "Sprint planning & dev", status: "invoiced", client: "Beta Inc" },
];

export default function TimeTracker() {
  const [isClockedIn, setIsClockedIn] = useState(true);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Time Tracker</h1>
        <p className="page-subtitle">Clock in, log hours, and manage your time entries.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clock Section */}
        <Card className={isClockedIn ? "border-accent/30" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Clock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isClockedIn ? (
              <>
                <div className="text-center py-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse-dot" />
                    <span className="text-sm text-success font-medium">Active Session</span>
                  </div>
                  <p className="text-3xl font-bold font-heading">5:32:14</p>
                  <p className="text-sm text-muted-foreground mt-1">Started at 9:00 AM</p>
                </div>
                <Textarea placeholder="Session notes (optional)..." className="resize-none h-20" />
                <Button
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  size="lg"
                  onClick={() => setIsClockedIn(false)}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Clock Out
                </Button>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">Ready to start?</p>
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  size="lg"
                  onClick={() => setIsClockedIn(true)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Clock In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Add Manual Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" defaultValue="2026-03-30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Time</Label>
                <Input type="time" defaultValue="09:00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Time</Label>
                <Input type="time" defaultValue="17:00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Break (min)</Label>
                <Input type="number" defaultValue="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select defaultValue="acme">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acme">Acme Corp</SelectItem>
                    <SelectItem value="beta">Beta Inc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input placeholder="What did you work on?" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" />
                Save Entry
              </Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Time Entries</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8 h-9 w-48" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="h-9 w-40">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entries</SelectItem>
                <SelectItem value="uninvoiced">Uninvoiced</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="period">Current Period</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">Date</th>
                  <th className="text-left py-3 px-2 font-medium">Start</th>
                  <th className="text-left py-3 px-2 font-medium">End</th>
                  <th className="text-left py-3 px-2 font-medium">Hours</th>
                  <th className="text-left py-3 px-2 font-medium">Client</th>
                  <th className="text-left py-3 px-2 font-medium">Notes</th>
                  <th className="text-left py-3 px-2 font-medium">Status</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-2 font-medium">{entry.date}</td>
                    <td className="py-3 px-2">{entry.start}</td>
                    <td className="py-3 px-2">{entry.end}</td>
                    <td className="py-3 px-2 font-medium">{entry.hours}h</td>
                    <td className="py-3 px-2">{entry.client}</td>
                    <td className="py-3 px-2 text-muted-foreground max-w-48 truncate">{entry.notes}</td>
                    <td className="py-3 px-2">
                      <Badge variant={entry.status === "invoiced" ? "secondary" : "outline"} className="text-xs">
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
