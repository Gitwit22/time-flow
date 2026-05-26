import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/store/appStore";

export default function AdminDashboard() {
  const currentUser = useAppStore((state) => state.currentUser);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back, {currentUser.name}. Use the quick actions below.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button asChild variant="outline">
            <Link to="/platform/time">Open Time Tracker</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/platform/expenses">Open Expenses</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/platform/invoices">Open Invoices</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/platform/projects">Open Projects</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/platform/clients">Open Clients</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/platform/settings">Open Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
