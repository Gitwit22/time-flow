import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProjectBudgetSnapshot, getProjectWarningMessage } from "@/lib/projects";
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
    clientId,
    projectId: undefined,
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "17:00",
    durationHours: 8,
    billingRate: undefined,
    notes: "",
    status: "completed" as const,
  };
}

export function TimeEntryDialog({ clients, projects, timeEntries, entry, open, onOpenChange, onSubmit }: TimeEntryDialogProps) {
  const [form, setForm] = useState<Omit<TimeEntry, "id">>(entry ? { ...entry } : emptyState(clients[0]?.id ?? ""));
  const [linkMode, setLinkMode] = useState<"client" | "project">(entry?.projectId ? "project" : "client");

  useEffect(() => {
    setForm(entry ? { ...entry } : emptyState(clients[0]?.id ?? ""));
    setLinkMode(entry?.projectId ? "project" : "client");
  }, [clients, entry, open]);

  const selectedProject = projects.find((project) => project.id === form.projectId);
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
        ((form.billingRate ?? selectedProject.hourlyRate) * previewDuration) || 0,
      )
    : null;
  const budgetWarning = selectedProject && budgetSnapshot ? getProjectWarningMessage(selectedProject, budgetSnapshot) : null;

  const handleSubmit = () => {
    const [startHours, startMinutes] = form.startTime.split(":").map(Number);
    const [endHours, endMinutes] = (form.endTime ?? "00:00").split(":").map(Number);
    const durationHours = Math.max(0, Number((((endHours * 60 + endMinutes) - (startHours * 60 + startMinutes)) / 60).toFixed(2)));

    if (selectedProject && budgetSnapshot?.isBlocked) {
      return;
    }

    onSubmit({
      ...form,
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
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
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
                  ? projects.map((project) => (
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
          <div className="space-y-1.5">
            <Label className="text-xs">Start time</Label>
            <Input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End time</Label>
            <Input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Task / notes</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24 resize-none" />
          </div>
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
