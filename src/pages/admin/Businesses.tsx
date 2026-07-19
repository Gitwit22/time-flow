import { useState } from "react";
import { Building2, ChevronRight, Crown, MoreHorizontal, Plus, Star, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";
import { AddBusinessWizard } from "@/components/AddBusinessWizard";
import type { Organization } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  payroll_reviewer: "Payroll Reviewer",
  employee: "Employee",
  auditor: "Auditor",
  viewer: "Viewer",
  contractor: "Contractor",
};

export default function BusinessesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const organizations = useAppStore((state) => state.organizations);
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const currentUser = useAppStore((state) => state.currentUser);
  const organizationMembers = useAppStore((state) => state.organizationMembers);
  const setActiveOrganization = useAppStore((state) => state.setActiveOrganization);
  const setDefaultOrganization = useAppStore((state) => state.setDefaultOrganization);
  const archiveOrganization = useAppStore((state) => state.archiveOrganization);
  const deleteOrganization = useAppStore((state) => state.deleteOrganization);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Organization | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  function getMemberRole(org: Organization) {
    const member = organizationMembers.find(
      (m) => m.organizationId === org.id && (m.userId === currentUser.id || m.email === currentUser.email),
    );
    return member?.role ?? (org.ownerUserId === currentUser.id ? "owner" : "viewer");
  }

  function getMemberCount(org: Organization) {
    return organizationMembers.filter((m) => m.organizationId === org.id && m.status === "active").length;
  }

  function handleOpen(org: Organization) {
    setActiveOrganization(org.id);
    void hydrateFromApi();
    navigate("/platform");
  }

  async function handleSetDefault(org: Organization) {
    setWorking(org.id);
    try {
      await setDefaultOrganization(org.id);
      toast({ title: `${org.name} set as default business` });
    } catch {
      toast({ title: "Failed to update default", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  }

  async function handleArchive(org: Organization) {
    setWorking(org.id);
    try {
      await archiveOrganization(org.id);
      toast({ title: `${org.name} archived` });
    } catch {
      toast({ title: "Failed to archive business", variant: "destructive" });
    } finally {
      setWorking(null);
      setArchiveTarget(null);
    }
  }

  async function handleDelete(org: Organization) {
    setWorking(org.id);
    try {
      await deleteOrganization(org.id);
      toast({ title: `${org.name} deleted` });
    } catch {
      toast({ title: "Failed to delete business", variant: "destructive" });
    } finally {
      setWorking(null);
      setDeleteTarget(null);
    }
  }

  const activeOrgs = organizations.filter((o) => o.status !== "archived");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Businesses</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your business workspaces. Each business keeps its records, branding, and team separate.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Business
        </Button>
      </div>

      {activeOrgs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No businesses yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Add your first business to get started.</p>
            <Button className="mt-4" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Business
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeOrgs.map((org) => {
            const role = getMemberRole(org);
            const memberCount = getMemberCount(org);
            const isActive = org.id === activeOrganizationId;
            const isOwner = org.ownerUserId === currentUser.id || role === "owner";
            const isBusy = working === org.id;

            return (
              <Card
                key={org.id}
                className={`relative overflow-hidden transition-shadow hover:shadow-md ${
                  isActive ? "ring-2 ring-primary/40" : ""
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                )}
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                      {org.branding?.logoDataUrl ? (
                        <img
                          src={org.branding.logoDataUrl}
                          alt={org.name}
                          className="h-full w-full rounded-lg object-contain"
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{org.name}</h3>
                        {org.isDefault && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Star className="h-2.5 w-2.5" />
                            Default
                          </Badge>
                        )}
                        {isActive && (
                          <Badge className="text-[10px] px-1.5 py-0">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          {ROLE_LABELS[role] ?? role}
                        </span>
                        {memberCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {memberCount} {memberCount === 1 ? "member" : "members"}
                          </span>
                        )}
                      </div>
                      {org.legalName && org.legalName !== org.name && (
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{org.legalName}</p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleOpen(org)}
                          className="gap-2 cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                          Open Business
                        </DropdownMenuItem>
                        {!org.isDefault && (
                          <DropdownMenuItem
                            onClick={() => handleSetDefault(org)}
                            disabled={isBusy}
                            className="gap-2 cursor-pointer"
                          >
                            <Star className="h-4 w-4" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {isOwner && (
                          <>
                            <DropdownMenuItem
                              onClick={() => setArchiveTarget(org)}
                              disabled={isBusy}
                              className="gap-2 cursor-pointer text-orange-600 focus:text-orange-600"
                            >
                              Archive Business
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(org)}
                              disabled={isBusy}
                              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Business
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="flex-1 text-xs h-7"
                      onClick={() => handleOpen(org)}
                    >
                      {isActive ? "Currently Active" : "Switch to This"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Archive confirmation */}
      <AlertDialog open={archiveTarget !== null} onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This business will be archived and hidden from your workspace list. All records (estimates, invoices,
              projects) will be preserved. You can restore it from settings later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => archiveTarget && handleArchive(archiveTarget)}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">This action cannot be undone.</strong> Deleting this business will
              permanently remove all of its data, including estimates, invoices, projects, customers, expenses, and
              financial records. Consider archiving instead for a safer alternative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddBusinessWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
