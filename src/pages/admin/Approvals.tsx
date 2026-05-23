import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { canApproveTime } from "@/lib/organization";
import { formatCurrency, formatHours, formatLongDate } from "@/lib/date";
import { useAppStore } from "@/store/appStore";

export default function ApprovalsPage() {
  const { toast } = useToast();
  const role = useAppStore((state) => state.currentUser.role);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const approveTimeEntry = useAppStore((state) => state.approveTimeEntry);
  const rejectTimeEntry = useAppStore((state) => state.rejectTimeEntry);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const pendingEntries = useMemo(
    () => timeEntries.filter((entry) => entry.status === "pending_approval"),
    [timeEntries],
  );

  const canReview = canApproveTime(role);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Approvals" subtitle="Review pending time entries before they affect invoices or reports." />

      {!canReview ? <div className="readonly-banner">Your role cannot approve/reject time entries.</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Pending Approval Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingEntries.length ? (
            <div className="space-y-3">
              {pendingEntries.map((entry) => {
                const clientName = clients.find((client) => client.id === entry.clientId)?.name ?? "Unknown client";
                const projectName = entry.projectId ? projects.find((project) => project.id === entry.projectId)?.name ?? "Unknown project" : "No project";
                const reason = rejectionReasons[entry.id] ?? "";

                return (
                  <div key={entry.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{entry.workerName || "Team Member"}</p>
                        <p className="text-sm text-muted-foreground">{formatLongDate(entry.date)} · {clientName} · {projectName}</p>
                        <p className="text-sm text-muted-foreground">{formatHours(entry.durationHours)} · {formatCurrency((entry.billingRate || 0) * entry.durationHours)}</p>
                      </div>
                      <span className="status-badge-warning">pending_approval</span>
                    </div>

                    {entry.notes ? <p className="text-sm">{entry.notes}</p> : null}

                    {canReview ? (
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor={`reject-${entry.id}`}>Rejection Reason (required if rejecting)</Label>
                          <Input id={`reject-${entry.id}`} value={reason} onChange={(event) => setRejectionReasons((prev) => ({ ...prev, [entry.id]: event.target.value }))} />
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (!reason.trim()) {
                              toast({ title: "Reason required", description: "Provide a rejection reason.", variant: "destructive" });
                              return;
                            }
                            rejectTimeEntry(entry.id, reason.trim());
                            toast({ title: "Entry rejected", description: "The time entry was rejected with reason." });
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          onClick={() => {
                            approveTimeEntry(entry.id);
                            toast({ title: "Entry approved", description: "The time entry is now approved." });
                          }}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No pending approvals" description="All caught up. New employee clock-outs will appear here." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
