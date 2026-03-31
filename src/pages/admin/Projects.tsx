import { BriefcaseBusiness, ChevronRight, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatHours, formatLongDate } from "@/lib/date";
import { getProjectCapHandlingLabel, getProjectDerivedMetrics, getProjectWarningMessage } from "@/lib/projects";
import { useAppStore } from "@/store/appStore";
import type { Project } from "@/types";

const statusStyles: Record<Project["status"], string> = {
  planning: "status-badge-muted",
  active: "status-badge-accent",
  on_hold: "status-badge-warning",
  completed: "status-badge-success",
  archived: "status-badge-muted",
};

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const invoices = useAppStore((state) => state.invoices);
  const addProject = useAppStore((state) => state.addProject);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const updateProject = useAppStore((state) => state.updateProject);
  const isReadonly = useAppStore((state) => state.currentUser.role === "client_viewer");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const rows = useMemo(
    () =>
      projects
        .map((project) => ({
          project,
          client: clients.find((client) => client.id === project.clientId),
          metrics: getProjectDerivedMetrics(project, timeEntries, invoices, clients, projects),
          warning: getProjectWarningMessage(project, getProjectDerivedMetrics(project, timeEntries, invoices, clients, projects)),
        }))
        .filter((row) => (statusFilter === "all" ? true : row.project.status === statusFilter))
        .sort((a, b) => a.project.name.localeCompare(b.project.name)),
    [clients, invoices, projects, statusFilter, timeEntries],
  );

  const handleSave = (value: Omit<Project, "id">) => {
    if (!value.name.trim()) {
      toast({ title: "Project name required", description: "Add a project name before saving.", variant: "destructive" });
      return;
    }

    if (!value.clientId) {
      toast({ title: "Linked client required", description: "Every project must be linked to a client.", variant: "destructive" });
      return;
    }

    if (value.hourlyRate <= 0) {
      toast({ title: "Hourly rate required", description: "Projects need an hourly rate to monitor billable value and cap usage.", variant: "destructive" });
      return;
    }

    if (value.maxPayoutCap <= 0) {
      toast({ title: "Project cap required", description: "Set a payout cap so the project can track remaining budget and hours.", variant: "destructive" });
      return;
    }

    if (editingProject) {
      updateProject(editingProject.id, value);
      toast({ title: "Project updated", description: `${value.name} was updated.` });
    } else {
      addProject(value);
      toast({ title: "Project created", description: `${value.name} was added to your project roster.` });
    }

    setEditingProject(null);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Projects"
        subtitle="Track scoped work, payout caps, documents, and budget health by project."
        actions={
          !isReadonly ? (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                setEditingProject(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          ) : undefined
        }
      />

      {isReadonly ? <div className="readonly-banner">Viewer mode: project changes are disabled.</div> : null}

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ project, client, metrics, warning }) => (
            <Card key={project.id} className="overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-lg font-semibold">{project.name}</h2>
                      <span className={statusStyles[project.status]}>{formatEnumLabel(project.status)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{client?.name ?? "Unknown client"}</p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{project.description}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/projects/${project.id}`}>
                      Open <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Billing type</p>
                    <p className="font-medium">{formatEnumLabel(project.billingType)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rate</p>
                    <p className="font-medium">{formatCurrency(project.hourlyRate)}/hr</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max hours</p>
                    <p className="font-medium">{formatHours(metrics.maxHours)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cap handling</p>
                    <p className="font-medium">{getProjectCapHandlingLabel(project.capHandling)}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Budget used</span>
                    <span>{metrics.percentUsed.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(metrics.percentUsed, 100)} className="h-2.5" />
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total billed</p>
                      <p className="font-medium">{formatCurrency(metrics.totalBilled)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining budget</p>
                      <p className="font-medium">{formatCurrency(metrics.remainingBudget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining hours</p>
                      <p className="font-medium">{formatHours(metrics.remainingHours)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Documents</p>
                      <p className="font-medium">{metrics.documentCount}</p>
                    </div>
                  </div>
                  {warning ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{metrics.timeEntryCount} time entries • {metrics.invoiceCount} linked invoices</span>
                  <span>{formatLongDate(project.startDate)}{project.endDate ? ` to ${formatLongDate(project.endDate)}` : " onward"}</span>
                </div>

                {!isReadonly ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingProject(project);
                        setDialogOpen(true);
                      }}
                    >
                      Edit project
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete project
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the project and its attached documents from TimeFlow. Existing linked time entries will be kept, but they will no longer point to this project.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              deleteProject(project.id);
                              toast({ title: "Project deleted", description: `${project.name} was removed.` });
                            }}
                          >
                            Delete project
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No projects yet" description="Create your first project to track scope, budget, documents, and project-linked time." />
      )}

      <ProjectDialog clients={clients} open={dialogOpen} project={editingProject} onOpenChange={setDialogOpen} onSubmit={handleSave} />
    </div>
  );
}
