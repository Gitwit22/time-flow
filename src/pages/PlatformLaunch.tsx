/**
 * PlatformLaunch — the only entry point into Timeflow.
 *
 * Two scenarios:
 *  A) Suite opens Timeflow with ?token=<launchJWT>
 *     → consume the token, bootstrap identity, redirect to /admin or /client
 *  B) User has an existing platform session (e.g. page refresh, return visit)
 *     → skip consume, re-bootstrap from stored session, redirect immediately
 *  C) No token and no session → show "open from suite" message
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Zap } from "lucide-react";
import { consumeLaunchToken, getPlatformSession } from "@/lib/platformApi";
import { useAppStore } from "@/store/appStore";

export default function PlatformLaunch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const syncCurrentUser = useAppStore((s) => s.syncCurrentUser);
  const setViewerClientContext = useAppStore((s) => s.setViewerClientContext);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    function bootstrap(email: string, role: "contractor" | "client_viewer", organizationId: string) {
      syncCurrentUser({
        name: email.split("@")[0] ?? email,
        email,
        role,
      });
      setViewerClientContext(
        role === "client_viewer" ? organizationId : undefined,
        role === "client_viewer",
      );
      navigate(role === "client_viewer" ? "/client" : "/admin", { replace: true });
    }

    const token = searchParams.get("token") ?? searchParams.get("launchToken");

    // Scenario B: already have a valid session, no new token needed
    if (!token) {
      const existing = getPlatformSession();
      if (existing) {
        bootstrap(existing.user.email, existing.user.role, existing.user.organizationId);
        return;
      }
      // Scenario C: nothing to work with
      setError("no_token");
      return;
    }

    // Scenario A: consume the suite launch token
    consumeLaunchToken(token)
      .then((session) => {
        bootstrap(session.user.email, session.user.role, session.user.organizationId);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Authentication failed";
        setError(message);
      });
  }, [searchParams, navigate, syncCurrentUser, setViewerClientContext]);

  if (error === "no_token") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary">
            <Zap className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold">TimeFlow</h1>
            <p className="text-muted-foreground text-sm">
              TimeFlow is part of the Nxt Lvl Suite. Open it from your suite dashboard to get started.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Already a member?{" "}
            <a
              href="https://ntlops.com"
              className="underline hover:text-foreground"
            >
              Go to ntlops.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-destructive/10">
            <Zap className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Launch failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Return to the suite and try launching TimeFlow again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm">Signing you in…</span>
      </div>
    </div>
  );
}
