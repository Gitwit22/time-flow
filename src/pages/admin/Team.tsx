import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { canManageTeam } from "@/lib/organization";
import { useAppStore } from "@/store/appStore";
import type { EmployeeType, OrganizationMemberRole } from "@/types";

export default function TeamPage() {
  const { toast } = useToast();
  const role = useAppStore((state) => state.currentUser.role);
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const members = useAppStore((state) => state.organizationMembers);
  const projects = useAppStore((state) => state.projects);
  const projectAssignments = useAppStore((state) => state.projectAssignments);
  const inviteOrganizationMember = useAppStore((state) => state.inviteOrganizationMember);
  const addProjectAssignment = useAppStore((state) => state.addProjectAssignment);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<OrganizationMemberRole>("employee");
  const [employeeType, setEmployeeType] = useState<EmployeeType>("employee");
  const [hourlyRate, setHourlyRate] = useState("");
  const [canClockIn, setCanClockIn] = useState(true);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignProjectId, setAssignProjectId] = useState("");

  const organizationMembers = useMemo(
    () => members.filter((member) => member.organizationId === activeOrganizationId),
    [activeOrganizationId, members],
  );

  const canInvite = canManageTeam(role);

  function handleInviteMember() {
    if (!activeOrganizationId) {
      toast({ title: "No organization selected", description: "Select an active organization before inviting members.", variant: "destructive" });
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email required", description: "Enter a member name and email.", variant: "destructive" });
      return;
    }

    inviteOrganizationMember(
      {
        organizationId: activeOrganizationId,
        email: email.trim(),
        name: name.trim(),
        role: memberRole,
      },
      {
        active: true,
        canClockIn,
        displayName: name.trim(),
        email: email.trim(),
        employeeType,
        memberId: "",
        organizationId: activeOrganizationId,
        defaultHourlyRate: Number(hourlyRate || 0) || undefined,
      },
    );

    setName("");
    setEmail("");
    setMemberRole("employee");
    setEmployeeType("employee");
    setHourlyRate("");
    setCanClockIn(true);

    toast({ title: "Invite created", description: "Team member has been added with invited status." });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Team Members" subtitle="Invite members, assign roles, and manage who can clock in." />

      {!canInvite ? (
        <div className="readonly-banner">Read-only role: you can view team records but cannot invite or edit members.</div>
      ) : null}

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite Team Member
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={memberRole} onValueChange={(value) => setMemberRole(value as OrganizationMemberRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Employee Type</Label>
                <Select value={employeeType} onValueChange={(value) => setEmployeeType(value as EmployeeType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hourly Rate (Optional)</Label>
                <Input type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Can clock in / out</p>
                  <p className="text-xs text-muted-foreground">Disable for read-only members.</p>
                </div>
                <Switch checked={canClockIn} onCheckedChange={setCanClockIn} />
              </div>
            </div>

            <Button onClick={handleInviteMember}>Create Invite</Button>

            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">Optional: Assign Member to Project</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Select value={assignMemberId} onValueChange={setAssignMemberId}>
                  <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>
                    {organizationMembers.filter((member) => ["employee", "manager"].includes(member.role)).map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!activeOrganizationId || !assignMemberId || !assignProjectId) {
                    toast({ title: "Select member and project", description: "Choose both before assigning.", variant: "destructive" });
                    return;
                  }

                  addProjectAssignment({
                    active: true,
                    memberId: assignMemberId,
                    organizationId: activeOrganizationId,
                    projectId: assignProjectId,
                    roleOnProject: "worker",
                  });
                  setAssignMemberId("");
                  setAssignProjectId("");
                  toast({ title: "Assignment saved", description: "Member is now assigned to the project." });
                }}
              >
                Assign to Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Organization Members</CardTitle>
        </CardHeader>
        <CardContent>
          {organizationMembers.length ? (
            <div className="space-y-3">
              {organizationMembers.map((member) => (
                <div key={member.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {projectAssignments.filter((assignment) => assignment.memberId === member.id && assignment.active).length} active project assignment(s)
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium capitalize">{member.role}</p>
                      <p className="text-muted-foreground capitalize">{member.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No team members yet" description={`Invite your first team member. ${projects.length ? "Project assignments can be added next." : "Create projects, then assign members."}`} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
