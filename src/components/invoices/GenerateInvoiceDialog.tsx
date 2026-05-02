import { useMemo, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { buildSingleClientInvoicePreview } from "@/lib/billing";
import { formatCurrency, formatDateForInput, formatHours, formatLongDate, parseDateInput, toIsoDate } from "@/lib/date";
import { getCurrentPayPeriod, getPreviousPayPeriod } from "@/lib/payPeriods";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";
import type { InvoiceBillingMode, InvoiceDraftPreview } from "@/types";

interface GenerateInvoiceDialogProps {
  trigger: React.ReactNode;
}

type Step = "configure" | "review";
type RangeMode = "current-period" | "previous-period" | "custom-range" | "outstanding";

export function GenerateInvoiceDialog({ trigger }: GenerateInvoiceDialogProps) {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const expenses = useAppStore((state) => state.expenses);
  const invoices = useAppStore((state) => state.invoices);
  const commitSingleInvoice = useAppStore((state) => state.commitSingleInvoice);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("configure");
  const [clientId, setClientId] = useState<string>("");
  const [rangeMode, setRangeMode] = useState<RangeMode>("current-period");
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + (currentUser.invoiceDueDays ?? 30));
    return toIsoDate(d);
  });
  const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState<Set<string>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const selectedClient = clients.find((c) => c.id === clientId);
  const payPeriodSettings = {
    payPeriodFrequency: settings.payPeriodFrequency ?? settings.invoiceFrequency ?? currentUser.invoiceFrequency,
    payPeriodStartDate: settings.payPeriodStartDate,
    periodWeekStartsOn: settings.periodWeekStartsOn,
  };
  const currentPayPeriod = getCurrentPayPeriod(payPeriodSettings, new Date());
  const previousPayPeriod = getPreviousPayPeriod(currentPayPeriod, payPeriodSettings);
  const effectiveBillingMode: InvoiceBillingMode = rangeMode === "outstanding" ? "outstanding" : "range";
  const effectiveRangeStart = rangeMode === "current-period"
    ? currentPayPeriod.startDate
    : rangeMode === "previous-period"
      ? previousPayPeriod.startDate
      : rangeStart;
  const effectiveRangeEnd = rangeMode === "current-period"
    ? currentPayPeriod.endDate
    : rangeMode === "previous-period"
      ? previousPayPeriod.endDate
      : rangeEnd;

  const basePreviewResult = useMemo(() => {
    if (!clientId) return null;
    if (effectiveBillingMode === "range" && (!effectiveRangeStart || !effectiveRangeEnd)) return null;

    return buildSingleClientInvoicePreview(
      timeEntries,
      expenses,
      clients,
      projects,
      invoices,
      clientId,
      effectiveBillingMode,
      dueDate,
      effectiveBillingMode === "range" ? { rangeStart: effectiveRangeStart, rangeEnd: effectiveRangeEnd } : {},
    );
  }, [clientId, clients, dueDate, effectiveBillingMode, effectiveRangeEnd, effectiveRangeStart, expenses, invoices, projects, timeEntries]);

  const expenseLookup = useMemo(() => {
    return new Map(expenses.map((expense) => [expense.id, expense]));
  }, [expenses]);

  const baseTimeItems = useMemo(
    () => (basePreviewResult?.preview?.lineItems ?? []).filter((item) => item.lineType !== "expense"),
    [basePreviewResult?.preview?.lineItems],
  );
  const baseExpenseItems = useMemo(
    () => (basePreviewResult?.preview?.lineItems ?? []).filter((item) => item.lineType === "expense"),
    [basePreviewResult?.preview?.lineItems],
  );

  const finalPreview = useMemo((): InvoiceDraftPreview | null => {
    const base = basePreviewResult?.preview;
    if (!base) return null;

    const keptItems = base.lineItems.filter((item) => {
      if (item.lineType === "expense") {
        return item.expenseId ? selectedExpenseIds.has(item.expenseId) : false;
      }

      const timeEntryId = item.timeEntryIds[0];
      return timeEntryId ? selectedTimeEntryIds.has(timeEntryId) : false;
    });
    if (keptItems.length === 0) return null;

    const entryIds = keptItems.flatMap((item) => item.timeEntryIds);
    const totalHours = Number(keptItems.reduce((sum, item) => sum + item.hours, 0).toFixed(2));
    const subtotal = Number(keptItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
    const taxAmount = Number((subtotal * base.taxRate).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    return { ...base, lineItems: keptItems, entryIds, timeEntryIds: entryIds, totalHours, subtotal, taxAmount, totalAmount };
  }, [basePreviewResult, selectedExpenseIds, selectedTimeEntryIds]);

  const laborSubtotal = useMemo(
    () => Number((finalPreview?.lineItems.filter((item) => item.lineType !== "expense").reduce((sum, item) => sum + item.amount, 0) ?? 0).toFixed(2)),
    [finalPreview],
  );

  const expenseSubtotal = useMemo(
    () => Number((finalPreview?.lineItems.filter((item) => item.lineType === "expense").reduce((sum, item) => sum + item.amount, 0) ?? 0).toFixed(2)),
    [finalPreview],
  );

  const canPreview = !!clientId && (effectiveBillingMode === "outstanding" || (!!effectiveRangeStart && !!effectiveRangeEnd));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStep("configure");
      setClientId("");
      setRangeMode("current-period");
      setRangeStart("");
      setRangeEnd("");
      setSelectedTimeEntryIds(new Set());
      setSelectedExpenseIds(new Set());
    }
  }

  function handleGoToReview() {
    const base = basePreviewResult?.preview;
    setSelectedTimeEntryIds(new Set((base?.lineItems ?? []).flatMap((item) => (item.lineType === "expense" ? [] : item.timeEntryIds))));
    setSelectedExpenseIds(new Set((base?.lineItems ?? []).flatMap((item) => (item.lineType === "expense" && item.expenseId ? [item.expenseId] : []))));
    setStep("review");
  }

  function handleToggleTimeEntry(entryId: string, checked: boolean) {
    setSelectedTimeEntryIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(entryId);
      } else {
        next.delete(entryId);
      }
      return next;
    });
  }

  function handleToggleExpense(expenseId: string, checked: boolean) {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(expenseId);
      } else {
        next.delete(expenseId);
      }
      return next;
    });
  }

  function handleSelectAllExpenses() {
    setSelectedExpenseIds(new Set(baseExpenseItems.flatMap((item) => (item.expenseId ? [item.expenseId] : []))));
  }

  function handleClearExpenses() {
    setSelectedExpenseIds(new Set());
  }

  function handleConfirm() {
    if (!finalPreview) return;

    const invoice = commitSingleInvoice({ ...finalPreview, dueDate });
    if (!invoice) {
      toast({ title: "Error", description: "Could not generate invoice.", variant: "destructive" });
      return;
    }

    const count = finalPreview.entryIds.length;
    const expenseLineCount = finalPreview.lineItems.filter((item) => item.lineType === "expense").length;
    toast({
      title: "Invoice created",
      description:
        count > 0
          ? `${invoice.id} was created as a draft. ${count} time entr${count === 1 ? "y was" : "ies were"} marked as invoiced${expenseLineCount > 0 ? ` and ${expenseLineCount} expense${expenseLineCount === 1 ? "" : "s"} added.` : "."}`
          : `${invoice.id} was created as a draft with ${expenseLineCount} expense line${expenseLineCount === 1 ? "" : "s"}.`,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pb-0 pt-6">
          <DialogTitle className="font-heading">
            {step === "configure" ? "Generate Invoice" : "Review & Confirm"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
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

            {!settings.payPeriodStartDate ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Pay period start date is not set yet. Current and previous pay period presets are using a default anchor until you save your pay period settings.
              </div>
            ) : null}

            {/* Invoice source */}
            <div className="space-y-2">
              <Label>Generate Invoice From</Label>
              <Select value={rangeMode} onValueChange={(value) => setRangeMode(value as RangeMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-period">Current Pay Period</SelectItem>
                  <SelectItem value="previous-period">Previous Pay Period</SelectItem>
                  <SelectItem value="custom-range">Custom Range</SelectItem>
                  <SelectItem value="outstanding">All Unbilled Completed Entries</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range inputs */}
            {rangeMode !== "outstanding" ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {rangeMode === "current-period"
                  ? `Current pay period: ${formatLongDate(currentPayPeriod.startDate)} → ${formatLongDate(currentPayPeriod.endDate)}`
                  : rangeMode === "previous-period"
                    ? `Previous pay period: ${formatLongDate(previousPayPeriod.startDate)} → ${formatLongDate(previousPayPeriod.endDate)}`
                    : "Choose a custom invoice period below."}
              </div>
            ) : null}

            {rangeMode === "custom-range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Invoice Period Start</Label>
                  <Input type="date" value={formatDateForInput(rangeStart)} onChange={(e) => setRangeStart(parseDateInput(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Invoice Period End</Label>
                  <Input type="date" value={formatDateForInput(rangeEnd)} onChange={(e) => setRangeEnd(parseDateInput(e.target.value))} />
                </div>
              </div>
            )}

            {/* No entries warning */}
            {canPreview && basePreviewResult && !basePreviewResult.preview && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No uninvoiced billable time entries or expenses found{effectiveBillingMode === "range" ? " in the selected date range" : ""} for{" "}
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
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      {selectedClient?.name} —{" "}
                      {effectiveBillingMode === "range"
                        ? `${formatLongDate(effectiveRangeStart)} → ${formatLongDate(effectiveRangeEnd)}`
                        : "All outstanding"}
                    </span>
                    <span className="status-badge-accent self-start sm:self-auto">
                      {finalPreview.lineItems.length} line{finalPreview.lineItems.length === 1 ? "" : "s"} selected
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border">
                      <div className="border-b px-3 py-2 text-sm font-medium">Labor / Time Entries</div>
                      <div className="max-h-[28vh] overflow-y-auto divide-y">
                        {baseTimeItems.length ? (
                          baseTimeItems.map((item) => {
                            const timeEntryId = item.timeEntryIds[0] ?? item.id;
                            const isSelected = selectedTimeEntryIds.has(timeEntryId);
                            return (
                              <div key={item.id} className={`flex items-start gap-3 px-3 py-3 transition-opacity ${!isSelected ? "opacity-40" : ""}`}>
                                <Checkbox
                                  id={`time-${timeEntryId}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleToggleTimeEntry(timeEntryId, !!checked)}
                                  className="mt-1"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-5 break-words">{item.description}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{formatLongDate(item.date)}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                                  <p className="text-xs text-muted-foreground">{formatHours(item.hours)} × {formatCurrency(item.rate)}/hr</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="px-3 py-3 text-sm text-muted-foreground">No eligible time entries.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border">
                      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                        <p className="text-sm font-medium">Expenses</p>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={handleSelectAllExpenses}>
                            Select all eligible expenses
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={handleClearExpenses}>
                            Clear expenses
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[28vh] overflow-y-auto divide-y">
                        {baseExpenseItems.length ? (
                          baseExpenseItems.map((item) => {
                            if (!item.expenseId) {
                              return null;
                            }

                            const expense = expenseLookup.get(item.expenseId);
                            const projectName = expense?.projectId ? projects.find((project) => project.id === expense.projectId)?.name : undefined;
                            const isSelected = selectedExpenseIds.has(item.expenseId);
                            return (
                              <div key={item.id} className={`flex items-start gap-3 px-3 py-3 transition-opacity ${!isSelected ? "opacity-40" : ""}`}>
                                <Checkbox
                                  id={`expense-${item.expenseId}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleToggleExpense(item.expenseId!, !!checked)}
                                  className="mt-1"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-5 break-words">{expense?.vendor ? `${expense.vendor} — ${item.description}` : item.description}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatLongDate(item.date)} · {projectName ?? "Client"} · {expense?.category ?? "other"}
                                    {expense?.receiptAttached ? " · Receipt" : ""}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                                  <p className="text-xs text-muted-foreground">Expense reimbursement</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="px-3 py-3 text-sm text-muted-foreground">No eligible expenses.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                    <div className="grid gap-1.5 sm:max-w-xs">
                      <Label>Due date</Label>
                      <Input type="date" value={formatDateForInput(dueDate)} onChange={(e) => setDueDate(parseDateInput(e.target.value))} />
                    </div>

                    <div className="space-y-2 rounded-lg border p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Selected hours</span>
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
                        <span className="text-muted-foreground">Selected labor total</span>
                        <span className="font-medium">{formatCurrency(laborSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Selected expense total</span>
                        <span className="font-medium">{formatCurrency(expenseSubtotal)}</span>
                      </div>
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
                        <span className="text-lg font-semibold">{formatCurrency(finalPreview.totalAmount)}</span>
                      </div>
                    </div>
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
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
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
