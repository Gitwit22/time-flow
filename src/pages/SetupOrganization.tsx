import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  getSetupOrganizationStatus,
  setupContinueSoloWorkspace,
  setupCreateOrganization,
  setupJoinOrganization,
  toAppIdentity,
} from "@/lib/auth";
import { useAppStore } from "@/store/appStore";
import type { OrganizationMember } from "@/types";

type SetupMode = "create" | "join" | "solo";

export default function SetupOrganizationPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const authStatus = useAppStore((state) => state.authStatus);
  const currentUser = useAppStore((state) => state.currentUser);
  const organizationMembers = useAppStore((state) => state.organizationMembers);
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const markAuthenticated = useAppStore((state) => state.markAuthenticated);
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);
  const seedOrganizationContext = useAppStore((state) => state.seedOrganizationContext);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);

  const [mode, setMode] = useState<SetupMode>("create");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  const hasActiveMembership = useMemo(() => {
    const currentUserId = currentUser.id?.trim();
    const currentUserEmail = currentUser.email?.trim().toLowerCase();

    return organizationMembers.some((member) => {
      if (member.status !== "active") {
        return false;
      }

      const memberEmail = member.email?.trim().toLowerCase();
      return (Boolean(currentUserId) && member.userId === currentUserId)
        || (Boolean(currentUserEmail) && memberEmail === currentUserEmail);
    });
  }, [currentUser.email, currentUser.id, organizationMembers]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setLoadingStatus(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const status = await getSetupOrganizationStatus();
        if (cancelled) return;
        if (!status.onboardingRequired) {
          navigate("/platform", { replace: true });
          return;
        }
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authStatus, navigate]);

  if (authStatus === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (hasActiveMembership) {
    return <Navigate to="/platform" replace />;
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading organization setup...</div>
      </div>
    );
  }

  const handleCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await setupCreateOrganization({
        organizationName,
        organizationType: organizationType || undefined,
        workspaceName: workspaceName || undefined,
        roleTitle: roleTitle || undefined,
      });

      syncCurrentUser(toAppIdentity(result.user));
      markAuthenticated();
      setViewerClientContext(undefined, false);

      if (result.organization) {
        seedOrganizationContext({
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            ownerUserId: result.user.id,
            createdAt: new Date().toISOString(),
            status: "active",
          },
          memberRole: "owner" as OrganizationMember["role"],
        });
      }

      await hydrateFromApi();
      navigate("/platform", { replace: true });
    } catch (error) {
      toast({
        title: "Unable to create organization",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await setupJoinOrganization(inviteToken.trim());

      syncCurrentUser(toAppIdentity(result.user));
      markAuthenticated();
      setViewerClientContext(undefined, false);

      if (result.organization) {
        seedOrganizationContext({
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            ownerUserId: result.user.id,
            createdAt: new Date().toISOString(),
            status: "active",
          },
          memberRole: "member" as OrganizationMember["role"],
        });
      }

      await hydrateFromApi();
      navigate("/platform", { replace: true });
    } catch (error) {
      toast({
        title: "Unable to join organization",
        description: error instanceof Error ? error.message : "Check your invite token and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueSolo = async () => {
    setSubmitting(true);
    try {
      const result = await setupContinueSoloWorkspace();

      syncCurrentUser(toAppIdentity(result.user));
      markAuthenticated();
      setViewerClientContext(undefined, false);

      if (result.organization) {
        seedOrganizationContext({
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            ownerUserId: result.user.id,
            createdAt: new Date().toISOString(),
            status: "active",
          },
          memberRole: "owner" as OrganizationMember["role"],
        });
      }

      await hydrateFromApi();
      navigate("/platform", { replace: true });
    } catch (error) {
      toast({
        title: "Unable to continue solo",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-heading">Set Up Your Workspace</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose how you want to start: create an organization, join with an invite, or continue with a solo workspace.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(value) => setMode(value as SetupMode)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">Create Organization</TabsTrigger>
              <TabsTrigger value="join">Join Organization</TabsTrigger>
              <TabsTrigger value="solo">Solo Workspace</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <form className="space-y-4" onSubmit={handleCreateOrganization}>
                <div className="space-y-1.5">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input id="org-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-type">Organization type (optional)</Label>
                  <Input id="org-type" value={organizationType} onChange={(event) => setOrganizationType(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="workspace-name">Workspace name (optional)</Label>
                  <Input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-title">Role/title (optional)</Label>
                  <Input id="role-title" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Organization"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join">
              <form className="space-y-4" onSubmit={handleJoinOrganization}>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-token">Invite link/token/code</Label>
                  <Input
                    id="invite-token"
                    value={inviteToken}
                    onChange={(event) => setInviteToken(event.target.value)}
                    placeholder="Paste invite token"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Joining..." : "Join Organization"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="solo">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Continue with a solo workspace. You can join or create a full organization later.
                </p>
                <Button className="w-full" onClick={handleContinueSolo} disabled={submitting}>
                  {submitting ? "Creating..." : "Continue as Solo Workspace"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
