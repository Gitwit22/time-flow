import { Paperclip, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateDisplay } from "@/lib/date";
import { apiCreateExpense, apiListExpenses } from "@/lib/timeflowApi";
import {
  archiveTimeflowDocument,
  createTimeflowDocument,
  listTimeflowDocuments,
  uploadTimeflowEntityDocumentFile,
} from "@/lib/timeflowDocumentsApi";
import { getCurrentPayPeriod, getExpensesForPayPeriod, getPayPeriodForDate, getPreviousPayPeriod } from "@/lib/payPeriods";
import { useAppStore } from "@/store/appStore";
import { selectOrganizationScope } from "@/store/selectors";
import type { AttachedDocument, Expense } from "@/types";

type PayPeriodFilter = "all" | "current" | "previous";

export default function ExpensesPage() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const { clients, projects, expenses } = useAppStore(useShallow(selectOrganizationScope));
  const addExpense = useAppStore((state) => state.addExpense);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);

  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [payPeriodFilter, setPayPeriodFilter] = useState<PayPeriodFilter>("current");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expenseDocuments, setExpenseDocuments] = useState<Record<string, AttachedDocument[]>>({});
  const normalizedPayPeriodStartDate = settings.payPeriodStartDate?.trim() || undefined;

  useEffect(() => {
    void listTimeflowDocuments("expense")
      .then((grouped) => {
        setExpenseDocuments(grouped);
      })
      .catch(() => {
        setExpenseDocuments({});
      });
  }, []);

  const payPeriodSettings = {
    payPeriodFrequency: settings.payPeriodFrequency ?? settings.invoiceFrequency ?? currentUser.invoiceFrequency,
    payPeriodStartDate: normalizedPayPeriodStartDate,
    periodWeekStartsOn: settings.periodWeekStartsOn,
  };
  const currentPayPeriod = getCurrentPayPeriod(payPeriodSettings, new Date());
  const previousPayPeriod = getPreviousPayPeriod(currentPayPeriod, payPeriodSettings);
  const selectedPeriod = payPeriodFilter === "current" ? currentPayPeriod : payPeriodFilter === "previous" ? previousPayPeriod : null;

  const filteredExpenses = useMemo(() => {
    const scopedExpenses = selectedPeriod ? getExpensesForPayPeriod(expenses, selectedPeriod) : expenses;

    return [...scopedExpenses]
      .filter((expense) => (clientFilter === "all" ? true : expense.clientId === clientFilter))
      .filter((expense) => {
        if (!searchQuery.trim()) {
          return true;
        }

        const query = searchQuery.toLowerCase();
        const clientName = clients.find((client) => client.id === expense.clientId)?.name ?? "";
        const projectName = projects.find((project) => project.id === expense.projectId)?.name ?? "";
        const billedTarget = (expense.billTo ?? (expense.projectId ? "project" : "client")).toLowerCase();

        return [expense.description, expense.notes, clientName, projectName, expense.category, billedTarget].some((value) =>
          String(value ?? "").toLowerCase().includes(query),
        );
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [clientFilter, clients, expenses, projects, searchQuery, selectedPeriod]);

  const currentPeriodExpenseTotal = useMemo(
    () => getExpensesForPayPeriod(expenses, currentPayPeriod).reduce((sum, expense) => sum + expense.amount, 0),
    [currentPayPeriod, expenses],
  );
  const filteredExpenseTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const uploadExpenseAttachments = async (expenseId: string, files: File[]) => {
    const createdDocuments: AttachedDocument[] = [];

    for (const file of files) {
      const key = await uploadTimeflowEntityDocumentFile(file, "expense", expenseId);
      const document = await createTimeflowDocument("expense", expenseId, {
        title: file.name,
        originalFilename: file.name,
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
        status: "active",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        dataUrl: "",
        storageKey: key,
      });
      createdDocuments.push(document);
    }

    if (createdDocuments.length > 0) {
      setExpenseDocuments((current) => ({
        ...current,
        [expenseId]: [...(current[expenseId] || []), ...createdDocuments],
      }));
    }
  };

  const waitForExpensePersistence = async (expenseId: string) => {
    const maxAttempts = 8;
    const delayMs = 250;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const backendExpenses = await apiListExpenses();
      if (backendExpenses.some((item) => item.id === expenseId)) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error("Expense is still syncing. Please try upload again from Edit Expense.");
  };

  const ensureExpenseExistsInBackend = async (expenseId: string, fallbackExpense: Omit<Expense, "id">) => {
    const backendExpenses = await apiListExpenses();
    const exists = backendExpenses.some((item) => item.id === expenseId);

    if (exists) {
      return;
    }

    await apiCreateExpense({
      id: expenseId,
      ...fallbackExpense,
    });
  };

  const handleSaveExpense = async (expense: Omit<Expense, "id">, files: File[]) => {
    let targetExpenseId = editingExpense?.id;
    const isNewExpense = !editingExpense;
    const fallbackExpenseForEnsure: Omit<Expense, "id"> = editingExpense
      ? {
          ...editingExpense,
          ...expense,
        }
      : expense;

    if (editingExpense) {
      updateExpense(editingExpense.id, expense);
      toast({ title: "Expense updated", description: "Expense changes were saved." });
    } else {
      const created = addExpense(expense);
      targetExpenseId = created?.id;
      toast({ title: "Expense added", description: "Expense saved." });
    }

    if (targetExpenseId && files.length > 0) {
      try {
        if (isNewExpense) {
          await waitForExpensePersistence(targetExpenseId);
        }
        await ensureExpenseExistsInBackend(targetExpenseId, fallbackExpenseForEnsure);
        await uploadExpenseAttachments(targetExpenseId, files);
        updateExpense(targetExpenseId, { receiptAttached: true });
        toast({ title: "Receipts uploaded", description: `${files.length} attachment${files.length === 1 ? "" : "s"} saved.` });
      } catch (error) {
        toast({
          title: "Expense saved, but upload failed",
          description: error instanceof Error ? error.message : "You can retry from Edit Expense.",
          variant: "destructive",
        });
      }
    }

    setEditingExpense(null);
    setIsDialogOpen(false);
  };

  const handleArchiveExpenseAttachment = async (documentId: string) => {
    if (!editingExpense) {
      return;
    }

    try {
      await archiveTimeflowDocument(documentId);
      setExpenseDocuments((current) => ({
        ...current,
        [editingExpense.id]: (current[editingExpense.id] || []).filter((document) => document.id !== documentId),
      }));
      toast({ title: "Attachment archived", description: "The receipt is now archived." });
    } catch (error) {
      toast({
        title: "Failed to archive attachment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Expenses"
        subtitle="Track operating costs and see which pay period each expense belongs to."
        actions={
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setEditingExpense(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      {!normalizedPayPeriodStartDate ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">Set your pay period start date</p>
              <p className="text-sm text-amber-800">Expenses are being grouped with a default anchor until you save a pay period start date in settings.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/platform/settings">Open Settings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Current Pay Period Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(currentPeriodExpenseTotal)}</p>
            <p className="text-xs text-muted-foreground">{currentPayPeriod.label}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Filtered Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(filteredExpenseTotal)}</p>
            <p className="text-xs text-muted-foreground">{filteredExpenses.length} expense{filteredExpenses.length === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Previous Pay Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{previousPayPeriod.label}</p>
            <p className="text-xs text-muted-foreground">Quick filter available below</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search descriptions, client, project, or notes" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Client" />
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
            <Select value={payPeriodFilter} onValueChange={(value) => setPayPeriodFilter(value as PayPeriodFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Pay period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pay periods</SelectItem>
                <SelectItem value="current">Current pay period</SelectItem>
                <SelectItem value="previous">Previous pay period</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Expense Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredExpenses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Expense Date</th>
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Billed To</th>
                    <th className="px-4 py-3 text-left font-medium">Client / Project</th>
                    <th className="px-4 py-3 text-left font-medium">Pay Period</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => {
                    const clientName = clients.find((client) => client.id === expense.clientId)?.name;
                    const projectName = projects.find((project) => project.id === expense.projectId)?.name;
                    const period = getPayPeriodForDate(expense.date, payPeriodSettings);
                    const billedTarget = expense.billTo ?? (expense.projectId ? "project" : "client");

                    return (
                      <tr key={expense.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{formatDateDisplay(expense.date)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{expense.description}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {expense.notes ? <span>{expense.notes}</span> : null}
                            {(expenseDocuments[expense.id] || []).length > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {(expenseDocuments[expense.id] || []).length}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize">{expense.category}</td>
                        <td className="px-4 py-3 capitalize">{billedTarget}</td>
                        <td className="px-4 py-3 text-muted-foreground">{projectName ? `${projectName} · ${clientName ?? "No client"}` : clientName ?? "Unlinked"}</td>
                        <td className="px-4 py-3">{period.label}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(expense.amount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingExpense(expense); setIsDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteExpense(expense.id); toast({ title: "Expense deleted", description: "Expense removed from this workspace." }); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState icon={Receipt} title="No expenses yet" description="Add expenses to include them in pay period summaries and net earnings." />
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog
        attachments={editingExpense ? expenseDocuments[editingExpense.id] || [] : []}
        clients={clients}
        expense={editingExpense}
        onArchiveAttachment={handleArchiveExpenseAttachment}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingExpense(null);
          }
        }}
        onSubmit={handleSaveExpense}
        projects={projects}
      />
    </div>
  );
}