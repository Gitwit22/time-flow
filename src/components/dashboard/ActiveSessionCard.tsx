import { useEffect, useMemo, useState } from "react";
import { Play, Square } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getElapsedSeconds, formatClockTime, formatDurationFromSeconds } from "@/lib/date";
import { getProjectBudgetSnapshot, getProjectWarningMessage } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";

export function ActiveSessionCard() {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const projects = useAppStore((state) => state.projects);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const settings = useAppStore((state) => state.settings);
  const currentUser = useAppStore((state) => state.currentUser);
  const activeSession = useAppStore((state) => state.activeSession);
  const startSession = useAppStore((state) => state.startSession);
  const stopSession = useAppStore((state) => state.stopSession);
  const updateActiveSession = useAppStore((state) => state.updateActiveSession);
  const [trackingMode, setTrackingMode] = useState<"client" | "project">("client");
  const [selectedClientId, setSelectedClientId] = useState(settings.defaultClientId ?? clients[0]?.id ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [draftNotes, setDraftNotes] = useState(activeSession.notes ?? "");
  const [elapsedSeconds, setElapsedSeconds] = useState(getElapsedSeconds(activeSession.startedAt));

  useEffect(() => {
    if (!selectedClientId && clients[0]?.id) {
      setSelectedClientId(settings.defaultClientId ?? clients[0].id);
    }
  }, [clients, selectedClientId, settings.defaultClientId]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    setDraftNotes(activeSession.notes ?? "");
  }, [activeSession.notes]);

  useEffect(() => {
    if (!activeSession.isActive) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(getElapsedSeconds(activeSession.startedAt));
    const timer = window.setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(activeSession.startedAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSession.isActive, activeSession.startedAt]);

  const activeClient = useMemo(() => {
    const trackedClientId = activeSession.clientId ?? selectedClientId;
    return clients.find((client) => client.id === trackedClientId);
  }, [activeSession.clientId, clients, selectedClientId]);
  const activeProject = useMemo(() => {
    const trackedProjectId = activeSession.projectId ?? (trackingMode === "project" ? selectedProjectId : undefined);
    return projects.find((project) => project.id === trackedProjectId);
  }, [activeSession.projectId, projects, selectedProjectId, trackingMode]);
  const projectSnapshot = useMemo(
    () => (activeProject ? getProjectBudgetSnapshot(activeProject, timeEntries, clients, projects) : null),
    [activeProject, clients, projects, timeEntries],
  );
  const projectWarning = activeProject && projectSnapshot ? getProjectWarningMessage(activeProject, projectSnapshot) : null;

  const isReadonly = currentUser.role === "client_viewer";

  const handleClockIn = () => {
    if (trackingMode === "project") {
      if (!activeProject) {
        toast({ title: "Select a project", description: "Choose a project before starting a session." });
        return;
      }

      if (projectSnapshot?.isBlocked) {
        toast({ title: "Project cap reached", description: projectWarning ?? "This project is blocking additional billable entries.", variant: "destructive" });
        return;
      }
    }

    const resolvedClientId = trackingMode === "project" ? activeProject?.clientId ?? "" : selectedClientId;

    if (!resolvedClientId) {
      toast({ title: "Select a client", description: "Choose a client or project before starting a session." });
      return;
    }

    const started = startSession(resolvedClientId, draftNotes, trackingMode === "project" ? activeProject?.id : undefined);

    if (!started) {
      toast({ title: "Unable to start session", description: "Only one active session can run at a time." });
      return;
    }

    toast({ title: "Session started", description: `Tracking time for ${trackingMode === "project" ? activeProject?.name ?? activeClient?.name ?? "your project" : activeClient?.name ?? "your client"}.` });
  };

  const handleClockOut = () => {
    const entry = stopSession();

    if (!entry) {
      toast({ title: "No active session", description: "There is no running session to stop." });
      return;
    }

    setDraftNotes("");
    toast({ title: "Session saved", description: `${entry.durationHours.toFixed(2)} hours were added to your time log.` });
  };

  return (
    <Card className={activeSession.isActive ? "border-accent/30" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">Active Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeSession.isActive ? (
          <>
            <div className="text-center py-3">
              <div className="mb-2 flex items-center justify-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse-dot" />
                <span className="text-sm font-medium text-success">Tracking {activeClient?.name ?? "client work"}</span>
              </div>
              <p className="text-3xl font-bold font-heading">{formatDurationFromSeconds(elapsedSeconds)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Started at {activeSession.startedAt ? formatClockTime(activeSession.startedAt) : "--"}</p>
            </div>
            <Textarea
              value={draftNotes}
              onChange={(event) => {
                setDraftNotes(event.target.value);
                updateActiveSession({ notes: event.target.value });
              }}
              placeholder="What are you working on?"
              className="h-24 resize-none"
              disabled={isReadonly}
            />
            <Button
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              size="lg"
              onClick={handleClockOut}
              disabled={isReadonly}
            >
              <Square className="mr-2 h-4 w-4" />
              Clock Out
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <Select value={trackingMode} onValueChange={(value) => setTrackingMode(value as typeof trackingMode)} disabled={isReadonly}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tracking mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client only</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
              {trackingMode === "project" ? (
                <>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={isReadonly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Client: {activeProject ? clients.find((client) => client.id === activeProject.clientId)?.name ?? "Unknown client" : "Select a project"}
                  </div>
                  {projectWarning ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{projectWarning}</div> : null}
                </>
              ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={isReadonly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
              <Textarea
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                placeholder="Add a task label like API integration"
                className="h-24 resize-none"
                disabled={isReadonly}
              />
            </div>
            <div className="text-center py-2">
              <p className="mb-4 text-sm text-muted-foreground">
                {isReadonly ? "Client viewers can monitor sessions but cannot start them." : trackingMode === "project" ? "Choose a project to auto-fill the linked client and project billing rate." : "Choose a client and start tracking time."}
              </p>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg" onClick={handleClockIn} disabled={isReadonly}>
                <Play className="mr-2 h-4 w-4" />
                Clock In
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
