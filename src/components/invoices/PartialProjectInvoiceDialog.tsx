import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateForInput, parseDateInput, toIsoDate } from "@/lib/date";
import type { Client, Project } from "@/types";

interface PartialProjectInvoiceFormValue {
  title: string;
  amount: number;
  dueDate: string;
  description: string;
  notes: string;
  status: "draft" | "sent";
  markAsPaid: boolean;
}

interface PartialProjectInvoiceDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  project: Project;
  client?: Client;
  fixedProjectAmount?: number;
  remainingProjectBillableAmount?: number;
  onSubmit: (value: PartialProjectInvoiceFormValue) => void;
}

function createDefaultDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  return toIsoDate(dueDate);
}

export function PartialProjectInvoiceDialog({
  open,
  onOpenChange,
  trigger,
  project,
  client,
  fixedProjectAmount,
  remainingProjectBillableAmount,
  onSubmit,
}: PartialProjectInvoiceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [title, setTitle] = useState("Partial project invoice");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(createDefaultDueDate());
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "sent">("draft");
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedOpen = open ?? internalOpen;
  const setResolvedOpen = onOpenChange ?? setInternalOpen;
  const parsedAmount = Number(amount);
  const hasFixedAmount = typeof fixedProjectAmount === "number" && fixedProjectAmount > 0;

  const remainingLabel = useMemo(() => {
    if (typeof remainingProjectBillableAmount !== "number") {
      return "No fixed project amount set";
    }

    return formatCurrency(remainingProjectBillableAmount);
  }, [remainingProjectBillableAmount]);

  useEffect(() => {
    if (!resolvedOpen) {
      setTitle("Partial project invoice");
      setAmount("");
      setDueDate(createDefaultDueDate());
      setDescription("");
      setNotes("");
      setStatus("draft");
      setMarkAsPaid(false);
      setErrorMessage(null);
    }
  }, [resolvedOpen]);

  function handleCreateInvoice() {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Invoice amount must be greater than 0.");
      return;
    }

    if (hasFixedAmount && typeof remainingProjectBillableAmount === "number" && parsedAmount > remainingProjectBillableAmount) {
      setErrorMessage("This amount exceeds the remaining project balance.");
      return;
    }

    setErrorMessage(null);
    onSubmit({
      title: title.trim() || "Partial project invoice",
      amount: parsedAmount,
      dueDate,
      description: description.trim(),
      notes: notes.trim(),
      status,
      markAsPaid,
    });
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={setResolvedOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Make Partial Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 rounded-xl border bg-muted/30 p-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium">{project.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{client?.name ?? "Unknown client"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fixed project amount</p>
              <p className="font-medium">{hasFixedAmount ? formatCurrency(fixedProjectAmount) : "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining to invoice</p>
              <p className="font-medium">{remainingLabel}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Invoice Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Second milestone invoice" />
            </div>

            <div className="space-y-1.5">
              <Label>Invoice Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="750.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={formatDateForInput(dueDate)} onChange={(event) => setDueDate(parseDateInput(event.target.value))} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Description / Scope Covered</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Second installment for website design work"
                className="min-h-24 resize-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Payment Schedule Note (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Remaining balance due at final delivery"
                className="min-h-20 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as "draft" | "sent")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={markAsPaid} onCheckedChange={(checked) => setMarkAsPaid(Boolean(checked))} />
                Mark as Paid
              </label>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Billing Type: Partial Project Invoice
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setResolvedOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreateInvoice} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Create Partial Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
