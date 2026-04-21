/**
 * WorkspaceSettingsPanel — workspace management card for the Settings page.
 *
 * Shows:
 *  - Current workspace name, type, and status
 *  - Current user role in this workspace
 *  - Migration history (count of completed migrations)
 *  - Danger zone (archive / delete)
 *
 * [WORKSPACE-BRANCH] company UI: add a "Members" section here showing
 *   team members and their roles once team management is introduced.
 */

import { useState } from "react";
import { Building2, Copy, Info, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAppStore } from "@/store/appStore";
import { WorkspaceTypeBadge } from "./WorkspaceTypeBadge";
import { WorkspaceStatusBadge } from "./WorkspaceStatusBadge";
import { WorkspaceDangerZone } from "./WorkspaceDangerZone";
import { WorkspaceMigrationWizard } from "./WorkspaceMigrationWizard";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  billing: "Billing",
};

export function WorkspaceSettingsPanel() {
  const { activeWorkspace, currentRole } = useWorkspace();
  const workspaceMigrations = useAppStore((s) => s.workspaceMigrations);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!activeWorkspace) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active workspace found.</p>
        </CardContent>
      </Card>
    );
  }

  const completedMigrations = workspaceMigrations.filter(
    (m) =>
      m.status === "completed" &&
      (m.sourceWorkspaceId === activeWorkspace.id ||
        m.targetWorkspaceId === activeWorkspace.id),
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{activeWorkspace.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <WorkspaceTypeBadge type={activeWorkspace.type} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <WorkspaceStatusBadge status={activeWorkspace.status} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your role</span>
              <span className="font-medium">
                {ROLE_LABELS[currentRole ?? "owner"] ?? currentRole ?? "Owner"}
              </span>
            </div>
            {completedMigrations.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Migrations</span>
                <span className="text-muted-foreground">
                  {completedMigrations.length} completed
                </span>
              </div>
            )}
            {activeWorkspace.sourceWorkspaceId && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                This workspace was created from an existing workspace.
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Workspace Actions
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardOpen(true)}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Create from this workspace
              </Button>
              {/* [WORKSPACE-BRANCH] company UI: add "Manage Members" button here
                  when team management pages are introduced. */}
              {activeWorkspace.type === "company" && (
                <Button variant="outline" size="sm" className="gap-1.5" disabled>
                  <Users className="h-3.5 w-3.5" />
                  Manage Members
                  <span className="text-xs text-muted-foreground">(coming soon)</span>
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Danger zone */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Danger Zone
            </p>
            <WorkspaceDangerZone workspace={activeWorkspace} />
          </div>
        </CardContent>
      </Card>

      <WorkspaceMigrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialSourceWorkspaceId={activeWorkspace.id}
      />
    </>
  );
}
