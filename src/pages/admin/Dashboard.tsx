import { Clock, DollarSign, FileText, Calendar, Play, Square, ArrowRight } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const recentEntries = [
  { date: "Mar 28, 2026", hours: "8.0h", notes: "API integration", status: "uninvoiced" },
  { date: "Mar 27, 2026", hours: "7.5h", notes: "Frontend polish", status: "uninvoiced" },
  { date: "Mar 26, 2026", hours: "8.0h", notes: "Code review", status: "invoiced" },
  { date: "Mar 25, 2026", hours: "6.5h", notes: "Database migration", status: "invoiced" },
];

export default function AdminDashboard() {
  const isClockedIn = true;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back, John. Here's your overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Status"
          value="Clocked In"
          subtitle="Since 9:00 AM"
          icon={Clock}
          iconClassName="bg-success/10 text-success"
        />
        <SummaryCard
          title="Today's Hours"
          value="5h 32m"
          subtitle="Target: 8h"
          icon={Clock}
          iconClassName="bg-accent/10 text-accent"
        />
        <SummaryCard
          title="Period Hours"
          value="62.5h"
          subtitle="Mar 1 – Mar 31"
          icon={Calendar}
          iconClassName="bg-primary/10 text-primary"
        />
        <SummaryCard
          title="Period Earnings"
          value="$9,375"
          subtitle="@ $150/hr"
          icon={DollarSign}
          iconClassName="bg-success/10 text-success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Timer Card */}
        <Card className="lg:col-span-1 border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Active Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isClockedIn ? (
              <>
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse-dot" />
                    <span className="text-sm text-success font-medium">Tracking</span>
                  </div>
                  <p className="text-4xl font-bold font-heading">5:32:14</p>
                  <p className="text-sm text-muted-foreground mt-1">Started at 9:00 AM</p>
                </div>
                <Button className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" size="lg">
                  <Square className="mr-2 h-4 w-4" />
                  Clock Out
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">You're not clocked in</p>
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
                  <Play className="mr-2 h-4 w-4" />
                  Clock In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Invoice */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Upcoming Invoice</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Period</p>
                <p className="font-medium text-sm">Mar 1 – 31</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours So Far</p>
                <p className="font-medium text-sm">62.5h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Amount</p>
                <p className="font-medium text-sm">$9,375.00</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-medium text-sm">Apr 5, 2026</p>
              </div>
            </div>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <FileText className="mr-2 h-4 w-4" />
              Generate Invoice
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Recent Time Entries</CardTitle>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEntries.map((entry, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium w-28">{entry.date}</span>
                  <span className="text-sm text-muted-foreground">{entry.notes}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{entry.hours}</span>
                  <Badge variant={entry.status === "invoiced" ? "secondary" : "outline"} className="text-xs">
                    {entry.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
