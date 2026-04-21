/**
 * WorkspaceMigrationWizard — 5-step guided copy wizard.
 *
 * Steps:
 *  1. Choose source workspace
 *  2. Configure new workspace (name + type)
 *  3. Select data types to copy (checkboxes)
 *  4. Review and confirm
 *  5. Result (success / error)
 *
 * Key invariants reinforced throughout:
 *  - This is a COPY operation — the source workspace is never modified.
 *  - All copied records get new IDs in the new workspace.
 *  - Archive / delete are separate manual actions.
 *
 * [WORKSPACE-BRANCH] company UI: step 2 will gain additional company-specific
 *   settings (team name, initial members) once the team UI is introduced.
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, XCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/appStore";
import { WorkspaceTypeBadge } from "./WorkspaceTypeBadge";
import { ALL_MIGRATABLE_DATA_TYPES, type WorkspaceMigrableDataType, type WorkspaceType } from "@/types/workspace";

// ─── Data-type metadata ───────────────────────────────────────────────────────

interface DataTypeConfig {
  label: string;
  description: string;
  defaultChecked: boolean;
  sensitiveNote?: string;
}

const DATA_TYPE_CONFIG: Record<WorkspaceMigrableDataType, DataTypeConfig> = {
  clients: {
    label: "Clients",
    description: "Client records and contact information.",
    defaultChecked: true,
  },
  projects: {
    label: "Projects",
    description: "Projects and billing configurations. Requires Clients to be included.",
    defaultChecked: true,
  },
  budgets: {
    label: "Budgets",
    description: "Budget limits and payout cap settings.",
    defaultChecked: true,
  },
  billing_rates: {
    label: "Billing Rates / Settings",
    description: "Hourly rates and billing defaults.",
    defaultChecked: true,
  },
  categories: {
    label: "Categories & Tags",
    description: "Time entry categories and labels.",
    defaultChecked: false,
  },
  invoice_templates: {
    label: "Invoice Templates / Settings",
    description: "Invoice notes and defaults. These apply to new invoices only in the new workspace.",
    defaultChecked: false,
    sensitiveNote: "Invoice templates are copied as settings only — no paid invoices or payment history.",
  },
  unbilled_time_entries: {
    label: "Unbilled Time Entries",
    description: "Open time entries not yet invoiced.",
    defaultChecked: false,
    sensitiveNote: "Copied entries become new records in the target workspace with reset invoice linkage.",
  },
  draft_invoices: {
    label: "Draft Invoices",
    description: "Invoices in draft status only.",
    defaultChecked: false,
    sensitiveNote: "Only draft-status invoices are copied. Paid invoices and payment history are excluded.",
  },
};

// Dependency rules: if A is checked, warn if B is not checked
const DEPENDENCY_HINTS: Array<{
  requires: WorkspaceMigrableDataType;
  if: WorkspaceMigrableDataType[];
  message: string;
}> = [
  {
    requires: "clients",
    if: ["projects", "unbilled_time_entries", "draft_invoices"],
    message: "Clients are needed for the other selected types — consider including them.",
  },
  {
    requires: "projects",
    if: ["budgets"],
    message: "Budgets are linked to projects — consider including Projects too.",
  },
];

function getDependencyWarnings(selected: Set<WorkspaceMigrableDataType>): string[] {
  return DEPENDENCY_HINTS.reduce<string[]>((warnings, rule) => {
    const hasDependent = rule.if.some((t) => selected.has(t));
    if (hasDependent && !selected.has(rule.requires)) {
      warnings.push(rule.message);
    }
    return warnings;
  }, []);
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Source",
  "Configure",
  "Data",
  "Review",
  "Done",
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1">
      {STEP_LABELS.map((label, index) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              index < current
                ? "bg-primary text-primary-foreground"
                : index === current
                  ? "border-2 border-primary text-primary"
                  : "border border-muted-foreground/30 text-muted-foreground"
            }`}
          >
            {index < current ? "✓" : index + 1}
          </div>
          {index < STEP_LABELS.length - 1 && (
            <div
              className={`h-px w-4 transition-colors ${
                index < current ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface WorkspaceMigrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this workspace as the copy source (e.g. the current active workspace). */
  initialSourceWorkspaceId?: string;
}

export function WorkspaceMigrationWizard({
  open,
  onOpenChange,
  initialSourceWorkspaceId,
}: WorkspaceMigrationWizardProps) {
  const workspaces = useAppStore((s) => s.workspaces);
  const createWorkspaceFromExisting = useAppStore((s) => s.createWorkspaceFromExisting);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  // Selectable source workspaces: active + archived, never deleted
  const sourceWorkspaces = workspaces.filter((ws) => ws.status !== "deleted");

  // Wizard state
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState<string>(
    initialSourceWorkspaceId ?? sourceWorkspaces[0]?.id ?? "",
  );
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<WorkspaceType>("solo");
  const [selected, setSelected] = useState<Set<WorkspaceMigrableDataType>>(
    new Set(
      ALL_MIGRATABLE_DATA_TYPES.filter((t) => DATA_TYPE_CONFIG[t].defaultChecked),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; workspaceId: string; workspaceName: string }
    | { ok: false; error: string }
    | null
  >(null);

  const sourceWorkspace = sourceWorkspaces.find((ws) => ws.id === sourceId);
  const dependencyWarnings = getDependencyWarnings(selected);

  function resetWizard() {
    setStep(0);
    setSourceId(initialSourceWorkspaceId ?? sourceWorkspaces[0]?.id ?? "");
    setNewName("");
    setNewType("solo");
    setSelected(
      new Set(ALL_MIGRATABLE_DATA_TYPES.filter((t) => DATA_TYPE_CONFIG[t].defaultChecked)),
    );
    setBusy(false);
    setResult(null);
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after close animation completes
    setTimeout(resetWizard, 300);
  }

  function toggleType(type: WorkspaceMigrableDataType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (busy) return;
    setBusy(true);

    try {
      const { workspace, migration } = createWorkspaceFromExisting(
        sourceId,
        newName.trim(),
        newType,
        Array.from(selected),
      );

      if (migration.status === "completed") {
        setResult({ ok: true, workspaceId: workspace.id, workspaceName: workspace.name });
      } else {
        setResult({ ok: false, error: migration.error ?? "Migration did not complete." });
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setBusy(false);
      setStep(4);
    }
  }

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderStep0() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select the workspace you want to copy data from. The original workspace will remain
          completely unchanged.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Source Workspace</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a workspace…" />
            </SelectTrigger>
            <SelectContent>
              {sourceWorkspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                  {ws.status === "archived" ? " (archived)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {sourceWorkspace && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              <strong>{sourceWorkspace.name}</strong> is a{" "}
              <strong>{sourceWorkspace.type}</strong> workspace. Your original
              data will not be affected by this operation.
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Give the new workspace a name and choose its type. A new workspace will be created and
          selected data will be copied into it.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">New Workspace Name</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={sourceWorkspace ? `${sourceWorkspace.name} — Copy` : "e.g. Acme Corp"}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Workspace Type</Label>
          <Select value={newType} onValueChange={(v) => setNewType(v as WorkspaceType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo — personal freelance workspace</SelectItem>
              <SelectItem value="company">
                Company — shared team workspace
                {/* [WORKSPACE-BRANCH] company UI: team management enables here */}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          A new workspace will be created. Selected data will be copied in. Your original
          workspace <strong>"{sourceWorkspace?.name}"</strong> will remain unchanged.
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose which data to copy from <strong>{sourceWorkspace?.name}</strong>. Each item
          becomes a new record in the new workspace.
        </p>

        <div className="space-y-3">
          {ALL_MIGRATABLE_DATA_TYPES.map((type) => {
            const config = DATA_TYPE_CONFIG[type];
            const isChecked = selected.has(type);
            return (
              <div
                key={type}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isChecked ? "border-primary/30 bg-primary/5" : ""
                }`}
              >
                <Checkbox
                  id={`dt-${type}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleType(type)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5 min-w-0">
                  <label
                    htmlFor={`dt-${type}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {config.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                  {config.sensitiveNote && (
                    <p className="text-xs text-amber-600 mt-1">ℹ {config.sensitiveNote}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {dependencyWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
            {dependencyWarnings.map((warning, i) => (
              <p key={i} className="text-xs text-amber-700">
                ⚠ {warning}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Review your selections before creating the new workspace.
        </p>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Source workspace</span>
            <span className="font-medium">{sourceWorkspace?.name}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">New workspace</span>
            <span className="font-medium flex items-center gap-1.5">
              {newName.trim() || "(unnamed)"}
              <WorkspaceTypeBadge type={newType} />
            </span>
          </div>
          <Separator />
          <div className="text-sm">
            <span className="text-muted-foreground">Data to copy</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selected.size === 0 ? (
                <span className="text-xs text-muted-foreground">Nothing selected</span>
              ) : (
                Array.from(selected).map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
                  >
                    {DATA_TYPE_CONFIG[type].label}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <strong>Your original workspace will not be modified or deleted.</strong> This is a
          copy operation. Archive or delete actions are separate and must be triggered manually.
        </div>

        {dependencyWarnings.map((warning, i) => (
          <p key={i} className="text-xs text-amber-600">
            ⚠ {warning}
          </p>
        ))}
      </div>
    );
  }

  function renderStep4() {
    if (!result) return null;

    if (result.ok) {
      return (
        <div className="space-y-4 text-center py-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <div>
            <h3 className="font-heading text-base font-semibold">Workspace created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>{result.workspaceName}</strong> is ready. Selected data has been copied
              into it. Your original workspace is untouched.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                if (result.ok) {
                  setActiveWorkspace(result.workspaceId);
                }
                handleClose();
              }}
            >
              Switch to new workspace
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Stay in current workspace
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-center py-4">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <div>
          <h3 className="font-heading text-base font-semibold text-destructive">Migration failed</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {result.error}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Your original workspace was not affected.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" onClick={() => { setStep(3); setResult(null); }}>
            Back to review
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const canAdvanceStep0 = !!sourceId;
  const canAdvanceStep1 = !!newName.trim();
  const canAdvanceStep2 = selected.size > 0;

  function canAdvance() {
    if (step === 0) return canAdvanceStep0;
    if (step === 1) return canAdvanceStep1;
    if (step === 2) return canAdvanceStep2;
    return true;
  }

  const isFinalStep = step === 3;
  const isDoneStep = step === 4;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Create Workspace from Existing</DialogTitle>
          <DialogDescription>
            Copy selected data into a new workspace. The original stays intact.
          </DialogDescription>
          {!isDoneStep && (
            <div className="pt-2">
              <StepIndicator current={step} />
            </div>
          )}
        </DialogHeader>

        <div className="py-2">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Footer navigation — hidden on result step (step 4 handles its own buttons) */}
        {!isDoneStep && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}
              disabled={busy}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {step === 0 ? "Cancel" : "Back"}
            </Button>

            {isFinalStep ? (
              <Button onClick={handleConfirm} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Copy
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
