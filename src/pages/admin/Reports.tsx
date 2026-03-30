import { DollarSign, Clock, FileText, TrendingUp } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const weeklyHours = [
  { week: "W1", hours: 38 },
  { week: "W2", hours: 42 },
  { week: "W3", hours: 36 },
  { week: "W4", hours: 40 },
  { week: "W5", hours: 35 },
  { week: "W6", hours: 44 },
  { week: "W7", hours: 39 },
  { week: "W8", hours: 41 },
];

const monthlyEarnings = [
  { month: "Oct", earnings: 10500 },
  { month: "Nov", earnings: 11200 },
  { month: "Dec", earnings: 9800 },
  { month: "Jan", earnings: 12000 },
  { month: "Feb", earnings: 10800 },
  { month: "Mar", earnings: 9375 },
];

const invoiceStatus = [
  { name: "Paid", value: 8, color: "hsl(152, 60%, 40%)" },
  { name: "Sent", value: 2, color: "hsl(38, 92%, 50%)" },
  { name: "Draft", value: 1, color: "hsl(220, 9%, 46%)" },
];

export default function Reports() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Your earnings, hours, and billing overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="This Week" value="32.5h" icon={Clock} iconClassName="bg-accent/10 text-accent" />
        <SummaryCard title="This Month" value="62.5h" icon={Clock} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard title="Total Invoiced" value="$63,700" icon={FileText} iconClassName="bg-success/10 text-success" />
        <SummaryCard title="Unpaid Balance" value="$9,375" subtitle="1 invoice pending" icon={DollarSign} iconClassName="bg-warning/10 text-warning" />
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
                <Tooltip />
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
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
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
