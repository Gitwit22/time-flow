import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, toDateOnlyString } from "@/lib/date";
import { canEditInvoiceDirectly, getInvoiceEditLockReason, validateInvoiceLineItems } from "@/lib/invoice";
import { useAppStore } from "@/store/appStore";
import type { Invoice, InvoiceLineItem } from "@/types";

interface EditInvoiceDialogProps {
  invoice: Invoice;
  /** Render as a small icon button (Invoices tab) instead of a labelled button. */
  compact?: boolean;
  /** Lines to start from when the page already derived them (e.g. older invoices without saved lines). */
  initialLineItems?: InvoiceLineItem[];
}

/** Time lines bill hours × rate; fixed, manual and expense lines bill a set amount. */
function isHourlyLine(line: InvoiceLineItem) {
  return line.lineType === undefined || line.lineType === "time";
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function EditInvoiceDialog({ invoice, compact = false, initialLineItems }: EditInvoiceDialogProps) {
  const { toast } = useToast();
  const saveInvoiceEdits = useAppStore((state) => state.saveInvoiceEdits);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<InvoiceLineItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const source = initialLineItems ?? invoice.lineItems;
    setLines(source.map((line) => ({ ...line, timeEntryIds: line.timeEntryIds ?? [] })));
    // Only reset when the dialog opens, not while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.amount, 0), [lines]);
  const taxAmount = subtotal * (invoice.taxRate ?? 0);
  const validationError = validateInvoiceLineItems(lines);
  const reopensAsDraft = !canEditInvoiceDirectly(invoice);

  if (getInvoiceEditLockReason(invoice)) return null;

  const updateLine = (index: number, changes: Partial<InvoiceLineItem>) => {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...changes };
        if (isHourlyLine(next) && ("hours" in changes || "rate" in changes)) {
          next.amount = Number((next.hours * next.rate).toFixed(2));
        }
        return next;
      }),
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: `line-${crypto.randomUUID()}`,
        description: "",
        date: toDateOnlyString(new Date()),
        hours: 0,
        rate: 0,
        amount: 0,
        lineType: "manual",
        timeEntryIds: [],
      },
    ]);
  };

  const handleSave = async () => {
    if (validationError) return;
    setSaving(true);
    const result = await saveInvoiceEdits(invoice.id, lines);
    setSaving(false);
    if (result.ok) {
      toast({
        title: "Invoice updated",
        description: reopensAsDraft ? `${invoice.id} is now a draft. Send it again when ready.` : `${invoice.id} was saved.`,
      });
      setOpen(false);
    } else {
      toast({ title: "Invoice not saved", description: result.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label={`Edit ${invoice.id}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit {invoice.id}</DialogTitle>
          <DialogDescription>Change line items. Removed time goes back to unbilled so you can invoice it again.</DialogDescription>
        </DialogHeader>

        {reopensAsDraft ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            This invoice was already sent. Saving reopens it as a draft. Send it again after editing.
          </p>
        ) : null}

        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-2 text-left font-medium">Description</th>
                <th className="w-20 py-2 pr-2 text-left font-medium">Hours</th>
                <th className="w-24 py-2 pr-2 text-left font-medium">Rate</th>
                <th className="w-28 py-2 pr-2 text-left font-medium">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const hourly = isHourlyLine(line);
                return (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <Input
                        aria-label={`Line ${index + 1} description`}
                        value={line.description}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        aria-label={`Line ${index + 1} hours`}
                        type="number"
                        min={0}
                        step="0.25"
                        value={line.hours}
                        disabled={!hourly}
                        onChange={(event) => updateLine(index, { hours: toNumber(event.target.value) })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        aria-label={`Line ${index + 1} rate`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.rate}
                        disabled={!hourly}
                        onChange={(event) => updateLine(index, { rate: toNumber(event.target.value) })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        aria-label={`Line ${index + 1} amount`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.amount}
                        disabled={hourly}
                        onChange={(event) => updateLine(index, { amount: toNumber(event.target.value) })}
                      />
                    </td>
                    <td className="py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        aria-label={`Remove line ${index + 1}`}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button variant="outline" size="sm" className="w-fit" onClick={addLine}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
        </Button>

        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          {invoice.taxRate ? (
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(taxAmount)}</span></div>
          ) : null}
          <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(subtotal + taxAmount)}</span></div>
        </div>

        {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={Boolean(validationError) || saving}>
            {saving ? "Saving…" : reopensAsDraft ? "Save as draft" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
