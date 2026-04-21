/**
 * CreateWorkspaceDialog — lightweight dialog for creating a new workspace.
 *
 * Supports two modes:
 *  - Simple: user enters a name and picks Solo or Company type
 *  - From existing: opens WorkspaceMigrationWizard for a guided copy flow
 *
 * [WORKSPACE-BRANCH] company UI: the "Company" type option becomes the
 *   primary path for team setup here.
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceMigrationWizard } from "./WorkspaceMigrationWizard";
import type { WorkspaceType } from "@/types/workspace";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const { createWorkspace, activeWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("solo");
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setType("solo");
      setBusy(false);
    }
  }, [open]);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      createWorkspace(trimmed, type);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  function handleFromExisting() {
    onOpenChange(false);
    setWizardOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Create Workspace</DialogTitle>
            <DialogDescription>
              Start fresh with a new, empty workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Workspace Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Studio, Acme Corp"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Workspace Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as WorkspaceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo">
                    Solo — personal freelance workspace
                  </SelectItem>
                  <SelectItem value="company">
                    Company — shared team workspace
                    {/* [WORKSPACE-BRANCH] company UI: team management becomes
                        available once this type is selected */}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!name.trim() || busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Workspace
              </Button>
            </div>

            {/* Offer copy-from-existing as a secondary path */}
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Want to copy data from {activeWorkspace ? `"${activeWorkspace.name}"` : "an existing workspace"}?
              </span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={handleFromExisting}>
                Copy from existing →
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration wizard — opened when user chooses the copy-from-existing path */}
      <WorkspaceMigrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialSourceWorkspaceId={activeWorkspace?.id}
      />
    </>
  );
}
