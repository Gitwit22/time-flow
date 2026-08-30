import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore, type AppState } from "@/store/appStore";
import { selectOrganizationScope } from "@/store/selectors";

/**
 * Returns all data collections filtered to the currently active workspace.
 * Use this hook in any page/component that reads clients, projects, time
 * entries, invoices, expenses, projectBills, or estimates from the store so
 * that only data belonging to the active workspace is surfaced — preventing
 * cross-business data leaks when the user has multiple workspaces.
 */
export function useWorkspaceData() {
  const scopeInput = useAppStore(useShallow((state) => ({
    activeOrganizationId: state.activeOrganizationId,
    clients: state.clients,
    projects: state.projects,
    timeEntries: state.timeEntries,
    invoices: state.invoices,
    expenses: state.expenses,
    projectBills: state.projectBills,
  })));
  const allEstimates = useAppStore((state) => state.estimates);
  const organizationScope = useMemo(
    () => selectOrganizationScope(scopeInput as AppState),
    [scopeInput],
  );

  return useMemo(() => {
    if (!scopeInput.activeOrganizationId) {
      return {
        ...organizationScope,
        estimates: allEstimates,
      };
    }

    return {
      ...organizationScope,
      estimates: allEstimates.filter(
        (item) => !item.organizationId || item.organizationId === scopeInput.activeOrganizationId,
      ),
    };
  }, [
    scopeInput.activeOrganizationId,
    organizationScope,
    allEstimates,
  ]);
}
