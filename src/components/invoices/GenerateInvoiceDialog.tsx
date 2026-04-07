import { useMemo, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { buildSingleClientInvoicePreview } from "@/lib/billing";
import { formatCurrency, formatHours, formatLongDate, toIsoDate } from "@/lib/date";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";
import type { InvoiceBillingMode, InvoiceDraftPreview } from "@/types";

interface GenerateInvoiceDialogProps {
  trigger: React.ReactNode;
}

type Step = "configure" | "review";

export function GenerateInvoiceDialog({ trigger }: GenerateInvoiceDialogProps) {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const currentUser = useAppStore((state) => state.currentUser);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const commitSingleInvoice = useAppStore((state) => state.commitSingleInvoice);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("configure");
  const [clientId, setClientId] = useState<string>("");
  const [billingMode, setBillingMode] = useState<InvoiceBillingMode>("outstanding");
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + (currentUser.invoiceDueDays ?? 30));
    return toIsoDate(d);
  });
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  const selectedClient = clients.find((c) => c.id === clientId);

  const basePreviewResult = useMemo(() => {
    if (!clientId) return null;
    if (billingMode === "range" && (!rangeStart || !rangeEnd)) return null;

    return buildSingleClientInvoicePreview(
      timeEntries,
      clients,
      projects,
      clientId,
      billingMode,
      dueDate,
      billingMode === "range" ? { rangeStart, rangeEnd } : {},
    );
  }, [clientId, billingMode, rangeStart, rangeEnd, dueDate, timeEntries, clients, projects]);

  const finalPreview = useMemo((): InvoiceDraftPreview | null => {
    const base = basePreviewResult?.preview;
    if (!base) return null;
    if (deselectedIds.size === 0) return base;

    const keptItems = base.lineItems.filter(
      (item) => !item.timeEntryIds.some((id) => deselectedIds.has(id)),
    );
    if (keptItems.length === 0) return null;

    const entryIds = keptItems.flatMap((item) => item.timeEntryIds);
    const totalHours = Number(keptItems.reduce((sum, item) => sum + item.hours, 0).toFixed(2));
    const subtotal = Number(keptItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
    const taxAmount = Number((subtotal * base.taxRate).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    return { ...base, lineItems: keptItems, entryIds, timeEntryIds: entryIds, totalHours, subtotal, taxAmount, totalAmount };
  }, [basePreviewResult, deselectedIds]);

  const canPreview = !!clientId && (billingMode === "outstanding" || (!!rangeStart && !!rangeEnd));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStep("configure");
      setClientId("");
      setBillingMode("outstanding");
      setRangeStart("");
      setRangeEnd("");
      setDeselectedIds(new Set());
    }
  }

  function handleGoToReview() {
    setDeselectedIds(new Set());
    setStep("review");
  }

  function handleToggleEntry(entryId: string, checked: boolean) {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (!finalPreview) return;

    const invoice = commitSingleInvoice({ ...finalPreview, dueDate });
    if (!invoice) {
      toast({ title: "Error", description: "Could not generate invoice.", variant: "destructive" });
      return;
    }

    const count = finalPreview.entryIds.length;
    toast({
      title: "Invoice created",
      description: `${invoice.id} was created as a draft. ${count} time entr${count === 1 ? "y was" : "ies were"} marked as invoiced.`,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {step === "configure" ? "Generate Invoice" : "Review & Confirm"}
          </DialogTitle>
        </DialogHeader>

        {step === "configure" ? (
          <div className="space-y-5">
            {/* Client */}
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client…" />
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

            {/* Billing mode */}
            <div className="space-y-2">
              <Label>Billing mode</Label>
              <RadioGroup
                value={billingMode}
                onValueChange={(v) => setBillingMode(v as InvoiceBillingMode)}
                className="space-y-2"
              >
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="outstanding" id="mode-outstanding" className="mt-0.5" />
                  <Label htmlFor="mode-outstanding" className="cursor-pointer space-y-0.5 font-normal">
                    <span className="font-medium">Generate from Outstanding Time</span>
                    <p className="text-xs text-muted-foreground">
                      Include all uninvoiced billable entries for this client regardless of date.
                    </p>
                  </Label>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="range" id="mode-range" className="mt-0.5" />
                  <Label htmlFor="mode-range" className="cursor-pointer space-y-0.5 font-normal">
                    <span className="font-medium">Generate by Date Range</span>
                    <p className="text-xs text-muted-foreground">
                      Include uninvoiced billable entries within a specific billing period.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Date range inputs */}
            {billingMode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                </div>
              </div>
            )}

            {/* No entries warning */}
            {canPreview && basePreviewResult && !basePreviewResult.preview && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No uninvoiced billable entries found{billingMode === "range" ? " in the selected date range" : ""} for{" "}
                {selectedClient?.name ?? "this client"}.
              </div>
            )}

            {canPreview && (basePreviewResult?.missingRateEntries.length ?? 0) > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Some entries were excluded because no billing rate is configured for that client or project.
              </div>
            )}
          </div>
        ) : (
          /* Review step */
          <div className="space-y-4">
            {finalPreview ? (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {selectedClient?.name} —{" "}
                    {billingMode === "range"
                      ? `${formatLongDate(rangeStart)} → ${formatLongDate(rangeEnd)}`
                      : "All outstanding"}
                  </span>
                  <span className="status-badge-accent">
                    {finalPreview.entryIds.length} entr{finalPreview.entryIds.length === 1 ? "y" : "ies"}
                  </span>
                </div>

                {/* Entry list */}
                <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                  {finalPreview.lineItems.map((item) => {
                    const entryId = item.timeEntryIds[0] ?? item.id;
                    const isSelected = !deselectedIds.has(entryId);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-opacity ${!isSelected ? "opacity-40" : ""}`}
                      >
                        <Checkbox
                          id={`entry-${entryId}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleToggleEntry(entryId, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{formatLongDate(item.date)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatHours(item.hours)} × {formatCurrency(item.rate)}/hr
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total hours</span>
                    <span className="font-medium">{formatHours(finalPreview.totalHours)}</span>
                  </div>
                  {finalPreview.hasMixedRates ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-medium text-amber-600">Mixed rates</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-medium">{formatCurrency(finalPreview.hourlyRate)}/hr</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(finalPreview.subtotal)}</span>
                  </div>
                  {finalPreview.taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({(finalPreview.taxRate * 100).toFixed(0)}%)</span>
                      <span className="font-medium">{formatCurrency(finalPreview.taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold text-lg">{formatCurrency(finalPreview.totalAmount)}</span>
                  </div>
                </div>

                {/* Due date */}
                <div className="grid sm:max-w-xs gap-1.5">
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </>
            ) : (
              <EmptyState
                icon={FileText}
                title="No entries selected"
                description="All entries have been removed. Go back to adjust your selection."
              />
            )}
          </div>
        )}

        <DialogFooter>
          {step === "configure" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleGoToReview}
                disabled={!canPreview || !basePreviewResult?.preview}
              >
                Preview Entries
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("configure")}>
                Back
              </Button>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleConfirm}
                disabled={!finalPreview}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Generate Invoice
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
