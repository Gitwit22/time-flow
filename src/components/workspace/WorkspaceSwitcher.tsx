/**
 * WorkspaceSwitcher — dropdown in the sidebar header for switching workspaces.
 *
 * Expanded mode: shows workspace name, type badge, and chevron indicator.
 * Collapsed mode: shows a minimal icon button.
 *
 * The dropdown lists accessible workspaces and includes a "Create Workspace" action.
 *
 * [WORKSPACE-BRANCH] workspace switcher UI: add an "Invite to workspace" menu
 *   item here when team management is introduced.
 */

import { useState } from "react";
import { Check, ChevronDown, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceTypeBadge } from "./WorkspaceTypeBadge";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed }: WorkspaceSwitcherProps) {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  // Only show other active workspaces in the switcher; never show deleted ones.
  const switchableWorkspaces = workspaces.filter((ws) => ws.status === "active");
  const hasMultiple = switchableWorkspaces.length > 1;

  if (!activeWorkspace) return null;

  const trigger = collapsed ? (
    // Collapsed sidebar: compact icon trigger
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent"
    >
      <ChevronsUpDown className="h-4 w-4" />
    </Button>
  ) : (
    // Expanded sidebar: workspace name + badge + chevron
    <button
      type="button"
      className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm hover:bg-sidebar-accent transition-colors"
    >
      <span className="font-heading font-bold text-sidebar-foreground truncate flex-1">
        {activeWorkspace.name}
      </span>
      <WorkspaceTypeBadge type={activeWorkspace.type} className="text-[10px] px-1.5 py-0" />
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
    </button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Workspaces
          </DropdownMenuLabel>

          {/* List all active workspaces */}
          {switchableWorkspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              className="flex items-center justify-between gap-2"
              onSelect={() => {
                if (ws.id !== activeWorkspace.id) {
                  setActiveWorkspace(ws.id);
                }
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {ws.id === activeWorkspace.id ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{ws.name}</span>
              </div>
              <WorkspaceTypeBadge type={ws.type} className="text-[10px] px-1.5 py-0 shrink-0" />
            </DropdownMenuItem>
          ))}

          {/* Note about archived workspaces — visible if any exist */}
          {workspaces.some((ws) => ws.status === "archived") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                Some archived workspaces are hidden
              </DropdownMenuItem>
            </>
          )}

          {!hasMultiple && (
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">
              You have one workspace.
            </DropdownMenuLabel>
          )}

          <DropdownMenuSeparator />

          {/* Create workspace action */}
          <DropdownMenuItem
            className="gap-2 text-primary focus:text-primary"
            onSelect={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
