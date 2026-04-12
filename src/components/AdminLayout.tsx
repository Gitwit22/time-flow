import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { DemoBanner } from "@/components/DemoBanner";
import { useAppMode } from "@/context/AppModeContext";

export function AdminLayout() {
  const { isDemo } = useAppMode();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          {isDemo && <DemoBanner />}
          <AppTopbar readonlyHint="Client viewers can review activity but cannot make changes." />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
