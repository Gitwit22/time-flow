import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, FileText, FolderOpen, Save, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { DocumentManager } from "@/components/shared/DocumentManager";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatHours, formatLongDate, formatPeriodLabel } from "@/lib/date";
import { getProjectCapHandlingLabel, getProjectDerivedMetrics, getProjectWarningMessage } from "@/lib/projects";
import { useAppStore } from "@/store/appStore";

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function ProjectDetailPage() {
  const { toast } = useToast();
  const { id } = useParams();
  const currentUser = useAppStore((state) => state.currentUser);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const invoices = useAppStore((state) => state.invoices);
  const addProjectDocument = useAppStore((state) => state.addProjectDocument);
  const updateProjectDocument = useAppStore((state) => state.updateProjectDocument);
  const updateProject = useAppStore((state) => state.updateProject);
  const isReadonly = useAppStore((state) => state.currentUser.role === "client_viewer");

  const project = projects.find((item) => item.id === id);
  const [noteDraft, setNoteDraft] = useState(project?.notes ?? "");

  const client = useMemo(() => clients.find((item) => item.id === project?.clientId), [clients, project?.clientId]);
  const projectEntries = useMemo(
    () => [...timeEntries].filter((entry) => entry.projectId === project?.id).sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [project?.id, timeEntries],
  );
  const projectInvoices = useMemo(() => invoices.filter((invoice) => invoice.projectIds.includes(project?.id ?? "")), [invoices, project?.id]);
  const metrics = useMemo(
    () => (project ? getProjectDerivedMetrics(project, timeEntries, invoices, clients, projects) : null),
    [clients, invoices, project, projects, timeEntries],
  );
  const warningMessage = project && metrics ? getProjectWarningMessage(project, metrics) : null;

  useEffect(() => {
    setNoteDraft(project?.notes ?? "");
  }, [project?.id, project?.notes]);

  if (!project || !metrics) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8">
            <EmptyState icon={FolderOpen} title="Project not found" description="The requested project could not be located in your current data." />
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
          <div className="mt-3">
            <h1 className="page-title">{project.name}</h1>
            <p className="page-subtitle">{client?.name ?? "Unknown client"} • {formatEnumLabel(project.billingType)} • {formatEnumLabel(project.status)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">Cap used</p>
          <p className="font-heading text-2xl font-bold">{metrics.percentUsed.toFixed(1)}%</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(metrics.totalBilled)} of {formatCurrency(project.maxPayoutCap)}</p>
        </div>
      </div>

      {warningMessage ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="time">Time Entries</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Linked client</p>
                <p className="font-medium">{client?.name ?? "Unknown client"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hourly rate</p>
                <p className="font-medium">{formatCurrency(project.hourlyRate)}/hr</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max payout cap</p>
                <p className="font-medium">{formatCurrency(project.maxPayoutCap)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Derived max hours</p>
                <p className="font-medium">{formatHours(metrics.maxHours)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start date</p>
                <p className="font-medium">{formatLongDate(project.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End date</p>
                <p className="font-medium">{project.endDate ? formatLongDate(project.endDate) : "Open-ended"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cap handling</p>
                <p className="font-medium">{getProjectCapHandlingLabel(project.capHandling)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project status</p>
                <p className="font-medium">{formatEnumLabel(project.status)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading">Scope Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{project.description || "No project description provided yet."}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading">Project Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total billed</span><span className="font-medium">{formatCurrency(metrics.totalBilled)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Remaining budget</span><span className="font-medium">{formatCurrency(metrics.remainingBudget)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Remaining hours</span><span className="font-medium">{formatHours(metrics.remainingHours)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time entries</span><span className="font-medium">{metrics.timeEntryCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Invoices</span><span className="font-medium">{metrics.invoiceCount}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Project Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {projectEntries.length ? (
                <div className="space-y-3">
                  {projectEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{entry.notes || "Tracked work"}</p>
                          <p className="text-sm text-muted-foreground">{formatLongDate(entry.date)} • {entry.startTime} - {entry.endTime ?? "--"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatHours(entry.durationHours)}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(entry.billingRate ?? project.hourlyRate)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText} title="No project-linked entries yet" description="Link time entries to this project from the Time Tracker to build its history and budget usage." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Budget usage</p>
                  <p className="text-sm text-muted-foreground">Threshold warnings activate at 50%, 75%, 90%, and 100% of the payout cap.</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl font-bold">{metrics.percentUsed.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(metrics.totalBilled)} billed</p>
                </div>
              </div>
              <Progress value={Math.min(metrics.percentUsed, 100)} className="h-3" />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Total billed so far</p>
                  <p className="mt-1 font-heading text-2xl font-bold">{formatCurrency(metrics.totalBilled)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Remaining budget</p>
                  <p className="mt-1 font-heading text-2xl font-bold">{formatCurrency(metrics.remainingBudget)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Remaining hours</p>
                  <p className="mt-1 font-heading text-2xl font-bold">{formatHours(metrics.remainingHours)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Attach Project Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocumentManager
                contextLabel="project"
                currentUserName={currentUser.name}
                documents={project.documents}
                readOnly={isReadonly}
                onAdd={(document) => addProjectDocument(project.id, document)}
                onUpdate={(documentId, updates) => updateProjectDocument(project.id, documentId, updates)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Linked Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {projectInvoices.length ? (
                <div className="space-y-3">
                  {projectInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                      <div>
                        <p className="font-medium">{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">{formatPeriodLabel(invoice.periodStart, invoice.periodEnd)} • {invoice.status}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-medium">{formatCurrency(invoice.totalAmount)}</p>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/admin/invoices/${invoice.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View invoice
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText} title="No invoices linked yet" description="Invoices will appear here once project-linked time entries are included in a billing run." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Project Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea className="min-h-40 resize-none" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} disabled={isReadonly} />
              {!isReadonly ? (
                <Button
                  onClick={() => {
                    updateProject(project.id, { notes: noteDraft });
                    toast({ title: "Notes saved", description: `${project.name} notes were updated.` });
                  }}
                >
                  <Save className="mr-2 h-4 w-4" /> Save Notes
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
