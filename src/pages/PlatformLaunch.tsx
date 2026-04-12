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
 *      redirect to /admin immediately. AppModeContext will see no platform
 *      session and resolve to demo mode.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { consumeLaunchToken } from "@/lib/platformApi";

export default function PlatformLaunch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const token = searchParams.get("token") ?? searchParams.get("launchToken");

    if (!token) {
      // No token — go straight to admin; AppModeContext resolves auth vs demo.
      navigate("/admin", { replace: true });
      return;
    }

    void (async () => {
      try {
        await consumeLaunchToken(token);
        navigate("/admin", { replace: true });
      } catch {
        // Token exchange failed — enter demo mode.
        setError("Launch failed");
        setTimeout(() => navigate("/admin", { replace: true }), 1500);
      }
    })();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <p className="text-sm">Launch failed — entering demo mode…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
    </div>
  );
}
