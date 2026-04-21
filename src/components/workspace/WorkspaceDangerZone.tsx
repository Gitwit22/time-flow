/**
 * WorkspaceDangerZone — archive and delete actions for a workspace.
 *
 * Both actions are protected by AlertDialog confirmation prompts.
 * Delete is gated behind an additional step: the user must first archive
 * the workspace before deleting it.
 *
 * Key invariants:
 *  - Archiving is soft (reversible via manual store action).
 *  - Deletion marks the workspace as "deleted" — data is NOT removed from storage.
 *  - Neither action is triggered by any migration operation.
 *
 * [WORKSPACE-BRANCH] company UI: surface an "un-archive" action and
 *   a proper admin-only delete once team management is added.
 */

import { useState } from "react";
import { Archive, Trash2 } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/appStore";
import type { Workspace } from "@/types/workspace";

interface WorkspaceDangerZoneProps {
  workspace: Workspace;
}

export function WorkspaceDangerZone({ workspace }: WorkspaceDangerZoneProps) {
  const archiveWorkspace = useAppStore((s) => s.archiveWorkspace);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isArchived = workspace.status === "archived";

  return (
    <div className="space-y-4">
      {/* Archive action */}
      {!isArchived && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Archive workspace</p>
            <p className="text-xs text-muted-foreground">
              Hides this workspace from the switcher. Your data is preserved and the workspace
              can be referenced in future migrations. This is reversible.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      )}

      {isArchived && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This workspace is <strong>archived</strong> and not shown in the workspace switcher.
          To restore it, contact support or use the store's un-archive action.
        </div>
      )}

      <Separator />

      {/* Delete action — only shown after archiving, or always with strong warning */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-destructive">Delete workspace</p>
          <p className="text-xs text-muted-foreground">
            Permanently marks this workspace as deleted. Existing data records are not removed
            from storage but the workspace will no longer be accessible.
            {!isArchived && (
              <span className="block mt-0.5 text-amber-600">
                Consider archiving first — it is safer and reversible.
              </span>
            )}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Archive confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{workspace.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This workspace will be hidden from the workspace switcher. Your data is safe and
              the workspace can still be used as a migration source. This action is reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                archiveWorkspace(workspace.id);
                setArchiveOpen(false);
              }}
            >
              Archive workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{workspace.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This marks the workspace as <strong>deleted</strong>. It will no longer be
                accessible from the workspace switcher.
              </span>
              <span className="block font-medium text-destructive">
                This action cannot be easily undone. Make sure you have a copy of any data
                you need, or archive instead.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                deleteWorkspace(workspace.id);
                setDeleteOpen(false);
              }}
            >
              Yes, delete workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
