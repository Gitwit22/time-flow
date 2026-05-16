import { useEffect, useMemo } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";

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
import { canManageWorkspace } from "@/lib/organization";
import { useAppStore } from "@/store/appStore";

function getWorkspaceTypeLabel(memberCount: number, organizationName?: string) {
  const looksLikeTeamWorkspace = Boolean(organizationName?.toLowerCase().includes("team"));
  return memberCount > 1 || looksLikeTeamWorkspace ? "Team workspace" : "Solo workspace";
}

export function WorkspaceSwitcher() {
  const currentUser = useAppStore((state) => state.currentUser);
  const organizations = useAppStore((state) => state.organizations);
  const organizationMembers = useAppStore((state) => state.organizationMembers);
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const setActiveOrganization = useAppStore((state) => state.setActiveOrganization);
  const createOrganizationWorkspace = useAppStore((state) => state.createOrganizationWorkspace);

  const canSwitchWorkspace = canManageWorkspace(currentUser.role);
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
    createOrganizationWorkspace(`${activeOrganization.name} Team`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-[220px] justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-left">
            {activeOrganization.name} · {getWorkspaceTypeLabel(activeMemberCount, activeOrganization.name)}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={resolvedOrganizationId} onValueChange={setActiveOrganization}>
          {organizations.map((organization) => {
            const memberCount = organizationMembers.filter(
              (member) => member.organizationId === organization.id && member.status !== "disabled",
            ).length;

            return (
              <DropdownMenuRadioItem key={organization.id} value={organization.id}>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{organization.name}</span>
                  <span className="text-xs text-muted-foreground">{getWorkspaceTypeLabel(memberCount, organization.name)}</span>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleCreateWorkspace} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Create team workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
