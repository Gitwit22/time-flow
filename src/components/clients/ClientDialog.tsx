import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Client } from "@/types";

interface ClientDialogProps {
  client?: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: Omit<Client, "id">) => void;
}

const initialForm: Omit<Client, "id"> = {
  name: "",
  contactName: "",
  contactEmail: "",
  companyViewerEnabled: false,
};

export function ClientDialog({ client, open, onOpenChange, onSubmit }: ClientDialogProps) {
  const [form, setForm] = useState<Omit<Client, "id">>(client ? { ...client } : initialForm);

  useEffect(() => {
    setForm(client ? { ...client } : initialForm);
  }, [client, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{client ? "Edit client" : "Add client"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Company name</Label>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact name</Label>
              <Input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact email</Label>
              <Input type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hourly rate (optional)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Leave blank to use your default rate"
              value={form.hourlyRate ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, hourlyRate: event.target.value ? Number(event.target.value) : undefined }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Client viewer access</p>
              <p className="text-xs text-muted-foreground">Let this client review hours and invoices in read-only mode.</p>
            </div>
            <Switch checked={form.companyViewerEnabled} onCheckedChange={(value) => setForm((current) => ({ ...current, companyViewerEnabled: value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onSubmit(form)}>
            {client ? "Save client" : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
