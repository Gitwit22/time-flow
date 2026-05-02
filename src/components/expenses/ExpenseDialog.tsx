import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateForInput, parseDateInput, toDateOnlyString } from "@/lib/date";
import type { Client, Expense, Project } from "@/types";

interface ExpenseDialogProps {
  clients: Client[];
  expense?: Expense | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (expense: Omit<Expense, "id">) => void;
  open: boolean;
  projects: Project[];
}

function createInitialExpense(): Omit<Expense, "id"> {
  return {
    amount: 0,
    billableToClient: true,
    billTo: "client",
    category: "other",
    clientId: undefined,
    date: toDateOnlyString(new Date()),
    description: "",
    excludedFromPayPeriod: false,
    includedInPayPeriod: false,
    invoiceId: null,
    notes: "",
    projectId: undefined,
    receiptAttached: false,
    status: "billable",
    vendor: "",
  };
}

export function ExpenseDialog({ clients, expense, onOpenChange, onSubmit, open, projects }: ExpenseDialogProps) {
  const [form, setForm] = useState<Omit<Expense, "id">>(
    expense
      ? {
          ...expense,
            billableToClient: expense.billableToClient ?? true,
          billTo: expense.billTo ?? (expense.projectId ? "project" : "client"),
            invoiceId: expense.invoiceId ?? null,
            receiptAttached: expense.receiptAttached ?? false,
            status: expense.status ?? (expense.billableToClient === false ? "non_billable" : "billable"),
            vendor: expense.vendor ?? "",
        }
      : createInitialExpense(),
  );

  useEffect(() => {
    setForm(
      expense
        ? {
            ...expense,
            billableToClient: expense.billableToClient ?? true,
            billTo: expense.billTo ?? (expense.projectId ? "project" : "client"),
            invoiceId: expense.invoiceId ?? null,
            receiptAttached: expense.receiptAttached ?? false,
            status: expense.status ?? (expense.billableToClient === false ? "non_billable" : "billable"),
            vendor: expense.vendor ?? "",
          }
        : createInitialExpense(),
    );
  }, [expense, open]);

  const availableProjects = useMemo(() => {
    if (!form.clientId) {
      return projects;
    }

    return projects.filter((project) => project.clientId === form.clientId);
  }, [form.clientId, projects]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{expense ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vendor (optional)</Label>
            <Input value={form.vendor ?? ""} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expense Date</Label>
            <Input type="date" value={formatDateForInput(form.date)} onChange={(event) => setForm((current) => ({ ...current, date: parseDateInput(event.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <Input type="number" min="0" step="0.01" value={form.amount || ""} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value || 0) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as Expense["category"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="software">Software</SelectItem>
                <SelectItem value="meals">Meals</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bill Expense To</Label>
            <Select
              value={form.billTo ?? "client"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  billTo: value as Expense["billTo"],
                  projectId: value === "client" ? undefined : current.projectId,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billable to client</Label>
            <Select
              value={form.billableToClient === false ? "no" : "yes"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  billableToClient: value === "yes",
                  status: value === "yes" ? (current.invoiceId ? "invoiced" : "billable") : "non_billable",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.billTo === "project" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Project</Label>
              <Select
                value={form.projectId ?? "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setForm((current) => ({ ...current, projectId: undefined }));
                    return;
                  }

                  const project = projects.find((item) => item.id === value);
                  setForm((current) => ({ ...current, projectId: value, clientId: project?.clientId ?? current.clientId }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select project</SelectItem>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Client</Label>
              <Select
                value={form.clientId ?? "none"}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, clientId: value === "none" ? undefined : value, projectId: undefined }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea className="min-h-24 resize-none" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Receipt</Label>
            <Select
              value={form.receiptAttached ? "yes" : "no"}
              onValueChange={(value) => setForm((current) => ({ ...current, receiptAttached: value === "yes" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Receipt attached</SelectItem>
                <SelectItem value="no">No receipt attached</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={form.billTo === "project" ? !form.projectId : !form.clientId}
            onClick={() => onSubmit(form)}
          >
            {expense ? "Save expense" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}