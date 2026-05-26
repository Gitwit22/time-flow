import { Outlet } from "react-router-dom";
import { DemoBanner } from "@/components/DemoBanner";
import { useAppMode } from "@/context/AppModeContext";

export function AdminLayout() {
  const { isDemo } = useAppMode();
  return (
    <div className="min-h-screen flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
