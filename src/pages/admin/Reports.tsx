import { Clock, DollarSign, FileText, TrendingUp } from "lucide-react";

import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { getBillingSummary, getMonthlyEarnings } from "@/lib/billing";
import { getInvoiceStatusCounts, getPeriodHours, getWeeklyHours } from "@/lib/calculations";
import { formatCurrency, formatHours, getBillingPeriod } from "@/lib/date";
import { useAppStore } from "@/store/appStore";

const pieColors = {
  paid: "hsl(152, 60%, 40%)",
  issued: "hsl(38, 92%, 50%)",
  draft: "hsl(220, 9%, 46%)",
  overdue: "hsl(0, 74%, 42%)",
};

export default function Reports() {
  const timeEntries = useAppStore((state) => state.timeEntries);
  const invoices = useAppStore((state) => state.invoices);
  const currentUser = useAppStore((state) => state.currentUser);
  const clients = useAppStore((state) => state.clients);
  const billingPeriod = getBillingPeriod(new Date(), currentUser.invoiceFrequency);
  const periodHours = getPeriodHours(timeEntries, billingPeriod.start, billingPeriod.end);
  const periodBilling = getBillingSummary(timeEntries, clients, { start: billingPeriod.start, end: billingPeriod.end });
  const weeklyHours = getWeeklyHours(timeEntries);
  const thisWeekHours = weeklyHours[weeklyHours.length - 1]?.hours ?? 0;
  const monthlyEarnings = getMonthlyEarnings(timeEntries, clients);
  const statusTotals = getInvoiceStatusCounts(invoices);
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "paid");
  const unpaidBalance = unpaidInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const isReadonly = currentUser.role === "client_viewer";

  const invoiceStatus = [
    { name: "Paid", value: statusTotals.paid, color: pieColors.paid },
    { name: "Issued", value: statusTotals.issued, color: pieColors.issued },
    { name: "Draft", value: statusTotals.draft, color: pieColors.draft },
    { name: "Overdue", value: statusTotals.overdue, color: pieColors.overdue },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Your earnings, hours, and billing overview.</p>
      </div>

      {isReadonly ? <div className="readonly-banner">Viewer mode: report data is visible but cannot be modified.</div> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="This Week" value={formatHours(thisWeekHours)} icon={Clock} iconClassName="bg-accent/10 text-accent" />
        <SummaryCard title="Current Period" value={formatHours(periodHours)} subtitle={periodBilling.missingRateEntries.length ? `${periodBilling.missingRateEntries.length} entries missing rates` : "All rated work included"} icon={Clock} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard title="Total Invoiced" value={formatCurrency(totalInvoiced)} icon={FileText} iconClassName="bg-success/10 text-success" />
        <SummaryCard
          title="Unpaid Balance"
          value={formatCurrency(unpaidBalance)}
          subtitle={`${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? "" : "s"} pending`}
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
