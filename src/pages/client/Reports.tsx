import { BarChart3, Clock, DollarSign, FileText, Eye } from "lucide-react";
import { CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Bar, BarChart } from "recharts";

import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBillingSummary, getMonthlyEarnings } from "@/lib/billing";
import { getInvoiceStatusCounts, getPeriodHours, getWeeklyHours } from "@/lib/calculations";
import { formatCurrency, formatHours, getBillingPeriod } from "@/lib/date";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/appStore";
import { selectViewerScope } from "@/store/selectors";

const pieColors = {
  paid: "hsl(152, 60%, 40%)",
  issued: "hsl(38, 92%, 50%)",
  draft: "hsl(220, 9%, 46%)",
  overdue: "hsl(0, 74%, 42%)",
};
 
export default function ClientReports() {
  const currentUser = useAppStore((state) => state.currentUser);
  const { activeClient, clients, invoices, projects, timeEntries } = useAppStore(useShallow(selectViewerScope));
  const billingPeriod = getBillingPeriod(new Date(), currentUser.invoiceFrequency);
  const periodHours = getPeriodHours(timeEntries, billingPeriod.start, billingPeriod.end);
  const periodBilling = getBillingSummary(timeEntries, clients, projects, { start: billingPeriod.start, end: billingPeriod.end });
  const weeklyHours = getWeeklyHours(timeEntries);
  const monthlyEarnings = getMonthlyEarnings(timeEntries, clients, projects);
  const statusTotals = getInvoiceStatusCounts(invoices);

  const statusData = [
    { name: "Paid", value: statusTotals.paid, color: pieColors.paid },
    { name: "Issued", value: statusTotals.issued, color: pieColors.issued },
    { name: "Draft", value: statusTotals.draft, color: pieColors.draft },
    { name: "Overdue", value: statusTotals.overdue, color: pieColors.overdue },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">{activeClient ? `Read-only performance summaries for ${activeClient.name}.` : "Select a company to preview its reports."}</p>
      </div>

      <div className="readonly-banner">
        <Eye className="h-4 w-4 shrink-0" />
        <span>Viewer mode: report data is visible but cannot be modified.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Period Hours" value={formatHours(periodHours)} icon={Clock} iconClassName="bg-accent/10 text-accent" />
        <SummaryCard title="Period Earnings" value={formatCurrency(periodBilling.totalAmount)} subtitle={periodBilling.missingRateEntries.length ? `${periodBilling.missingRateEntries.length} entries missing rates` : "Based on rated client work"} icon={DollarSign} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard title="Invoices" value={String(invoices.length)} icon={FileText} iconClassName="bg-success/10 text-success" />
        <SummaryCard title="Overdue" value={String(statusTotals.overdue)} icon={BarChart3} iconClassName="bg-warning/10 text-warning" />
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
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="earnings" stroke="hsl(35, 92%, 52%)" strokeWidth={2} dot={{ fill: "hsl(35, 92%, 52%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Invoice Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {statusData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
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
