import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Client, TimeEntry } from "@/types";

interface TimeEntryDialogProps {
  clients: Client[];
  entry?: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: Omit<TimeEntry, "id">) => void;
}

function emptyState(clientId = "") {
  return {
    clientId,
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "17:00",
    durationHours: 8,
    notes: "",
    status: "completed" as const,
  };
}

export function TimeEntryDialog({ clients, entry, open, onOpenChange, onSubmit }: TimeEntryDialogProps) {
  const [form, setForm] = useState<Omit<TimeEntry, "id">>(entry ? { ...entry } : emptyState(clients[0]?.id ?? ""));

  useEffect(() => {
    setForm(entry ? { ...entry } : emptyState(clients[0]?.id ?? ""));
  }, [clients, entry, open]);

  const handleSubmit = () => {
    const [startHours, startMinutes] = form.startTime.split(":").map(Number);
    const [endHours, endMinutes] = (form.endTime ?? "00:00").split(":").map(Number);
    const durationHours = Math.max(0, Number((((endHours * 60 + endMinutes) - (startHours * 60 + startMinutes)) / 60).toFixed(2)));

    onSubmit({
      ...form,
      durationHours,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{entry ? "Edit time entry" : "Add time entry"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client</Label>
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
