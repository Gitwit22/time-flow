/**
 * WorkspaceStatusBadge — shows "Active", "Archived", or "Deleted" for a workspace.
 *
 * Archived workspaces use an amber outline, deleted ones use destructive styling.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkspaceStatus } from "@/types/workspace";

interface WorkspaceStatusBadgeProps {
  status: WorkspaceStatus;
  className?: string;
}

export function WorkspaceStatusBadge({ status, className }: WorkspaceStatusBadgeProps) {
  if (status === "active") {
    return (
      <Badge
        variant="default"
        className={cn("bg-green-600 hover:bg-green-600/80 shrink-0", className)}
      >
        Active
      </Badge>
    );
  }
  if (status === "archived") {
    return (
      <Badge
        variant="outline"
        className={cn("border-amber-300 text-amber-600 shrink-0", className)}
      >
        Archived
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className={cn("shrink-0", className)}>
      Deleted
    </Badge>
  );
}
