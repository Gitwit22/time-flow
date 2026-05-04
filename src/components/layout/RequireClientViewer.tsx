import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAppStore } from "@/store/appStore";

interface RequireClientViewerProps {
  children: ReactElement;
}

export function RequireClientViewer({ children }: RequireClientViewerProps) {
  const role = useAppStore((state) => state.currentUser.role);

  if (role !== "client_viewer") {
    return <Navigate to="/platform" replace />;
  }

  return children;
}
