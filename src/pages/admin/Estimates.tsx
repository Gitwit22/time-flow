import {
  Copy,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  ArrowRightCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatLongDate } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import type { Estimate, EstimateStatus } from "@/types";

const STATUS_TABS: { value: EstimateStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
];

const STATUS_BADGE: Record<EstimateStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

function StatusBadge({ status }: { status: EstimateStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
      {label}
    </span>
  );
}

export default function EstimatesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const estimates = useAppStore((s) => s.estimates);
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const addEstimate = useAppStore((s) => s.addEstimate);
  const duplicateEstimate = useAppStore((s) => s.duplicateEstimate);
  const deleteEstimate = useAppStore((s) => s.deleteEstimate);
  const updateEstimate = useAppStore((s) => s.updateEstimate);

  const [statusFilter, setStatusFilter] = useState<EstimateStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { rows, statusCounts } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const counts: Partial<Record<EstimateStatus, number>> = {};

    const enriched = estimates.map((est) => {
      const isExpired =
        est.status !== "accepted" &&
        est.status !== "declined" &&
        est.expirationDate &&
        est.expirationDate < today;
      const displayStatus: EstimateStatus = isExpired ? "expired" : est.status;
      counts[displayStatus] = (counts[displayStatus] ?? 0) + 1;
      return {
        ...est,
        displayStatus,
        clientName: clients.find((c) => c.id === est.clientId)?.name ?? "Unknown",
        projectName: est.projectId
          ? (projects.find((p) => p.id === est.projectId)?.name ?? "")
          : "",
      };
    });

    const filtered = enriched
      .filter((r) => statusFilter === "all" || r.displayStatus === statusFilter)
      .filter((r) => clientFilter === "all" || r.clientId === clientFilter)
      .filter((r) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.estimateNumber.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.projectName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { rows: filtered, statusCounts: counts };
  }, [estimates, clients, projects, statusFilter, clientFilter, searchQuery]);

  function handleNew() {
    if (clients.length === 0) {
      toast({ title: "No clients found", description: "Add a client before creating an estimate." });
      return;
    }
    const draft = addEstimate({
      clientId: clients[0].id,
      status: "draft",
      groups: [],
      items: [],
      discount: 0,
      taxRate: 0,
      fees: 0,
    });
    navigate(`/platform/estimates/${draft.id}`);
  }

  function handleDuplicate(id: string) {
    const copy = duplicateEstimate(id);
    if (copy) {
      toast({ title: "Estimate duplicated", description: copy.estimateNumber });
    }
  }

  function handleDelete(id: string) {
    deleteEstimate(id);
    setDeleteTarget(null);
    toast({ title: "Estimate deleted" });
  }

  function handleConvertToProject(est: Estimate) {
    if (est.convertedProjectId || est.convertedAt) {
      toast({ title: "Already marked for conversion", description: "This estimate has already been flagged for project conversion." });
      return;
    }
    updateEstimate(est.id, { convertedAt: new Date().toISOString() });
    toast({ title: "Marked for conversion", description: `${est.estimateNumber} — link it to a project in the Projects page.` });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Estimates</h1>
          <p className="page-subtitle">Create, track, and convert estimates into projects.</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Estimate
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value as EstimateStatus | "all")}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
            {tab.value !== "all" && (statusCounts[tab.value as EstimateStatus] ?? 0) > 0 && (
              <span className="ml-1 text-xs opacity-70">
                {statusCounts[tab.value as EstimateStatus]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search estimates…"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No estimates yet"
          description="Create your first estimate to get started."
          action={
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              New Estimate
            </Button>
          }
        />
      ) : (
        <>
          {/* Table (hidden on mobile) */}
          <div className="hidden md:block rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Project</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono">
                      <Link to={`/platform/estimates/${row.id}`} className="text-accent hover:underline">
                        {row.estimateNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.projectName}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.displayStatus} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatLongDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.expirationDate ? formatLongDate(row.expirationDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <EstimateRowMenu
                        estimate={row}
                        onEdit={() => navigate(`/platform/estimates/${row.id}`)}
                        onDuplicate={() => handleDuplicate(row.id)}
                        onConvert={() => handleConvertToProject(row)}
                        onDelete={() => setDeleteTarget(row.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{row.clientName}</p>
                      {row.projectName && <p className="text-sm text-muted-foreground">{row.projectName}</p>}
                    </div>
                    <StatusBadge status={row.displayStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{formatCurrency(row.total)}</span>
                    <span className="text-xs text-muted-foreground font-mono">{row.estimateNumber}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/platform/estimates/${row.id}`}>
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(row.id)}>
                      <Copy className="mr-1 h-3 w-3" />
                      Duplicate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteTarget(row.id)}>
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EstimateRowMenu({
  estimate,
  onEdit,
  onDuplicate,
  onConvert,
  onDelete,
}: {
  estimate: Estimate;
  onEdit: () => void;
  onDuplicate: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <FileText className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onConvert} disabled={!!(estimate.convertedProjectId || estimate.convertedAt)}>
          <ArrowRightCircle className="mr-2 h-4 w-4" />
          Convert to Project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
