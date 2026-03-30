import { ArrowRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import { getUpcomingInvoice } from "@/lib/calculations";
import { useAppStore } from "@/store/appStore";
import { GenerateInvoiceDialog } from "@/components/invoices/GenerateInvoiceDialog";

export function UpcomingInvoiceCard() {
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const invoices = useAppStore((state) => state.invoices);
  const upcomingInvoice = getUpcomingInvoice(timeEntries, currentUser, settings, clients, invoices);
  const isReadonly = currentUser.role === "client_viewer";

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Upcoming Invoice</CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link to={currentUser.role === "client_viewer" ? "/client/invoices" : "/admin/invoices"}>
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {upcomingInvoice ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="text-sm font-medium">{upcomingInvoice.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Period</p>
                <p className="text-sm font-medium">{formatPeriodLabel(upcomingInvoice.periodStart, upcomingInvoice.periodEnd)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours so far</p>
                <p className="text-sm font-medium">{formatHours(upcomingInvoice.totalHours)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. amount</p>
                <p className="text-sm font-medium">{formatCurrency(upcomingInvoice.totalAmount)}</p>
              </div>
            </div>
            {!isReadonly ? (
              <GenerateInvoiceDialog
                trigger={
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Invoice
                  </Button>
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">Invoice generation is limited to contractor mode.</p>
            )}
          </>
        ) : (
          <EmptyState icon={FileText} title="No invoice preview yet" description={`No completed work has been logged for ${formatLongDate(new Date())} in the current billing period.`} />
        )}
      </CardContent>
    </Card>
  );
}
