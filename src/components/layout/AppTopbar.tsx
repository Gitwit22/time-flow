import { Bell, Eye, LogIn, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getActiveUser, logoutActiveUser } from "@/lib/auth";
import { clearPlatformSession } from "@/lib/platformApi";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/appStore";
import { useAppMode } from "@/context/AppModeContext";
import { selectViewerScope } from "@/store/selectors";
import type { UserRole } from "@/types";

interface AppTopbarProps {
  readonlyHint?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppTopbar({ readonlyHint }: AppTopbarProps) {
  const navigate = useNavigate();
  const { isDemo } = useAppMode();
  const activeAuthUser = getActiveUser();
  const currentUser = useAppStore((state) => state.currentUser);
  const clients = useAppStore((state) => state.clients);
  const setRole = useAppStore((state) => state.setRole);
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);
  const { activeClient, viewerClientId, viewerClientLocked } = useAppStore(useShallow(selectViewerScope));
  const canSwitchRoles = !isDemo && activeAuthUser?.role === "contractor";
  const availableViewerClients = viewerClientLocked && viewerClientId ? clients.filter((client) => client.id === viewerClientId) : clients;

  const handleRoleChange = (role: UserRole) => {
    setRole(role);
    navigate(role === "contractor" ? "/admin" : "/client");
  };

  const handleLogout = () => {
    clearPlatformSession();
    logoutActiveUser();
    navigate("/login", { replace: true });
  };

  const handleLogin = () => {
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        {currentUser.role === "client_viewer" && readonlyHint ? (
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Eye className="h-3.5 w-3.5" />
            <span>{activeClient ? `${readonlyHint} for ${activeClient.name}` : readonlyHint}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {currentUser.role === "client_viewer" ? (
          <Select value={viewerClientId} onValueChange={(value) => setViewerClientContext(value, viewerClientLocked)} disabled={viewerClientLocked || !availableViewerClients.length}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {availableViewerClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {canSwitchRoles ? (
          <Select value={currentUser.role} onValueChange={(value) => handleRoleChange(value as UserRole)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contractor">Contractor mode</SelectItem>
              <SelectItem value="client_viewer">Client viewer mode</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-4 w-4" />
        </Button>
        {isDemo ? (
          <Button variant="ghost" size="icon" className="text-amber-400 hover:text-amber-300" onClick={handleLogin} title="Log in to TimeFlow">
            <LogIn className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
            {getInitials(currentUser.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
