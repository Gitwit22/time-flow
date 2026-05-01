import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateDisplay } from "@/lib/date";
import { getCurrentPayPeriod, getExpensesForPayPeriod, getPayPeriodForDate, getPreviousPayPeriod } from "@/lib/payPeriods";
import { useAppStore } from "@/store/appStore";
import type { Expense } from "@/types";

type PayPeriodFilter = "all" | "current" | "previous";

export default function ExpensesPage() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const expenses = useAppStore((state) => state.expenses);
  const addExpense = useAppStore((state) => state.addExpense);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);

  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [payPeriodFilter, setPayPeriodFilter] = useState<PayPeriodFilter>("current");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const payPeriodSettings = {
    payPeriodFrequency: settings.payPeriodFrequency ?? settings.invoiceFrequency ?? currentUser.invoiceFrequency,
    payPeriodStartDate: settings.payPeriodStartDate,
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

        return [expense.description, expense.notes, clientName, projectName, expense.category].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [clientFilter, clients, expenses, projects, searchQuery, selectedPeriod]);

  const currentPeriodExpenseTotal = useMemo(
    () => getExpensesForPayPeriod(expenses, currentPayPeriod).reduce((sum, expense) => sum + expense.amount, 0),
    [currentPayPeriod, expenses],
  );
  const filteredExpenseTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleSaveExpense = (expense: Omit<Expense, "id">) => {
    if (editingExpense) {
      updateExpense(editingExpense.id, expense);
      toast({ title: "Expense updated", description: "Expense changes were saved." });
    } else {
      addExpense(expense);
      toast({ title: "Expense added", description: "Expense saved to this workspace." });
    }

    setEditingExpense(null);
    setIsDialogOpen(false);
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

      {!settings.payPeriodStartDate ? (
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

                    return (
                      <tr key={expense.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{formatDateDisplay(expense.date)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{expense.description}</p>
                          {expense.notes ? <p className="text-xs text-muted-foreground">{expense.notes}</p> : null}
                        </td>
                        <td className="px-4 py-3 capitalize">{expense.category}</td>
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

      <ExpenseDialog clients={clients} expense={editingExpense} open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingExpense(null); } }} onSubmit={handleSaveExpense} projects={projects} />
    </div>
  );
}