import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateForInput, parseDateInput, toDateOnlyString } from "@/lib/date";
import type { Client, Project } from "@/types";

interface ProjectDialogProps {
  clients: Client[];
  open: boolean;
  project?: Project | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: Omit<Project, "id">) => void;
}

function createInitialProject(clientId = ""): Omit<Project, "id"> {
  return {
    name: "",
    clientId,
    status: "planning",
    description: "",
    billingType: "hourly_capped",
    hourlyRate: 0,
    maxPayoutCap: 0,
    capHandling: "warn_only",
    startDate: toDateOnlyString(new Date()),
    endDate: "",
    notes: "",
    documents: [],
  };
}

export function ProjectDialog({ clients, open, project, onOpenChange, onSubmit }: ProjectDialogProps) {
  const [form, setForm] = useState<Omit<Project, "id">>(project ? { ...project } : createInitialProject(clients[0]?.id ?? ""));

  useEffect(() => {
    setForm(project ? { ...project } : createInitialProject(clients[0]?.id ?? ""));
  }, [clients, open, project]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{project ? "Edit project" : "Create project"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Project name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Linked client</Label>
              <Select value={form.clientId} onValueChange={(value) => setForm((current) => ({ ...current, clientId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea className="min-h-24 resize-none" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as Project["status"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Billing type</Label>
              <Select value={form.billingType} onValueChange={(value) => setForm((current) => ({ ...current, billingType: value as Project["billingType"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly_uncapped">Hourly uncapped</SelectItem>
                  <SelectItem value="hourly_capped">Hourly capped</SelectItem>
                  <SelectItem value="fixed_fee">Fixed fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cap handling</Label>
              <Select value={form.capHandling} onValueChange={(value) => setForm((current) => ({ ...current, capHandling: value as Project["capHandling"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow_overage">Allow overage</SelectItem>
                  <SelectItem value="warn_only">Warn only</SelectItem>
                  <SelectItem value="block_billable">Block further billable entries</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Hourly rate</Label>
              <Input type="number" min="0" step="0.01" value={form.hourlyRate || ""} onChange={(event) => setForm((current) => ({ ...current, hourlyRate: Number(event.target.value || 0) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max payout cap</Label>
              <Input type="number" min="0" step="0.01" value={form.maxPayoutCap || ""} onChange={(event) => setForm((current) => ({ ...current, maxPayoutCap: Number(event.target.value || 0) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Project Start Date</Label>
              <Input type="date" value={formatDateForInput(form.startDate)} onChange={(event) => setForm((current) => ({ ...current, startDate: parseDateInput(event.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Project End Date</Label>
              <Input type="date" value={formatDateForInput(form.endDate)} onChange={(event) => setForm((current) => ({ ...current, endDate: parseDateInput(event.target.value) || undefined }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Internal notes</Label>
            <Textarea className="min-h-24 resize-none" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onSubmit(form)}>
            {project ? "Save project" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
