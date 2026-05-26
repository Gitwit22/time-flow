import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronsUpDown, Pencil, Plus, Star, Trash2, UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { canManageWorkspace, canViewAdminWorkspace } from "@/lib/organization";
import { useAppStore } from "@/store/appStore";

function getWorkspaceTypeLabel(memberCount: number, organizationName?: string, workspaceType?: "solo" | "team") {
  if (workspaceType === "team") return "Team workspace";
  if (workspaceType === "solo") return "Solo workspace";
  const looksLikeTeamWorkspace = Boolean(organizationName?.toLowerCase().includes("team"));
  return memberCount > 1 || looksLikeTeamWorkspace ? "Team workspace" : "Solo workspace";
}

export function WorkspaceSwitcher() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const organizations = useAppStore((state) => state.organizations) ?? [];
  const organizationMembers = useAppStore((state) => state.organizationMembers) ?? [];
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const setActiveOrganization = useAppStore((state) => state.setActiveOrganization);
  const createOrganizationWorkspace = useAppStore((state) => state.createOrganizationWorkspace);
  const renameOrganization = useAppStore((state) => state.renameOrganization);
  const archiveOrganization = useAppStore((state) => state.archiveOrganization);
  const deleteOrganization = useAppStore((state) => state.deleteOrganization);
  const setDefaultOrganization = useAppStore((state) => state.setDefaultOrganization);
  const transferOrganizationOwnership = useAppStore((state) => state.transferOrganizationOwnership);

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const canSwitchWorkspace = canViewAdminWorkspace(currentUser.role);
  const canManageWorkspaces = canManageWorkspace(currentUser.role);
  const activeOrganization = useMemo(
    () => organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0],
    [activeOrganizationId, organizations],
  );
  const resolvedOrganizationId = activeOrganization?.id;

  const activeMemberCount = useMemo(
    () => organizationMembers.filter((member) => member.organizationId === resolvedOrganizationId && member.status !== "disabled").length,
    [organizationMembers, resolvedOrganizationId],
  );

  useEffect(() => {
    if (resolvedOrganizationId && resolvedOrganizationId !== activeOrganizationId) {
      setActiveOrganization(resolvedOrganizationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOrganizationId]);

  if (!canSwitchWorkspace || !activeOrganization) {
    return null;
  }

  const handleCreateWorkspace = () => {
    void createOrganizationWorkspace(`${activeOrganization.name} Team`);
  };

  const startRename = (organizationId: string, currentName: string) => {
    setRenameTarget(organizationId);
    setRenameValue(currentName);
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameOrganization(renameTarget, renameValue.trim());
      toast({ title: "Workspace renamed" });
      setRenameTarget(null);
      setRenameValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename workspace";
      toast({ title: "Rename failed", description: message, variant: "destructive" });
    }
  };

  const handleArchive = async (organizationId: string) => {
    try {
      await archiveOrganization(organizationId);
      toast({ title: "Workspace archived" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to archive workspace";
      toast({ title: "Archive failed", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async (organizationId: string) => {
    try {
      await deleteOrganization(organizationId);
      toast({ title: "Empty workspace deleted" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete workspace";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    }
  };

  const handleSetDefault = async (organizationId: string) => {
    try {
      await setDefaultOrganization(organizationId);
      toast({ title: "Default workspace updated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set default workspace";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    }
  };

  const handleTransferOwnership = async (organizationId: string) => {
    const newOwnerEmail = window.prompt("Enter the new owner email:");
    if (!newOwnerEmail?.trim()) return;
    try {
      await transferOrganizationOwnership(organizationId, newOwnerEmail.trim());
      toast({ title: "Ownership transferred" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to transfer ownership";
      toast({ title: "Transfer failed", description: message, variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-[220px] justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-left">
            {activeOrganization.name} · {getWorkspaceTypeLabel(activeMemberCount, activeOrganization.name, activeOrganization.workspaceType)}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={resolvedOrganizationId} onValueChange={setActiveOrganization}>
          {organizations.map((organization) => {
            const memberCount = organizationMembers.filter(
              (member) => member.organizationId === organization.id && member.status !== "disabled",
            ).length;
            const isActive = organization.id === resolvedOrganizationId;
            const typeLabel = getWorkspaceTypeLabel(memberCount, organization.name, organization.workspaceType);

            return (
              <DropdownMenuRadioItem key={organization.id} value={organization.id} className="items-start py-2">
                <div className="flex w-full flex-col gap-1 pr-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{organization.name}</span>
                    <div className="flex items-center gap-1">
                      {organization.isDefault ? <span className="text-[10px] uppercase tracking-wide text-emerald-600">Default</span> : null}
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{typeLabel.replace(" workspace", "")}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{typeLabel}</span>
                  {isActive && canManageWorkspaces ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startRename(organization.id, organization.name);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleSetDefault(organization.id);
                        }}
                      >
                        <Star className="mr-1 h-3 w-3" /> Default
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleTransferOwnership(organization.id);
                        }}
                      >
                        <UserRoundCog className="mr-1 h-3 w-3" /> Transfer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleArchive(organization.id);
                        }}
                      >
                        <Archive className="mr-1 h-3 w-3" /> Archive
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleDelete(organization.id);
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Delete Empty Workspace
                      </Button>
                    </div>
                  ) : null}
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        {renameTarget ? (
          <>
            <DropdownMenuSeparator />
            <div className="space-y-2 p-2">
              <p className="text-xs text-muted-foreground">Rename workspace</p>
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitRename();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>Cancel</Button>
                <Button size="sm" onClick={() => void submitRename()}>Save</Button>
              </div>
            </div>
          </>
        ) : null}
        {canManageWorkspaces ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleCreateWorkspace} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Create team workspace
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
