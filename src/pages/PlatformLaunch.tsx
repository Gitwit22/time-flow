import { Navigate } from "react-router-dom";

// Phase 1: auth handoff disabled. Suite opens Timeflow directly; no token exchange.
// Any hit on /launch goes straight to the app.
export default function PlatformLaunch() {
  return <Navigate to="/admin" replace />;
}
