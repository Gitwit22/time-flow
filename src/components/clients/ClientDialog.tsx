import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Client } from "@/types";

interface ContactDraft {
  name: string;
  email: string;
}

function normalizeContacts(client?: Client | null): ContactDraft[] {
  if (client?.contacts?.length) {
    return client.contacts.map((contact) => ({
      name: contact.name ?? "",
      email: contact.email ?? "",
    }));
  }

  if (client?.contactName || client?.contactEmail) {
    return [{ name: client.contactName ?? "", email: client.contactEmail ?? "" }];
  }

  return [{ name: "", email: "" }];
}

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
  contacts: [{ name: "", email: "" }],
  companyViewerEnabled: false,
  documents: [],
};

export function ClientDialog({ client, open, onOpenChange, onSubmit }: ClientDialogProps) {
  const [form, setForm] = useState<Omit<Client, "id">>(
    client ? { ...client, contacts: normalizeContacts(client) } : initialForm,
  );

  useEffect(() => {
    setForm(client ? { ...client, contacts: normalizeContacts(client) } : initialForm);
  }, [client, open]);

  const handleSubmit = () => {
    const contacts = (form.contacts ?? [])
      .map((contact) => ({ name: contact.name.trim(), email: contact.email.trim() }))
      .filter((contact) => contact.name || contact.email);
    const primaryContact = contacts[0];

    onSubmit({
      ...form,
      contacts,
      contactName: primaryContact?.name || undefined,
      contactEmail: primaryContact?.email || undefined,
    });
  };

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
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">People with visibility</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    contacts: [...(current.contacts ?? []), { name: "", email: "" }],
                  }))
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add person
              </Button>
            </div>
            {(form.contacts ?? []).map((contact, index) => (
              <div key={`contact-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder="Name"
                  value={contact.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contacts: (current.contacts ?? []).map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={contact.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contacts: (current.contacts ?? []).map((item, itemIndex) =>
                        itemIndex === index ? { ...item, email: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-destructive"
                  disabled={(form.contacts ?? []).length <= 1}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      contacts: (current.contacts ?? []).filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">The first person is treated as the primary contact for invoices.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hourly rate (optional)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Required before this client can be invoiced"
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
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit}>
            {client ? "Save client" : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
