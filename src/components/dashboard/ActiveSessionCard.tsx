import { useEffect, useMemo, useState } from "react";
import { Play, Square } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getElapsedSeconds, formatClockTime, formatDurationFromSeconds } from "@/lib/date";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";

export function ActiveSessionCard() {
  const { toast } = useToast();
  const clients = useAppStore((state) => state.clients);
  const settings = useAppStore((state) => state.settings);
  const currentUser = useAppStore((state) => state.currentUser);
  const activeSession = useAppStore((state) => state.activeSession);
  const startSession = useAppStore((state) => state.startSession);
  const stopSession = useAppStore((state) => state.stopSession);
  const updateActiveSession = useAppStore((state) => state.updateActiveSession);
  const [selectedClientId, setSelectedClientId] = useState(settings.defaultClientId ?? clients[0]?.id ?? "");
  const [draftNotes, setDraftNotes] = useState(activeSession.notes ?? "");
  const [elapsedSeconds, setElapsedSeconds] = useState(getElapsedSeconds(activeSession.startedAt));

  useEffect(() => {
    if (!selectedClientId && clients[0]?.id) {
      setSelectedClientId(settings.defaultClientId ?? clients[0].id);
    }
  }, [clients, selectedClientId, settings.defaultClientId]);

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

  const isReadonly = currentUser.role === "client_viewer";

  const handleClockIn = () => {
    if (!selectedClientId) {
      toast({ title: "Select a client", description: "Choose a client before starting a session." });
      return;
    }

    const started = startSession(selectedClientId, draftNotes);

    if (!started) {
      toast({ title: "Unable to start session", description: "Only one active session can run at a time." });
      return;
    }

    toast({ title: "Session started", description: `Tracking time for ${activeClient?.name ?? "your client"}.` });
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
                {isReadonly ? "Client viewers can monitor sessions but cannot start them." : "Choose a client and start tracking time."}
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
