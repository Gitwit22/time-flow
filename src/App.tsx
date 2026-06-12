import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireContractor } from "@/components/layout/RequireContractor";
import { RequireClientViewer } from "@/components/layout/RequireClientViewer";
import { RequireEmployee } from "@/components/layout/RequireEmployee";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { RequireWorkspaceMembership } from "@/components/layout/RequireWorkspaceMembership";
import { IdleWarningModal } from "@/components/IdleWarningModal";
import { clearAuthState, getActiveUser, getViewerClientIdForUser, logoutActiveUser, toAppIdentity } from "@/lib/auth";
import { clearPlatformSession, getPlatformSession } from "@/lib/platformApi";
import { registerUnauthorizedHandler } from "@/lib/timeflowApi";
import { useAppStore } from "@/store/appStore";
import { AppModeProvider, useAppMode } from "@/context/AppModeContext";
import { useIdleLogout } from "@/hooks/useIdleLogout";

// Entry point for suite-launched sessions
import PlatformLaunch from "./pages/PlatformLaunch";
import AcceptInvitePage from "./pages/AcceptInvite";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SetupOrganizationPage from "./pages/SetupOrganization";

// Contractor workspace layout + pages
import { AdminLayout } from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import TimeTracker from "./pages/admin/TimeTracker";
import Clients from "./pages/admin/Clients";
import ProjectsPage from "./pages/admin/Projects";
import TeamPage from "./pages/admin/Team";
import ExpensesPage from "./pages/admin/Expenses";
import ProjectDetailPage from "./pages/admin/ProjectDetail";
import InvoiceCenter from "./pages/admin/InvoiceCenter";
import InvoiceDetail from "./pages/admin/InvoiceDetail";
import ExportCenter from "./pages/admin/ExportCenter";
import Reports from "./pages/admin/Reports";
import ApprovalsPage from "./pages/admin/Approvals";
import SettingsPage from "./pages/admin/Settings";
import DataTransferPage from "./pages/admin/DataTransfer";
import EmployeeClockPage from "./pages/employee/Clock";
import MyTimesheetsPage from "./pages/employee/MyTimesheets";

// Client layout + pages
import { ClientLayout } from "./components/ClientLayout";
import { ClientErrorBoundary } from "./components/layout/ClientErrorBoundary";
import { PlatformErrorBoundary } from "./components/layout/PlatformErrorBoundary";
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
 *
 * Also registers the central 401 unauthorized handler so any API call that
 * receives a 401 clears the session and redirects to login.
 */
function AuthBootstrapper() {
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);
  const markAuthenticated = useAppStore((state) => state.markAuthenticated);
  const markUnauthenticated = useAppStore((state) => state.markUnauthenticated);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);
  const authStatus = useAppStore((state) => state.authStatus);

  // Register the global 401 handler once. When any API call returns 401,
  // we clear both local and platform sessions and redirect to login.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearAuthState();
      clearPlatformSession();
      window.location.replace("/login?session=expired");
    });
  }, []);

  useEffect(() => {
    if (authStatus !== "unknown") return;

    const platformSession = getPlatformSession();
    if (platformSession) {
      syncCurrentUser({
        id: platformSession.user.id,
        name: platformSession.user.email.split("@")[0] ?? platformSession.user.email,
        email: platformSession.user.email,
        role: platformSession.user.role,
      });
      markAuthenticated();

      setViewerClientContext(
        platformSession.user.role === "client_viewer" || platformSession.user.role === "viewer" ? platformSession.user.organizationId : undefined,
        platformSession.user.role === "client_viewer" || platformSession.user.role === "viewer",
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
      activeUser.role === "client_viewer" || activeUser.role === "viewer" ? getViewerClientIdForUser(activeUser.id) : undefined,
      activeUser.role === "client_viewer" || activeUser.role === "viewer",
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

/**
 * Tracks user inactivity and auto-logs out after the configured idle threshold.
 * Rendered inside AppModeProvider so it can read isAuthenticated.
 * Only active when the user is authenticated.
 */
function IdleManager() {
  const { isAuthenticated } = useAppMode();
  const resetApp = useAppStore((state) => state.resetApp);

  const warningMinutes = Number(import.meta.env.VITE_IDLE_WARNING_MINUTES) || 55;
  const logoutMinutes = Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES) || 60;

  const handleLogout = useCallback(() => {
    logoutActiveUser();
    resetApp();
    window.location.replace("/login");
  }, [resetApp]);

  const { isWarningVisible, resetTimer } = useIdleLogout({
    warningMs: warningMinutes * 60 * 1000,
    logoutMs: logoutMinutes * 60 * 1000,
    onLogout: handleLogout,
  });

  if (!isAuthenticated) return null;

  return <IdleWarningModal open={isWarningVisible} onStaySignedIn={resetTimer} />;
}

function InviteRedirect() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const target = code ? `/login?mode=invite&code=${encodeURIComponent(code)}` : "/login?mode=invite";
  return <Navigate to={target} replace />;
}

function LegacyInvoiceDetailRedirect() {
  const { id } = useParams();
  if (!id) {
    return <Navigate to="/platform/invoices" replace />;
  }
  return <Navigate to={`/platform/invoices/${encodeURIComponent(id)}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthBootstrapper />
      <BrowserRouter>
      <AppModeProvider>
        <IdleManager />
        <Routes>
          {/* Suite launch entry point (optional SSO hand-off) */}
          <Route path="/launch" element={<PlatformLaunch />} />

          {/* Direct auth entry points */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Navigate to="/login?mode=signup" replace />} />
          <Route path="/invite" element={<InviteRedirect />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route
            path="/setup-organization"
            element={
              <RequireAuth>
                <SetupOrganizationPage />
              </RequireAuth>
            }
          />

          {/* Contractor workspace */}
          <Route
            path="/platform"
            element={
              <RequireAuth>
                <RequireWorkspaceMembership>
                <RequireContractor>
                  <PlatformErrorBoundary>
                    <AdminLayout />
                  </PlatformErrorBoundary>
                </RequireContractor>
                </RequireWorkspaceMembership>
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="time" element={<TimeTracker />} />
            <Route
              path="expenses"
              element={
                <RequireContractor>
                  <ExpensesPage />
                </RequireContractor>
              }
            />
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
              path="team"
              element={
                <RequireContractor>
                  <TeamPage />
                </RequireContractor>
              }
            />
            <Route
              path="approvals"
              element={
                <RequireContractor>
                  <ApprovalsPage />
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
            <Route
              path="invoices"
              element={
                <RequireContractor>
                  <InvoiceCenter />
                </RequireContractor>
              }
            />
            <Route path="invoice" element={<Navigate to="/platform/invoices" replace />} />
            <Route
              path="invoices/:id"
              element={
                <RequireContractor>
                  <InvoiceDetail />
                </RequireContractor>
              }
            />
            <Route path="invoice/:id" element={<LegacyInvoiceDetailRedirect />} />
            <Route path="email" element={<Navigate to="/platform/export-center" replace />} />
            <Route
              path="export-center"
              element={
                <RequireContractor>
                  <ExportCenter />
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

          <Route
            path="/employee"
            element={
              <RequireAuth>
                <RequireWorkspaceMembership>
                <RequireEmployee>
                  <AdminLayout />
                </RequireEmployee>
                </RequireWorkspaceMembership>
              </RequireAuth>
            }
          >
            <Route index element={<EmployeeClockPage />} />
            <Route path="timesheets" element={<MyTimesheetsPage />} />
          </Route>

          {/* Client Portal */}
          <Route
            path="/client"
            element={
              <RequireAuth>
                <RequireClientViewer>
                  <ClientErrorBoundary>
                    <ClientLayout />
                  </ClientErrorBoundary>
                </RequireClientViewer>
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
      </AppModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
