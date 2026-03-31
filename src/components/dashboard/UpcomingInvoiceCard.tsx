import { ArrowRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildInvoiceDraftSummary } from "@/lib/billing";
import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import { GenerateInvoiceDialog } from "@/components/invoices/GenerateInvoiceDialog";

export function UpcomingInvoiceCard() {
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const invoices = useAppStore((state) => state.invoices);
  const invoiceDraftSummary = buildInvoiceDraftSummary(timeEntries, clients, currentUser, settings, invoices, new Date(), settings.defaultClientId);
  const [upcomingInvoice] = invoiceDraftSummary.previews;
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
            {invoiceDraftSummary.missingRateClientNames.length ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Set hourly rates for {invoiceDraftSummary.missingRateClientNames.join(", ")} to include all logged work in invoice previews.
              </p>
            ) : null}
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
        ) : invoiceDraftSummary.missingRateClientNames.length ? (
          <EmptyState
            icon={FileText}
            title="Set client rates to preview invoices"
            description={`No invoice preview can be generated until these clients have hourly rates: ${invoiceDraftSummary.missingRateClientNames.join(", ")}.`}
          />
        ) : (
          <EmptyState icon={FileText} title="No invoice preview yet" description={`No completed work has been logged for ${formatLongDate(new Date())} in the current billing period.`} />
        )}
      </CardContent>
    </Card>
  );
}
