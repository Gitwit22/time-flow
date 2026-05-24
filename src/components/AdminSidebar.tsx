import { LayoutDashboard, Clock, Users, BriefcaseBusiness, FileText, Mail, BarChart3, Settings, Zap, ArrowLeftRight, Receipt } from "lucide-react";
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
import { canGenerateInvoices, canManageTeam, canViewAdminWorkspace, isEmployeeRole, isViewerLikeRole } from "@/lib/organization";

const mainItems = [
  { title: "Dashboard", url: "/platform", icon: LayoutDashboard },
  { title: "Time Tracker", url: "/platform/time", icon: Clock },
  { title: "Expenses", url: "/platform/expenses", icon: Receipt },
  { title: "Clients", url: "/platform/clients", icon: Users },
  { title: "Projects", url: "/platform/projects", icon: BriefcaseBusiness },
  { title: "Team", url: "/platform/team", icon: Users },
  { title: "Invoices", url: "/platform/invoices", icon: FileText },
  { title: "Export Center", url: "/platform/export-center", icon: Mail },
  { title: "Reports", url: "/platform/reports", icon: BarChart3 },
];

const bottomItems = [
  { title: "Data Transfer", url: "/platform/data", icon: ArrowLeftRight },
  { title: "Settings", url: "/platform/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const role = useAppStore((store) => store.currentUser.role);
  const settings = useAppStore((store) => store.settings);
  const employeeItems = [
    { title: "Clock In / Out", url: "/employee", icon: Clock },
    { title: "My Timesheets", url: "/employee/timesheets", icon: FileText },
  ];
  const viewerItems = mainItems.filter((item) => ["Dashboard", "Invoices", "Reports"].includes(item.title));
  const payrollReviewerItems = mainItems.filter((item) => ["Dashboard", "Approvals", "Invoices", "Reports"].includes(item.title));
  const auditorItems = mainItems.filter((item) => ["Dashboard", "Invoices", "Reports"].includes(item.title));
  const managerItems = mainItems.filter((item) => ["Dashboard", "Time Tracker", "Projects", "Invoices", "Reports"].includes(item.title));
  const adminItems = mainItems;

  const visibleMainItems = isEmployeeRole(role)
    ? employeeItems
    : isViewerLikeRole(role)
      ? viewerItems
      : role === "payroll_reviewer"
        ? payrollReviewerItems
        : role === "auditor"
          ? auditorItems
      : role === "manager"
        ? managerItems
        : canViewAdminWorkspace(role)
          ? adminItems.filter((item) => {
              if (item.title === "Team") {
                return canManageTeam(role);
              }
              if (["Invoices", "Export Center"].includes(item.title)) {
                return canGenerateInvoices(role);
              }
              return true;
            })
          : viewerItems;

  const visibleBottomItems = isEmployeeRole(role) || isViewerLikeRole(role) || role === "payroll_reviewer" || role === "auditor" ? [] : bottomItems;

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
              <p className="text-xs text-sidebar-muted">Workspace</p>
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
                      end={item.url === "/platform"}
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
