import { ChangeEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  buildExportPayload,
  downloadExportFile,
  executeImport,
  previewImport,
  readImportFile,
  type ConflictStrategy,
  type ImportPreview,
  type ImportResult,
  type TimeFlowExport,
} from "@/lib/dataTransfer";
import { useAppStore } from "@/store/appStore";

// ── Export Section ────────────────────────────────────────────────────────────

function ExportSection() {
  const { toast } = useToast();
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const timeEntries = useAppStore((s) => s.timeEntries);

  const [scope, setScope] = useState<"all" | "client" | "project" | "daterange">("all");
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  function handleExport() {
    const options = {
      clientId: scope === "client" ? clientId : undefined,
      projectId: scope === "project" ? projectId : undefined,
      dateFrom: scope === "daterange" ? dateFrom : undefined,
      dateTo: scope === "daterange" ? dateTo : undefined,
    };

    const payload = buildExportPayload(clients, projects, timeEntries, options);

    if (payload.customers.length === 0 && payload.projects.length === 0 && payload.timeEntries.length === 0) {
      toast({ title: "Nothing to export", description: "No data matched the current filter.", variant: "destructive" });
      return;
    }

    downloadExportFile(payload);
    toast({
      title: "Export started",
      description: `Exporting ${payload.customers.length} customer(s), ${payload.projects.length} project(s), ${payload.timeEntries.length} time ${payload.timeEntries.length === 1 ? "entry" : "entries"}.`,
    });
  }

  const scopeProjectList = scope === "client" && clientId
    ? projects.filter((p) => p.clientId === clientId)
    : projects;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">Export Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download your TimeFlow data as a portable JSON file. You can import this file into another TimeFlow instance.
        </p>

        <div className="space-y-1.5">
          <Label className="text-xs">Export scope</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All data</SelectItem>
              <SelectItem value="client">Single customer</SelectItem>
              <SelectItem value="project">Single project</SelectItem>
              <SelectItem value="daterange">Date range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope === "client" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {scope === "project" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {scopeProjectList.map((p) => {
                  const client = clients.find((c) => c.id === p.clientId);
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{client ? ` — ${client.name}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {scope === "daterange" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">From date</Label>
              <Input type="date" value={dateFrom} onChange={(e: ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To date</Label>
              <Input type="date" value={dateTo} onChange={(e: ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} />
            </div>
          </div>
        )}

        <Button
          size="sm"
          onClick={handleExport}
          disabled={
            (scope === "client" && !clientId) ||
            (scope === "project" && !projectId)
          }
        >
          Export JSON
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Import Section ────────────────────────────────────────────────────────────

type ImportStep = "upload" | "preview" | "done";

function ImportSection() {
  const { toast } = useToast();
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const timeEntries = useAppStore((s) => s.timeEntries);
  const addClient = useAppStore((s) => s.addClient);
  const updateClient = useAppStore((s) => s.updateClient);
  const addProject = useAppStore((s) => s.addProject);
  const updateProject = useAppStore((s) => s.updateProject);
  const addTimeEntry = useAppStore((s) => s.addTimeEntry);
  const updateTimeEntry = useAppStore((s) => s.updateTimeEntry);
  const getState = useAppStore.getState;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [strategy, setStrategy] = useState<ConflictStrategy>("skip");
  const [payload, setPayload] = useState<TimeFlowExport | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const parsed = await readImportFile(file);
    setLoading(false);

    if (!parsed.ok) {
      toast({ title: "Invalid file", description: parsed.error, variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPayload(parsed.payload);
    const pv = previewImport(parsed.payload, clients, projects, timeEntries, strategy);
    setPreview(pv);
    setStep("preview");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleStrategyChange(newStrategy: ConflictStrategy) {
    setStrategy(newStrategy);
    if (payload) {
      setPreview(previewImport(payload, clients, projects, timeEntries, newStrategy));
    }
  }

  function handleConfirmImport() {
    if (!preview) return;

    const actions = {
      addClient,
      updateClient,
      addProject,
      updateProject,
      addTimeEntry,
      updateTimeEntry,
      getClients: () => getState().clients,
      getProjects: () => getState().projects,
    };

    const importResult = executeImport(preview, strategy, actions);
    setResult(importResult);
    setStep("done");

    const total = importResult.customersImported + importResult.projectsImported + importResult.entriesImported;
    if (importResult.failed > 0) {
      toast({ title: "Import completed with errors", description: `${total} items imported, ${importResult.failed} failed.`, variant: "destructive" });
    } else {
      toast({ title: "Import complete", description: `${total} items imported successfully.` });
    }
  }

  function handleReset() {
    setStep("upload");
    setPayload(null);
    setPreview(null);
    setResult(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">Import Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a TimeFlow JSON export file to bring data into this instance. A preview is shown before anything is saved.
        </p>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Conflict strategy</Label>
              <Select value={strategy} onValueChange={(v) => handleStrategyChange(v as ConflictStrategy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip duplicates (safe)</SelectItem>
                  <SelectItem value="merge">Merge — update existing records</SelectItem>
                  <SelectItem value="create_new">Always create new records</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {strategy === "skip" && "Customers/projects already in this instance will be left unchanged. Only new ones are imported."}
                {strategy === "merge" && "Matching customers/projects will have their fields updated from the import file."}
                {strategy === "create_new" && "All records are imported as brand-new items, even if a match exists. Relationships are preserved within the file."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Upload file</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFileChange(e)}
                disabled={loading}
              />
            </div>

            {loading && <p className="text-sm text-muted-foreground">Reading file…</p>}
          </div>
        )}

        {step === "preview" && preview && payload && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="text-sm font-medium">Import Preview</h3>
              <p className="text-xs text-muted-foreground">
                Exported on {new Date(payload.exportedAt).toLocaleString()} · strategy: <span className="font-medium">{strategy}</span>
              </p>

              <div className="grid grid-cols-3 gap-3">
                <PreviewColumn
                  label="Customers"
                  toCreate={preview.customersToCreate.length}
                  toUpdate={preview.customersToUpdate.length}
                  toSkip={preview.customersToSkip.length}
                  total={preview.totalCustomers}
                />
                <PreviewColumn
                  label="Projects"
                  toCreate={preview.projectsToCreate.length}
                  toUpdate={preview.projectsToUpdate.length}
                  toSkip={preview.projectsToSkip.length}
                  total={preview.totalProjects}
                />
                <PreviewColumn
                  label="Time entries"
                  toCreate={preview.entriesToCreate.length}
                  toUpdate={0}
                  toSkip={preview.entriesToSkip.length}
                  total={preview.totalEntries}
                />
              </div>

              {preview.conflicts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-amber-700">{preview.conflicts.length} conflict(s) detected</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {preview.conflicts.map((conflict, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {conflict.type} "{conflict.sourceName}" matches existing "{conflict.existingName}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleConfirmImport}>
                Confirm Import
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="text-sm font-medium">Import Summary</h3>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <SummaryRow label="Customers imported" value={result.customersImported} />
                <SummaryRow label="Customers updated" value={result.customersUpdated} />
                <SummaryRow label="Customers skipped" value={result.customersSkipped} />
                <SummaryRow label="Projects imported" value={result.projectsImported} />
                <SummaryRow label="Projects updated" value={result.projectsUpdated} />
                <SummaryRow label="Projects skipped" value={result.projectsSkipped} />
                <SummaryRow label="Time entries imported" value={result.entriesImported} />
                <SummaryRow label="Time entries skipped" value={result.entriesSkipped} />
                {result.failed > 0 && <SummaryRow label="Failed" value={result.failed} error />}
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Errors</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-destructive">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button size="sm" variant="outline" onClick={handleReset}>
              Import another file
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewColumn({ label, toCreate, toUpdate, toSkip, total }: { label: string; toCreate: number; toUpdate: number; toSkip: number; total: number }) {
  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">Total in file: {total}</p>
      {toCreate > 0 && <Badge variant="default" className="text-xs">{toCreate} new</Badge>}
      {toUpdate > 0 && <Badge variant="secondary" className="text-xs">{toUpdate} update</Badge>}
      {toSkip > 0 && <Badge variant="outline" className="text-xs">{toSkip} skip</Badge>}
    </div>
  );
}

function SummaryRow({ label, value, error }: { label: string; value: number; error?: boolean }) {
  return (
    <>
      <span className={error ? "text-destructive" : "text-muted-foreground"}>{label}</span>
      <span className={`font-medium ${error ? "text-destructive" : ""}`}>{value}</span>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DataTransferPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">Data Transfer</h1>
        <p className="page-subtitle">Export your data to a portable file or import data from another TimeFlow instance.</p>
      </div>

      <ExportSection />
      <ImportSection />
    </div>
  );
}
