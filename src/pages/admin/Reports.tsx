import { Clock, DollarSign, FileText, TrendingUp } from "lucide-react";

import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { getBillingSummary, getMonthlyEarnings } from "@/lib/billing";
import { getInvoiceStatusCounts, getPeriodHours, getWeeklyHours } from "@/lib/calculations";
import { formatCurrency, formatHours } from "@/lib/date";
import { getCurrentPayPeriod, summarizePayPeriod } from "@/lib/payPeriods";
import { useAppStore } from "@/store/appStore";

const pieColors = {
  paid: "hsl(152, 60%, 40%)",
  issued: "hsl(38, 92%, 50%)",
  partiallyPaid: "hsl(208, 84%, 44%)",
  draft: "hsl(220, 9%, 46%)",
  overdue: "hsl(0, 74%, 42%)",
  void: "hsl(220, 8%, 60%)",
};

export default function Reports() {
  const timeEntries = useAppStore((state) => state.timeEntries);
  const invoices = useAppStore((state) => state.invoices);
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const expenses = useAppStore((state) => state.expenses);
  const projectBills = useAppStore((state) => state.projectBills);
  const billingPeriod = getCurrentPayPeriod(
    {
      payPeriodFrequency: settings.payPeriodFrequency ?? settings.invoiceFrequency ?? currentUser.invoiceFrequency,
      payPeriodStartDate: settings.payPeriodStartDate,
      periodWeekStartsOn: settings.periodWeekStartsOn,
    },
    new Date(),
  );
  const periodHours = getPeriodHours(timeEntries, billingPeriod.startDate, billingPeriod.endDate);
  const periodBilling = getBillingSummary(timeEntries, clients, projects, { start: billingPeriod.startDate, end: billingPeriod.endDate });
  const payPeriodSummary = summarizePayPeriod({
    entries: periodBilling.lines.map((line) => ({ amount: line.amount, date: line.entry.date, durationHours: line.entry.durationHours })),
    expenses,
    invoices,
    period: billingPeriod,
  });
  const weeklyHours = getWeeklyHours(timeEntries);
  const thisWeekHours = weeklyHours[weeklyHours.length - 1]?.hours ?? 0;
  const monthlyEarnings = getMonthlyEarnings(timeEntries, clients, projects, projectBills);
  const statusTotals = getInvoiceStatusCounts(invoices);
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "void" && invoice.status !== "revised");
  const totalInvoiced = activeInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const unpaidInvoices = activeInvoices.filter((invoice) => invoice.status !== "paid");
  const unpaidBalance = unpaidInvoices.reduce((sum, invoice) => sum + (invoice.balanceDue ?? invoice.totalAmount), 0);
  const nonVoidProjectBills = projectBills.filter((bill) => bill.status !== "void");
  const paidProjectBillRevenue = nonVoidProjectBills.filter((bill) => bill.status === "paid").reduce((sum, bill) => sum + bill.amount, 0);
  const unpaidProjectBillRevenue = nonVoidProjectBills.filter((bill) => bill.status !== "paid").reduce((sum, bill) => sum + bill.amount, 0);
  const fixedProjectBillRevenue = nonVoidProjectBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalRevenue = totalInvoiced + fixedProjectBillRevenue;
  const paidRevenue = activeInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.totalAmount, 0) + paidProjectBillRevenue;
  const outstandingRevenue = unpaidBalance + unpaidProjectBillRevenue;
  const isReadonly = currentUser.role === "client_viewer";

  const invoiceStatus = [
    { name: "Paid", value: statusTotals.paid, color: pieColors.paid },
    { name: "Sent", value: statusTotals.issued, color: pieColors.issued },
    { name: "Partially Paid", value: statusTotals.partiallyPaid, color: pieColors.partiallyPaid },
    { name: "Draft", value: statusTotals.draft, color: pieColors.draft },
    { name: "Overdue", value: statusTotals.overdue, color: pieColors.overdue },
    { name: "Void", value: statusTotals.void, color: pieColors.void },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Your earnings, hours, and billing overview.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Current Pay Period Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross Time</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(payPeriodSummary.timeEarnings)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fixed Bills</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(fixedProjectBillRevenue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(payPeriodSummary.expenseTotal)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(payPeriodSummary.netAmount + fixedProjectBillRevenue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoices in Period</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(payPeriodSummary.invoiceTotal)}</p>
          </div>
        </CardContent>
      </Card>

      {isReadonly ? <div className="readonly-banner">Viewer mode: report data is visible but cannot be modified.</div> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="This Week" value={formatHours(thisWeekHours)} icon={Clock} iconClassName="bg-accent/10 text-accent" />
        <SummaryCard title="Current Period" value={formatHours(periodHours)} subtitle={periodBilling.missingRateEntries.length ? `${periodBilling.missingRateEntries.length} entries missing rates` : "All rated work included"} icon={Clock} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard title="Total Revenue" value={formatCurrency(totalRevenue)} subtitle={`Paid ${formatCurrency(paidRevenue)}`} icon={FileText} iconClassName="bg-success/10 text-success" />
        <SummaryCard
          title="Outstanding Revenue"
          value={formatCurrency(outstandingRevenue)}
          subtitle={`${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? "" : "s"} + ${nonVoidProjectBills.filter((bill) => bill.status !== "paid").length} fixed bill${nonVoidProjectBills.filter((bill) => bill.status !== "paid").length === 1 ? "" : "s"}`}
          icon={DollarSign}
          iconClassName="bg-warning/10 text-warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Hours by Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatHours(value)} />
                <Bar dataKey="hours" fill="hsl(222, 47%, 11%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Earnings by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyEarnings}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="earnings" stroke="hsl(35, 92%, 52%)" strokeWidth={2} dot={{ fill: "hsl(35, 92%, 52%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Invoices by Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={invoiceStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {invoiceStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
