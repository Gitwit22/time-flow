import { Bell, Eye, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { logoutActiveUser } from "@/lib/auth";
import { useAppStore } from "@/store/appStore";
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
  const currentUser = useAppStore((state) => state.currentUser);
  const setRole = useAppStore((state) => state.setRole);

  const handleRoleChange = (role: UserRole) => {
    setRole(role);
    navigate(role === "contractor" ? "/admin" : "/client");
  };

  const handleLogout = () => {
    logoutActiveUser();
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        {currentUser.role === "client_viewer" && readonlyHint ? (
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Eye className="h-3.5 w-3.5" />
            <span>{readonlyHint}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Select value={currentUser.role} onValueChange={(value) => handleRoleChange(value as UserRole)}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contractor">Contractor mode</SelectItem>
            <SelectItem value="client_viewer">Client viewer mode</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
            {getInitials(currentUser.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
