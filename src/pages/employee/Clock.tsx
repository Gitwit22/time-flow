import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getSelectableProjects } from "@/lib/projects";
import { useAppStore } from "@/store/appStore";

export default function EmployeeClockPage() {
  const { toast } = useToast();
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const activeSession = useAppStore((state) => state.activeSession);
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const organizationMembers = useAppStore((state) => state.organizationMembers);
  const projectAssignments = useAppStore((state) => state.projectAssignments);
  const currentUser = useAppStore((state) => state.currentUser);
  const startSession = useAppStore((state) => state.startSession);
  const stopSession = useAppStore((state) => state.stopSession);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [taskType, setTaskType] = useState("");
  const [note, setNote] = useState("");

  const currentMember = useMemo(
    () => organizationMembers.find((member) => member.userId === currentUser.id && member.organizationId === activeOrganizationId),
    [activeOrganizationId, currentUser.id, organizationMembers],
  );

  const assignedProjectIds = useMemo(
    () => projectAssignments
      .filter((assignment) => assignment.organizationId === activeOrganizationId && assignment.memberId === currentMember?.id && assignment.active)
      .map((assignment) => assignment.projectId),
    [activeOrganizationId, currentMember?.id, projectAssignments],
  );

  const availableProjects = useMemo(
    () => getSelectableProjects(projects).filter((project) => project.organizationId === activeOrganizationId || assignedProjectIds.includes(project.id)),
    [activeOrganizationId, assignedProjectIds, projects],
  );

  const availableClients = useMemo(
    () => clients.filter((client) => client.organizationId === activeOrganizationId || availableProjects.some((project) => project.clientId === client.id)),
    [activeOrganizationId, availableProjects, clients],
  );

  function handleClockIn() {
    if (!selectedClientId) {
      toast({ title: "Select a client", description: "Choose a client before clocking in.", variant: "destructive" });
      return;
    }

    const combinedNote = [taskType.trim() ? `Task: ${taskType.trim()}` : "", note.trim()].filter(Boolean).join("\n");
    const started = startSession(selectedClientId, combinedNote || undefined, selectedProjectId || undefined);
    if (!started) {
      toast({ title: "Unable to clock in", description: "Check that your session is inactive and permissions allow clocking in.", variant: "destructive" });
      return;
    }

    toast({ title: "Clocked in", description: "Your active time session has started." });
  }

  function handleClockOut() {
    const stopped = stopSession();
    if (!stopped) {
      toast({ title: "Unable to clock out", description: "No active session found.", variant: "destructive" });
      return;
    }

    toast({ title: "Clocked out", description: "Time entry submitted for approval." });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Clock In / Out" subtitle="Track time under your assigned organization projects." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Current Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            {activeSession.isActive ? "Clocked In" : "Clocked Out"}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleClockIn} disabled={activeSession.isActive}>Clock In</Button>
            <Button variant="outline" onClick={handleClockOut} disabled={!activeSession.isActive}>Clock Out</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Session Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Input value={activeOrganizationId || "No active organization"} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {availableClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Task / Work Type (Optional)</Label>
              <Input value={taskType} onChange={(event) => setTaskType(event.target.value)} placeholder="Setup, design, admin, field work..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note (Optional)</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24 resize-none" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
