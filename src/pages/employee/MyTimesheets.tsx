import { useMemo } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { RecentTimeEntriesTable } from "@/components/time-tracker/RecentTimeEntriesTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock } from "lucide-react";
import { useAppStore } from "@/store/appStore";

export default function MyTimesheetsPage() {
  const currentUser = useAppStore((state) => state.currentUser);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);

  const myEntries = useMemo(
    () => [...timeEntries]
      .filter((entry) => entry.userId === currentUser.id || entry.workerName === currentUser.name)
      .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [currentUser.id, currentUser.name, timeEntries],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="My Timesheets" subtitle="Review your own time entries and approval statuses." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">My Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {myEntries.length ? (
            <RecentTimeEntriesTable entries={myEntries} clients={clients} projects={projects} readOnly />
          ) : (
            <EmptyState icon={FileClock} title="No entries yet" description="Clock in from the employee clock page to create your first timesheet entry." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
