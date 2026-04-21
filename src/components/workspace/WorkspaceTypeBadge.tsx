/**
 * WorkspaceTypeBadge — shows "Solo" or "Company" for a workspace type.
 *
 * [WORKSPACE-BRANCH] company UI: this badge will appear next to workspace
 *   names throughout the app once multi-workspace support is visible.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkspaceType } from "@/types/workspace";

interface WorkspaceTypeBadgeProps {
  type: WorkspaceType;
  className?: string;
}

export function WorkspaceTypeBadge({ type, className }: WorkspaceTypeBadgeProps) {
  if (type === "company") {
    return (
      <Badge variant="secondary" className={cn("shrink-0", className)}>
        Company
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("shrink-0", className)}>
      Solo
    </Badge>
  );
}
