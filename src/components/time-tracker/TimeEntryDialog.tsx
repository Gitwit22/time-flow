import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateForInput, parseDateInput, toDateOnlyString } from "@/lib/date";
import { getProjectBudgetSnapshot, getProjectWarningMessage, getSelectableProjects } from "@/lib/projects";
import { getEntryType } from "@/lib/timeEntries";
import type { Client, Project, TimeEntry } from "@/types";

interface TimeEntryDialogProps {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  entry?: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: Omit<TimeEntry, "id">) => void;
}

function emptyState(clientId = "") {
  return {
    entryType: "time" as const,
    fixedAmount: undefined,
    clientId,
    projectId: undefined,
    date: toDateOnlyString(new Date()),
    startTime: "09:00",
    endTime: "17:00",
    durationHours: 8,
    billingRate: undefined,
    billable: true,
    invoiced: false,
    invoiceStatus: "unbilled" as const,
    invoiceId: null,
    notes: "",
    status: "completed" as const,
  };
}

export function TimeEntryDialog({ clients, projects, timeEntries, entry, open, onOpenChange, onSubmit }: TimeEntryDialogProps) {
  const [form, setForm] = useState<Omit<TimeEntry, "id">>(entry ? { ...entry } : emptyState(clients[0]?.id ?? ""));
  const [linkMode, setLinkMode] = useState<"client" | "project">(entry?.projectId ? "project" : "client");
  const [error, setError] = useState<string>("");
  const entryType = getEntryType(form);

  useEffect(() => {
    setForm(entry ? { ...entry } : emptyState(clients[0]?.id ?? ""));
    setLinkMode(entry?.projectId ? "project" : "client");
    setError("");
  }, [clients, entry, open]);

  const selectableProjects = useMemo(() => getSelectableProjects(projects), [projects]);
  const selectedProject = selectableProjects.find((project) => project.id === form.projectId);
  const previewDuration = useMemo(() => {
    const [startHours, startMinutes] = form.startTime.split(":").map(Number);
    const [endHours, endMinutes] = (form.endTime ?? "00:00").split(":").map(Number);
    return Math.max(0, Number((((endHours * 60 + endMinutes) - (startHours * 60 + startMinutes)) / 60).toFixed(2)));
  }, [form.endTime, form.startTime]);
  const budgetSnapshot = selectedProject
    ? getProjectBudgetSnapshot(
        selectedProject,
        timeEntries.filter((item) => item.id !== entry?.id),
        clients,
        projects,
        entryType === "fixed"
          ? Math.max(0, Number(form.fixedAmount ?? 0))
          : ((form.billingRate ?? selectedProject.hourlyRate) * previewDuration) || 0,
      )
    : null;
  const budgetWarning = selectedProject && budgetSnapshot ? getProjectWarningMessage(selectedProject, budgetSnapshot) : null;

  const handleSubmit = () => {
    setError("");

    if (linkMode === "project" && !selectedProject) {
      setError("Please select a project before saving.");
      return;
    }

    if (linkMode === "client" && !form.clientId) {
      setError("Please select a client before saving.");
      return;
    }

    if (selectedProject && budgetSnapshot?.isBlocked) {
      setError("This project is at its cap and blocks additional billable entries.");
      return;
    }

    if (entryType === "fixed") {
      const parsedAmount = Number(form.fixedAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError("Fixed amount is required and must be greater than 0.");
        return;
      }

      if (!form.notes.trim()) {
        setError("Description is required for fixed amount entries.");
        return;
      }

      onSubmit({
        ...form,
        entryType: "fixed",
        fixedAmount: Number(parsedAmount.toFixed(2)),
        billingRate: undefined,
        billable: form.billable ?? true,
        clientId: linkMode === "project" ? selectedProject?.clientId ?? form.clientId : form.clientId,
        durationHours: 0,
        endTime: undefined,
        projectId: linkMode === "project" ? selectedProject?.id : undefined,
        startTime: "00:00",
      });
      return;
    }

    if (!form.startTime || !form.endTime) {
      setError("Clock in and clock out are required for time entries.");
      return;
    }

    const [startHours, startMinutes] = form.startTime.split(":").map(Number);
    const [endHours, endMinutes] = (form.endTime ?? "00:00").split(":").map(Number);
    const durationHours = Math.max(0, Number((((endHours * 60 + endMinutes) - (startHours * 60 + startMinutes)) / 60).toFixed(2)));

    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      setError("Time entry duration must be greater than 0.");
      return;
    }

    onSubmit({
      ...form,
      entryType: "time",
      fixedAmount: undefined,
      billable: form.billable ?? true,
      billingRate: linkMode === "project" ? selectedProject?.hourlyRate : clients.find((client) => client.id === form.clientId)?.hourlyRate,
      clientId: linkMode === "project" ? selectedProject?.clientId ?? form.clientId : form.clientId,
      durationHours,
      projectId: linkMode === "project" ? selectedProject?.id : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{entry ? "Edit time entry" : "Add time entry"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Entry type</Label>
            <Select
              value={entryType}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  billable: current.billable ?? true,
                  entryType: value === "fixed" ? "fixed" : "time",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Time Entry</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
            {entryType === "fixed" ? (
              <p className="text-xs text-muted-foreground">Use fixed amount for flat-rate work, deposits, fees, or project charges that are not based on hours.</p>
            ) : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Link entry to</Label>
            <Select value={linkMode} onValueChange={(value) => setLinkMode(value as typeof linkMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client only</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Entry Date</Label>
            <Input type="date" value={formatDateForInput(form.date)} onChange={(event) => setForm((current) => ({ ...current, date: parseDateInput(event.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{linkMode === "project" ? "Project" : "Client"}</Label>
            <Select
              value={linkMode === "project" ? form.projectId : form.clientId}
              onValueChange={(value) =>
                setForm((current) =>
                  linkMode === "project"
                    ? {
                        ...current,
                        projectId: value,
                        clientId: projects.find((project) => project.id === value)?.clientId ?? current.clientId,
                        billingRate: projects.find((project) => project.id === value)?.hourlyRate,
                      }
                    : { ...current, clientId: value, projectId: undefined, billingRate: clients.find((client) => client.id === value)?.hourlyRate },
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={linkMode === "project" ? "Select a project" : "Select a client"} />
              </SelectTrigger>
              <SelectContent>
                {linkMode === "project"
                  ? selectableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  : clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          {linkMode === "project" ? (
            <div className="space-y-1.5 sm:col-span-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Client auto-filled from project: {selectedProject ? clients.find((client) => client.id === selectedProject.clientId)?.name ?? "Unknown client" : "Select a project"}
            </div>
          ) : null}

          {entryType === "time" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Clock In</Label>
                <Input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Clock Out</Label>
                <Input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Fixed amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fixedAmount ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, fixedAmount: event.target.value === "" ? undefined : Number(event.target.value) }))}
                  placeholder="500.00"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.billable ?? true}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, billable: Boolean(checked) }))}
                  />
                  Billable
                </label>
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Description / memo</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24 resize-none" />
          </div>
          {error ? <div className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          {budgetWarning ? <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{budgetWarning}</div> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit}>
            {entry ? "Save changes" : "Save entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
