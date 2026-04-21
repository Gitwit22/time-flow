/**
 * WorkspaceContext — TimeFlow
 *
 * Provides the active workspace and workspace-switching API to the React tree.
 *
 * Usage:
 *   const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
 *
 * [WORKSPACE-BRANCH] workspace switcher UI: render <WorkspaceSwitcher> inside
 *   the nav bar that reads from this context and calls setActiveWorkspace().
 *
 * [WORKSPACE-BRANCH] company UI: read activeWorkspace.type to conditionally
 *   show/hide team-only features (members, roles, shared billing …).
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppStore } from "@/store/appStore";
import {
  selectAccessibleWorkspaces,
  selectActiveWorkspace,
  selectActiveWorkspaceRole,
} from "@/store/selectors";
import { canEditWorkspace, canManageBilling, canManageMembers, hasWriteAccess } from "@/lib/workspace";
import type { Workspace, WorkspaceMemberRole, WorkspaceType } from "@/types/workspace";

interface WorkspaceContextType {
  /** The currently active workspace, or undefined during initial bootstrap. */
  activeWorkspace: Workspace | undefined;

  /** ID of the active workspace (null when not yet bootstrapped). */
  activeWorkspaceId: string | null;

  /** All workspaces accessible to the current user. */
  workspaces: Workspace[];

  /** The current user's role in the active workspace. */
  currentRole: WorkspaceMemberRole | undefined;

  /** Switch to a different workspace by ID. */
  setActiveWorkspace: (id: string) => void;

  /** Create a brand-new workspace and switch to it. */
  createWorkspace: (name: string, type: WorkspaceType) => Workspace;

  // ─── Derived permission flags (for gating UI elements) ─────────────────────

  /** Can the current user edit workspace settings / members? */
  canEdit: boolean;
  /** Can the current user manage team members? */
  canManageMembers: boolean;
  /** Can the current user access billing / invoices? */
  canManageBilling: boolean;
  /** Can the current user write business data (clients, projects, time)? */
  canWrite: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const workspaces = useAppStore(selectAccessibleWorkspaces);
  const currentRole = useAppStore(selectActiveWorkspaceRole);
  const storeSetActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);
  const storeCreateWorkspace = useAppStore((s) => s.createWorkspace);

  // Default to owner permissions when no role is resolved (solo / bootstrap).
  const role: WorkspaceMemberRole = currentRole ?? "owner";

  const value = useMemo<WorkspaceContextType>(
    () => ({
      activeWorkspace,
      activeWorkspaceId,
      workspaces,
      currentRole: role,
      setActiveWorkspace: storeSetActiveWorkspace,
      createWorkspace: storeCreateWorkspace,
      canEdit: canEditWorkspace(role),
      canManageMembers: canManageMembers(role),
      canManageBilling: canManageBilling(role),
      canWrite: hasWriteAccess(role),
    }),
    [
      activeWorkspace,
      activeWorkspaceId,
      workspaces,
      role,
      storeSetActiveWorkspace,
      storeCreateWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextType {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
