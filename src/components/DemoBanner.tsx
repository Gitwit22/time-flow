/**
 * DemoBanner — Timeflow
 *
 * Shown at the top of the app when running in Demo Mode (no platform session).
 */

import { FlaskConical, LogIn, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { getSuiteLoginUrl } from "@/lib/suiteLogin";
import { useAppStore } from "@/store/appStore";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const resetApp = useAppStore((state) => state.resetApp);

  if (dismissed) return null;

  const handleLogin = () => {
    window.location.href = getSuiteLoginUrl(window.location.pathname);
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      "Reset demo data? This will restore the app to its initial sample state.",
    );
    if (!confirmed) return;
    resetApp();
  };

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-sm text-amber-200">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="font-medium text-amber-300">Demo Mode</span>
        <span className="hidden text-amber-200/80 sm:inline">
          — You're exploring sample data. Changes are temporary and will not be saved.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Demo
        </button>
        <button
          onClick={handleLogin}
          className="flex items-center gap-1.5 rounded bg-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/40 transition-colors"
        >
          <LogIn className="h-3.5 w-3.5" />
          Log In
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss demo banner"
          className="ml-1 rounded p-0.5 text-amber-400/60 hover:text-amber-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
