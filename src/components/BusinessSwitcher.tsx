import { useState } from "react";
import { Building2, Check, ChevronDown, Plus, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import type { Organization } from "@/types";

interface BusinessSwitcherProps {
  collapsed?: boolean;
  onAddBusiness?: () => void;
}

export function BusinessSwitcher({ collapsed, onAddBusiness }: BusinessSwitcherProps) {
  const navigate = useNavigate();
  const organizations = useAppStore((state) => state.organizations);
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const setActiveOrganization = useAppStore((state) => state.setActiveOrganization);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);
  const settings = useAppStore((state) => state.settings);

  const [open, setOpen] = useState(false);

  const activeOrg: Organization | undefined = organizations.find(
    (org) => org.id === activeOrganizationId,
  );

  const displayName = activeOrg?.name || settings.businessName || "My Business";

  function handleSwitch(orgId: string) {
    if (orgId === activeOrganizationId) return;
    setActiveOrganization(orgId);
    void hydrateFromApi();
    setOpen(false);
  }

  function handleManage() {
    navigate("/platform/businesses");
    setOpen(false);
  }

  function handleAdd() {
    setOpen(false);
    onAddBusiness?.();
  }

  if (collapsed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40">
        {settings.invoiceLogoDataUrl ? (
          <img src={settings.invoiceLogoDataUrl} alt="Business logo" className="h-full w-full object-contain" />
        ) : (
          <Building2 className="h-4 w-4 text-sidebar-foreground/70" />
        )}
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left",
            "hover:bg-sidebar-accent/60 transition-colors focus:outline-none",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40">
            {settings.invoiceLogoDataUrl ? (
              <img src={settings.invoiceLogoDataUrl} alt="Business logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-4 w-4 text-sidebar-foreground/70" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading text-sm font-bold text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {organizations.length > 1 ? `${organizations.length} businesses` : "Active workspace"}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="flex-1 truncate text-sm">{org.name}</span>
            {org.id === activeOrganizationId && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleAdd} className="cursor-pointer gap-2">
          <Plus className="h-4 w-4" />
          <span className="text-sm">Add Another Business</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleManage} className="cursor-pointer gap-2">
          <Settings className="h-4 w-4" />
          <span className="text-sm">Manage Businesses</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
