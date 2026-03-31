import { LayoutDashboard, Clock, Users, BriefcaseBusiness, FileText, Mail, BarChart3, Settings, Zap } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppStore } from "@/store/appStore";

const mainItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Time Tracker", url: "/admin/time", icon: Clock },
  { title: "Clients", url: "/admin/clients", icon: Users },
  { title: "Projects", url: "/admin/projects", icon: BriefcaseBusiness },
  { title: "Invoices", url: "/admin/invoices", icon: FileText },
  { title: "Email Prep", url: "/admin/email", icon: Mail },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
];

const bottomItems = [
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const role = useAppStore((store) => store.currentUser.role);
  const settings = useAppStore((store) => store.settings);
  const visibleMainItems = role === "client_viewer" ? mainItems.filter((item) => ["Dashboard", "Time Tracker", "Invoices", "Reports"].includes(item.title)) : mainItems;
  const visibleBottomItems = role === "client_viewer" ? [] : bottomItems;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          {settings.invoiceLogoDataUrl ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40">
              <img src={settings.invoiceLogoDataUrl} alt="Brand logo" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
              <Zap className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <div>
              <h2 className="font-heading text-sm font-bold text-sidebar-foreground">{settings.businessName || "TimeFlow"}</h2>
              <p className="text-xs text-sidebar-muted">Contractor Hub</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleBottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
