/**
 * PlatformLaunch.tsx
 *
 * Entry point for Suite-launched sessions AND direct raw-URL / bookmark visits.
 *
 * Behavior:
 *   1. If a ?token= or ?launchToken= param is present (Suite hand-off):
 *      exchange it for a Timeflow-scoped JWT, persist the session, then
 *      redirect to the admin dashboard as an authenticated user.
 *   2. If no token is present:
 *      redirect to /login for direct app authentication.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { consumeLaunchToken } from "@/lib/platformApi";

export default function PlatformLaunch() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const token = searchParams.get("token") ?? searchParams.get("launchToken");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    void (async () => {
      try {
        await consumeLaunchToken(token);
        // Full page redirect so AppModeContext re-initializes with the new
        // platform session already in localStorage (navigate() keeps the same
        // React tree and AppModeContext never re-reads localStorage).
        window.location.replace("/admin");
      } catch {
        // Token exchange failed — send user to direct app login.
        setError("Launch failed");
        setTimeout(() => window.location.replace("/login"), 1500);
      }
    })();
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <p className="text-sm">Launch failed — redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
    </div>
  );
}
