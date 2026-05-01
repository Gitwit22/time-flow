import { Copy, Download, ExternalLink, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { downloadInvoiceExport } from "@/lib/export";
import { buildInvoiceEmailDraft, getInvoiceDisplayStatus } from "@/lib/invoice";
import { formatCurrency, formatPeriodLabel } from "@/lib/date";
import { useAppStore } from "@/store/appStore";

export default function EmailPrep() {
  const { toast } = useToast();
  const isReadonly = useAppStore((state) => state.currentUser.role === "client_viewer");
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const invoices = useAppStore((state) => state.invoices);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const expenses = useAppStore((state) => state.expenses);
  const emailDrafts = useAppStore((state) => state.emailDrafts);
  const saveEmailDraft = useAppStore((state) => state.saveEmailDraft);
  const markEmailDraftReady = useAppStore((state) => state.markEmailDraftReady);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [toValue, setToValue] = useState("");
  const [ccValue, setCcValue] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const invoiceOptions = useMemo(
    () =>
      [...invoices]
        .map((invoice) => ({
          ...invoice,
          clientName: clients.find((client) => client.id === invoice.clientId)?.name ?? "Unknown client",
          status: getInvoiceDisplayStatus(invoice),
        }))
        .sort((a, b) => (a.id < b.id ? 1 : -1)),
    [clients, invoices],
  );

  const selectedInvoice = invoiceOptions.find((invoice) => invoice.id === selectedInvoiceId);
  const selectedClient = clients.find((client) => client.id === selectedInvoice?.clientId);

  useEffect(() => {
    if (selectedInvoiceId || !invoiceOptions.length) {
      return;
    }

    setSelectedInvoiceId(invoiceOptions[0].id);
  }, [invoiceOptions, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedInvoice) {
      setToValue("");
      setCcValue("");
      setSubject("");
      setBody("");
      return;
    }

    const existing = emailDrafts[selectedInvoice.id];
    const draft = existing ?? buildInvoiceEmailDraft(selectedInvoice, selectedClient, currentUser, settings);

    setToValue(selectedClient?.contactEmail ?? "");
    setCcValue("");
    setSubject(draft.subject);
    setBody(draft.body);
  }, [currentUser, emailDrafts, selectedClient, selectedInvoice, settings]);

  if (!invoiceOptions.length) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="page-header">
          <h1 className="page-title">Email Prep</h1>
          <p className="page-subtitle">Prepare invoice emails once invoices are generated.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={Send} title="No invoices available" description="Generate an invoice first, then return here to prepare and send the email." />
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedDraft = selectedInvoice ? emailDrafts[selectedInvoice.id] : undefined;
  const attachmentName = selectedInvoice ? `${selectedInvoice.id}.pdf` : "invoice.pdf";
  const mailtoHref = selectedInvoice
    ? `mailto:${encodeURIComponent(toValue)}?cc=${encodeURIComponent(ccValue)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "#";

  const persistDraft = () => {
    if (!selectedInvoice || isReadonly) {
      return;
    }

    saveEmailDraft({
      invoiceId: selectedInvoice.id,
      subject,
      body,
      readyToSend: selectedDraft?.readyToSend ?? false,
    });
    toast({ title: "Draft saved", description: `Email draft saved for ${selectedInvoice.id}.` });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Email Prep</h1>
        <p className="page-subtitle">Prepare and send invoices via email.</p>
      </div>

      {isReadonly ? <div className="readonly-banner">Viewer mode: editing and send-ready actions are disabled.</div> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Select Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose an invoice" />
            </SelectTrigger>
            <SelectContent>
              {invoiceOptions.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.id} • {invoice.clientName} • {formatCurrency(invoice.totalAmount)} • {invoice.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Composition */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Compose Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input value={toValue} onChange={(event) => setToValue(event.target.value)} disabled={isReadonly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CC</Label>
              <Input value={ccValue} onChange={(event) => setCcValue(event.target.value)} placeholder="Optional CC addresses..." disabled={isReadonly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={isReadonly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea className="min-h-[200px] resize-none" value={body} onChange={(event) => setBody(event.target.value)} disabled={isReadonly} />
            </div>
            <div className="flex gap-2">
              <Button onClick={persistDraft} disabled={isReadonly || !selectedInvoice}>
                Save Draft
              </Button>
              <Button
                variant="outline"
                disabled={isReadonly || !selectedInvoice}
                onClick={() => {
                  if (!selectedInvoice) {
                    return;
                  }

                  saveEmailDraft({
                    invoiceId: selectedInvoice.id,
                    subject,
                    body,
                    readyToSend: selectedDraft?.readyToSend ?? false,
                  });
                  markEmailDraftReady(selectedInvoice.id, !(selectedDraft?.readyToSend ?? false));
                }}
              >
                {selectedDraft?.readyToSend ? "Mark Not Ready" : "Mark Ready to Send"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attachment & Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Attachment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <span className="text-xs font-bold">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachmentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedInvoice ? `${formatPeriodLabel(selectedInvoice.periodStart, selectedInvoice.periodEnd)} • ${formatCurrency(selectedInvoice.totalAmount)}` : "Invoice attachment"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={async () => {
                  await navigator.clipboard.writeText(`To: ${toValue}\nCC: ${ccValue}\nSubject: ${subject}\n\n${body}`);
                  toast({ title: "Copied", description: "Email content copied to clipboard." });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Email
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!selectedInvoice) {
                    return;
                  }

                  const entries = timeEntries.filter((entry) => selectedInvoice.entryIds.includes(entry.id));
                  const opened = downloadInvoiceExport({
                    invoice: selectedInvoice,
                    entries,
                    expenses,
                    client: selectedClient,
                    currentUser,
                    projects,
                    settings,
                  });
                  toast({
                    title: opened ? "Invoice opened for download" : "Popup blocked",
                    description: opened ? `${selectedInvoice.id} opened in a printable invoice view.` : "Allow popups for this site, then try download again.",
                    variant: opened ? undefined : "destructive",
                  });
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Invoice
              </Button>
              <Separator className="my-2" />
              <Button variant="outline" className="w-full" asChild>
                <a href={mailtoHref}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Gmail
                </a>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <a href={mailtoHref}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Outlook
                </a>
              </Button>
              <Separator className="my-2" />
              <Button
                className="w-full"
                disabled={isReadonly || !selectedInvoice}
                onClick={() => {
                  if (!selectedInvoice) {
                    return;
                  }

                  saveEmailDraft({
                    invoiceId: selectedInvoice.id,
                    subject,
                    body,
                    readyToSend: true,
                  });
                  markEmailDraftReady(selectedInvoice.id, true);
                  toast({ title: "Ready to send", description: `${selectedInvoice.id} marked ready for sending.` });
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Mark Ready
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
