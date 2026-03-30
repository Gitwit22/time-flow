import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatHours, formatPeriodLabel } from "@/lib/date";
import { buildInvoiceDrafts } from "@/lib/invoice";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";

interface GenerateInvoiceDialogProps {
  trigger: React.ReactNode;
}

export function GenerateInvoiceDialog({ trigger }: GenerateInvoiceDialogProps) {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const commitInvoiceDrafts = useAppStore((state) => state.commitInvoiceDrafts);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("all");

  const previews = useMemo(
    () => buildInvoiceDrafts(timeEntries, clients, currentUser, settings, new Date(), clientId === "all" ? undefined : clientId),
    [clientId, clients, currentUser, settings, timeEntries],
  );

  const handleConfirm = () => {
    const nextInvoices = commitInvoiceDrafts(previews);

    if (!nextInvoices.length) {
      toast({ title: "Nothing to invoice", description: "There are no completed entries in the current billing period." });
      return;
    }

    toast({
      title: "Draft invoices created",
      description: `${nextInvoices.length} invoice${nextInvoices.length > 1 ? "s were" : " was"} created and related entries were marked invoiced.`,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Generate draft invoices</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Completed entries in the active billing period are grouped by client.</p>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {previews.length ? (
            <div className="space-y-3">
              {previews.map((preview) => (
                <div key={preview.clientId} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading text-lg font-semibold">{preview.clientName}</h3>
                      <p className="text-sm text-muted-foreground">{formatPeriodLabel(preview.periodStart, preview.periodEnd)}</p>
                    </div>
                    <span className="status-badge-accent">{preview.entryIds.length} entries</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Hours</p>
                      <p className="font-medium">{formatHours(preview.totalHours)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rate</p>
                      <p className="font-medium">{formatCurrency(preview.hourlyRate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Draft total</p>
                      <p className="font-medium">{formatCurrency(preview.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FileText} title="No draft invoices available" description="Completed entries need to exist in the current billing period before invoices can be generated." />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm} disabled={!previews.length}>
            Confirm invoice generation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
