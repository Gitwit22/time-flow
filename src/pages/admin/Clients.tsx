import { useState } from "react";
import { Eye, Mail, Pencil, Plus, Trash2 } from "lucide-react";

import { ClientDialog } from "@/components/clients/ClientDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { generateViewerInvite } from "@/lib/auth";
import { formatCurrency } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import type { Client } from "@/types";

export default function Clients() {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const addClient = useAppStore((state) => state.addClient);
  const updateClient = useAppStore((state) => state.updateClient);
  const deleteClient = useAppStore((state) => state.deleteClient);
  const currentUser = useAppStore((state) => state.currentUser);
  const isReadonly = useAppStore((state) => state.currentUser.role === "client_viewer");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleSaveClient = (value: Omit<Client, "id">) => {
    if (isReadonly) {
      return;
    }

    if (editingClient) {
      updateClient(editingClient.id, value);
      toast({ title: "Client updated", description: `${value.name} was updated.` });
    } else {
      addClient(value);
      toast({ title: "Client added", description: `${value.name} was added.` });
    }

    setEditingClient(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your clients, rates, and portal access.</p>
        </div>

        {!isReadonly ? (
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              setEditingClient(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        ) : null}
      </div>

      {isReadonly ? <div className="readonly-banner">Viewer mode: client management is disabled.</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-heading font-semibold text-lg">{client.name}</h3>
                  <p className="text-sm text-muted-foreground">{client.contactName || "No contact name"}</p>
                </div>
                <div className="flex items-center gap-1">
                  {client.companyViewerEnabled && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Eye className="h-3 w-3" /> Portal Active
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-muted-foreground text-xs">Contact</p>
                  <p className="font-medium">{client.contactName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Hourly Rate</p>
                  <p className="font-medium">{client.hourlyRate ? `${formatCurrency(client.hourlyRate)}/hr` : "Default rate"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Client ID</p>
                  <p className="font-medium truncate">{client.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="font-medium truncate">{client.contactEmail || "-"}</p>
                </div>
              </div>

              {!isReadonly ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingClient(client);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      updateClient(client.id, { companyViewerEnabled: true });
                      const invite = generateViewerInvite(client.id, currentUser.email);
                      const inviteUrl = `${window.location.origin}/invite?code=${encodeURIComponent(invite.code)}`;

                      try {
                        await navigator.clipboard.writeText(inviteUrl);
                        toast({ title: "Invite link copied", description: `${client.name} viewer link copied to clipboard.` });
                      } catch {
                        toast({ title: "Invite generated", description: `Code for ${client.name}: ${invite.code}` });
                      }
                    }}
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" /> Invite Viewer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      deleteClient(client.id);
                      toast({ title: "Client deleted", description: `${client.name} was removed.` });
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <ClientDialog
        client={editingClient}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingClient(null);
          }
        }}
        onSubmit={handleSaveClient}
      />
    </div>
  );
}
