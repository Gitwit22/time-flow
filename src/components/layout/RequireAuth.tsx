import type { ReactElement } from "react";

// Phase 1: auth gate disabled. All routes are open while the data model stabilises.
export function RequireAuth({ children }: { children: ReactElement }) {
  return children;
}
