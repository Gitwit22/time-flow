import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";

/**
 * Returns all data collections filtered to the currently active workspace.
 * Use this hook in any page/component that reads clients, projects, time
 * entries, invoices, expenses, projectBills, or estimates from the store so
 * that only data belonging to the active workspace is surfaced — preventing
 * cross-business data leaks when the user has multiple workspaces.
 */
function matchesWorkspace(
  item: { workspaceId?: string; organizationId?: string },
  activeOrganizationId: string,
): boolean {
  const id = item.workspaceId ?? item.organizationId;
  return !id || id === activeOrganizationId;
}

export function useWorkspaceData() {
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const allClients = useAppStore((state) => state.clients);
  const allProjects = useAppStore((state) => state.projects);
  const allTimeEntries = useAppStore((state) => state.timeEntries);
  const allInvoices = useAppStore((state) => state.invoices);
  const allExpenses = useAppStore((state) => state.expenses);
  const allProjectBills = useAppStore((state) => state.projectBills);
  const allEstimates = useAppStore((state) => state.estimates);

  return useMemo(() => {
    if (!activeOrganizationId) {
      return {
        clients: allClients,
        projects: allProjects,
        timeEntries: allTimeEntries,
        invoices: allInvoices,
        expenses: allExpenses,
        projectBills: allProjectBills,
        estimates: allEstimates,
      };
    }

    return {
      clients: allClients.filter((item) => matchesWorkspace(item, activeOrganizationId)),
      projects: allProjects.filter((item) => matchesWorkspace(item, activeOrganizationId)),
      timeEntries: allTimeEntries.filter((item) => matchesWorkspace(item, activeOrganizationId)),
      invoices: allInvoices.filter((item) => matchesWorkspace(item, activeOrganizationId)),
      expenses: allExpenses.filter((item) => matchesWorkspace(item, activeOrganizationId)),
      projectBills: allProjectBills.filter((item) => matchesWorkspace(item, activeOrganizationId)),
      estimates: allEstimates.filter((item) => matchesWorkspace(item, activeOrganizationId)),
    };
  }, [
    activeOrganizationId,
    allClients,
    allProjects,
    allTimeEntries,
    allInvoices,
    allExpenses,
    allProjectBills,
    allEstimates,
  ]);
}
