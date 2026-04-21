import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireContractor } from "@/components/layout/RequireContractor";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { getActiveUser, getViewerClientIdForUser, toAppIdentity } from "@/lib/auth";
import { getPlatformSession } from "@/lib/platformApi";
import { useAppStore } from "@/store/appStore";
import { AppModeProvider } from "@/context/AppModeContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";

// Entry point for suite-launched sessions
import PlatformLaunch from "./pages/PlatformLaunch";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Contractor workspace layout + pages
import { AdminLayout } from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import TimeTracker from "./pages/admin/TimeTracker";
import Clients from "./pages/admin/Clients";
import ProjectsPage from "./pages/admin/Projects";
import ProjectDetailPage from "./pages/admin/ProjectDetail";
import InvoiceCenter from "./pages/admin/InvoiceCenter";
import InvoiceDetail from "./pages/admin/InvoiceDetail";
import EmailPrep from "./pages/admin/EmailPrep";
import Reports from "./pages/admin/Reports";
import SettingsPage from "./pages/admin/Settings";
import DataTransferPage from "./pages/admin/DataTransfer";

// Client layout + pages
import { ClientLayout } from "./components/ClientLayout";
import ClientDashboard from "./pages/client/Dashboard";
import ClientTimeLogs from "./pages/client/TimeLogs";
import ClientInvoiceHistory from "./pages/client/InvoiceHistory";
import ClientInvoiceDetail from "./pages/client/InvoiceDetail";
import ClientAccount from "./pages/client/Account";
import ClientReports from "./pages/client/Reports";

const queryClient = new QueryClient();

function LegacyAdminRedirect() {
  const location = useLocation();
  const nextPath = location.pathname.replace(/^\/admin(?=\/|$)/, "/platform") || "/platform";

  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />;
}

/**
 * Restores app identity from the platform session on mount.
 * When a valid platform session exists, syncs the user profile into the store
 * and clears any leftover demo-mode data (so demo mutations don't bleed into
 * the authenticated session).
 */
function AuthBootstrapper() {
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);
  const markAuthenticated = useAppStore((state) => state.markAuthenticated);
  const markUnauthenticated = useAppStore((state) => state.markUnauthenticated);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);
  const authStatus = useAppStore((state) => state.authStatus);

  useEffect(() => {
    if (authStatus !== "unknown") return;

    const platformSession = getPlatformSession();
    if (platformSession) {
      syncCurrentUser({
        name: platformSession.user.email.split("@")[0] ?? platformSession.user.email,
        email: platformSession.user.email,
        role: platformSession.user.role,
      });
      markAuthenticated();

      setViewerClientContext(
        platformSession.user.role === "client_viewer" ? platformSession.user.organizationId : undefined,
        platformSession.user.role === "client_viewer",
      );

      void hydrateFromApi();

      return;
    }

    const activeUser = getActiveUser();
    if (!activeUser) {
      markUnauthenticated();
      return;
    }

    const identity = toAppIdentity(activeUser);
    syncCurrentUser(identity);
    markAuthenticated();

    setViewerClientContext(
      activeUser.role === "client_viewer" ? getViewerClientIdForUser(activeUser.id) : undefined,
      activeUser.role === "client_viewer",
    );

    void hydrateFromApi();
  }, [
    authStatus,
    hydrateFromApi,
    markAuthenticated,
    markUnauthenticated,
    setViewerClientContext,
    syncCurrentUser,
  ]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthBootstrapper />
      <BrowserRouter>
      <AppModeProvider>
        {/* WorkspaceProvider wraps the whole app so any component can call useWorkspace().
            [WORKSPACE-BRANCH] workspace switcher UI: add <WorkspaceSwitcher> inside
            AdminLayout's nav bar once the UI is ready. */}
        <WorkspaceProvider>
        <Routes>
          {/* Suite launch entry point (optional SSO hand-off) */}
          <Route path="/launch" element={<PlatformLaunch />} />

          {/* Direct auth entry points */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Navigate to="/login?mode=signup" replace />} />
          <Route path="/invite" element={<Navigate to="/login?mode=invite" replace />} />

          {/* Contractor workspace */}
          <Route
            path="/platform"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="time" element={<TimeTracker />} />
            <Route
              path="clients"
              element={
                <RequireContractor>
                  <Clients />
                </RequireContractor>
              }
            />
            <Route
              path="projects"
              element={
                <RequireContractor>
                  <ProjectsPage />
                </RequireContractor>
              }
            />
            <Route
              path="projects/:id"
              element={
                <RequireContractor>
                  <ProjectDetailPage />
                </RequireContractor>
              }
            />
            <Route path="invoices" element={<InvoiceCenter />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route
              path="email"
              element={
                <RequireContractor>
                  <EmailPrep />
                </RequireContractor>
              }
            />
            <Route path="reports" element={<Reports />} />
            <Route
              path="settings"
              element={
                <RequireContractor>
                  <SettingsPage />
                </RequireContractor>
              }
            />
            <Route
              path="data"
              element={
                <RequireContractor>
                  <DataTransferPage />
                </RequireContractor>
              }
            />
          </Route>

          <Route path="/admin" element={<LegacyAdminRedirect />} />
          <Route path="/admin/*" element={<LegacyAdminRedirect />} />

          {/* Client Portal */}
          <Route
            path="/client"
            element={
              <RequireAuth>
                <ClientLayout />
              </RequireAuth>
            }
          >
            <Route index element={<ClientDashboard />} />
            <Route path="time-logs" element={<ClientTimeLogs />} />
            <Route path="invoices" element={<ClientInvoiceHistory />} />
            <Route path="invoices/:id" element={<ClientInvoiceDetail />} />
            <Route path="reports" element={<ClientReports />} />
            <Route path="account" element={<ClientAccount />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </WorkspaceProvider>
      </AppModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
