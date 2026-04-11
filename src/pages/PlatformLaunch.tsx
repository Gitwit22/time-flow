/**
 * PlatformLaunch
 *
 * Entry point when Timeflow is opened from the Nxt Lvl Suite.
 * The suite appends ?token=<launchJWT> to the URL. This page:
 *  1. Reads the token from the query string.
 *  2. Exchanges it for a Timeflow-scoped JWT via the API.
 *  3. Bootstraps the app identity in the Zustand store.
 *  4. Redirects to /admin (contractor) or /client (client_viewer).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { consumeLaunchToken } from "@/lib/platformApi";
import { useAppStore } from "@/store/appStore";

export default function PlatformLaunch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const syncCurrentUser = useAppStore((s) => s.syncCurrentUser);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams.get("token") ?? searchParams.get("launchToken");

    if (!token) {
      setError("No launch token found. Please open Timeflow from the Nxt Lvl Suite.");
      return;
    }

    consumeLaunchToken(token)
      .then((session) => {
        // Sync identity into the Zustand store so the rest of the app
        // knows who is logged in without touching localStorage auth.
        syncCurrentUser({
          name: session.user.email.split("@")[0] ?? session.user.email,
          email: session.user.email,
          role: session.user.role,
        });

        const destination = session.user.role === "client_viewer" ? "/client" : "/admin";
        navigate(destination, { replace: true });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Authentication failed";
        setError(message);
      });
  }, [searchParams, navigate, syncCurrentUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4 p-8 rounded-lg border bg-card text-center space-y-4">
          <div className="text-destructive text-lg font-semibold">Launch Failed</div>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-xs text-muted-foreground">
            Return to the Nxt Lvl Suite and try launching Timeflow again.
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
