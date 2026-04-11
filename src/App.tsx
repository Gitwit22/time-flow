import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireContractor } from "@/components/layout/RequireContractor";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { getPlatformSession } from "@/lib/platformApi";
import { useAppStore } from "@/store/appStore";

// Entry point for suite-launched sessions
import PlatformLaunch from "./pages/PlatformLaunch";
import NotFound from "./pages/NotFound";

// Admin layout + pages
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

/**
 * Restores app identity from the platform session on mount.
 * Replaces the old localStorage-based AuthBootstrapper.
 */
function AuthBootstrapper() {
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);

  useEffect(() => {
    const session = getPlatformSession();
    if (!session) return;

    syncCurrentUser({
      name: session.user.email.split("@")[0] ?? session.user.email,
      email: session.user.email,
      role: session.user.role,
    });

    setViewerClientContext(
      session.user.role === "client_viewer" ? session.user.organizationId : undefined,
      session.user.role === "client_viewer",
    );
  }, [syncCurrentUser, setViewerClientContext]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthBootstrapper />
      <BrowserRouter>
        <Routes>
          {/* Suite launch entry point */}
          <Route path="/launch" element={<PlatformLaunch />} />

          {/* Legacy public routes → redirect to /launch */}
          <Route path="/" element={<Navigate to="/launch" replace />} />
          <Route path="/login" element={<Navigate to="/launch" replace />} />
          <Route path="/signup" element={<Navigate to="/launch" replace />} />
          <Route path="/invite" element={<Navigate to="/launch" replace />} />

          {/* Admin */}
          <Route
            path="/admin"
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
