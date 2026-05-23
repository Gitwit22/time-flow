import { useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, FileJson, FileSpreadsheet, FileText, Send } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { toDateOnlyString } from "@/lib/date";
import { getCurrentPayPeriod } from "@/lib/payPeriods";
import { useAppStore } from "@/store/appStore";
import type { TimeEntry } from "@/types";

type ExportType = "mission_hub_timesheet" | "csv_backup" | "pdf_summary";
type ChecklistStatus = "ready" | "warning" | "blocked";
type ApprovalStatus = "pending" | "approved" | "rejected";

type HourBucket = "regular" | "manual" | "pto" | "vacation" | "sick" | "holiday" | "unpaid_leave";

interface EmployeeProjectSummary {
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  hours: number;
  billableHours: number;
  nonBillableHours: number;
}

interface EmployeeExportRow {
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  regularHours: number;
  manualHours: number;
  ptoHours: number;
  vacationHours: number;
  sickHours: number;
  holidayHours: number;
  unpaidLeaveHours: number;
  totalPaidHours: number;
  totalUnpaidHours: number;
  totalHours: number;
  approvalStatus: ApprovalStatus;
  sourceTimeEntryIds: string[];
  sourceEntries: TimeEntry[];
  projects: EmployeeProjectSummary[];
}

interface MissionHubTimesheetExportPackage {
  exportId: string;
  sourceApp: "timeflow";
  exportType: "mission_hub_timesheet";
  workspaceId: string;
  organizationId?: string;
  payPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    status: "open" | "reviewing" | "approved" | "locked" | "exported";
  };
  summary: {
    totalEmployees: number;
    totalHours: number;
    regularHours: number;
    manualHours: number;
    ptoHours: number;
    vacationHours: number;
    sickHours: number;
    holidayHours: number;
    unpaidLeaveHours: number;
    billableHours: number;
    nonBillableHours: number;
  };
  employees: Array<{
    employeeId: string;
    employeeName: string;
    employeeEmail?: string;
    regularHours: number;
    manualHours: number;
    ptoHours: number;
    vacationHours: number;
    sickHours: number;
    holidayHours: number;
    unpaidLeaveHours: number;
    totalPaidHours: number;
    totalUnpaidHours: number;
    projects: Array<{
      projectId?: string;
      projectName?: string;
      clientId?: string;
      clientName?: string;
      hours: number;
      billableHours: number;
      nonBillableHours: number;
    }>;
    sourceTimeEntryIds: string[];
    approvalStatus: "pending" | "approved" | "rejected";
  }>;
  createdAt: string;
  createdBy: string;
}

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

function statusClass(status: ChecklistStatus) {
  if (status === "ready") return "bg-success/10 text-success border-success/40";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/40";
  return "bg-destructive/10 text-destructive border-destructive/40";
}

function classifyHourBucket(entry: TimeEntry): HourBucket {
  // Use explicit timeType and leaveType fields for categorization
  // Fallback to keyword inference for older entries that haven't been backfilled yet
  
  if (entry.timeType === "leave" && entry.leaveType) {
    // Direct mapping from leaveType
    if (entry.leaveType === "pto") return "pto";
    if (entry.leaveType === "vacation") return "vacation";
    if (entry.leaveType === "sick") return "sick";
    if (entry.leaveType === "holiday") return "holiday";
    if (entry.leaveType === "unpaid" || entry.leaveType === "bereavement" || entry.leaveType === "admin_leave") return "unpaid_leave";
  }
  
  if (entry.timeType === "manual") return "manual";
  if (entry.timeType === "correction") return "regular"; // Corrections should be categorized with regular hours
  
  // Fallback to keyword inference for backward compatibility with pre-migration entries
  const note = entry.notes.toLowerCase();
  if (/\bpto\b/.test(note)) return "pto";
  if (/\bvacation\b/.test(note)) return "vacation";
  if (/\bsick\b/.test(note)) return "sick";
  if (/\bholiday\b/.test(note)) return "holiday";
  if (/\bunpaid\b|\bleave\b/.test(note) && /\bunpaid\b/.test(note)) return "unpaid_leave";

  // If no explicit timeType, infer from entry structure
  const isManualTime = !entry.clockInAt && !entry.clockOutAt;
  if (isManualTime) return "manual";
  
  return "regular";
}

function isInRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function toCsvCell(value: string | number) {
  const raw = String(value ?? "");
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replaceAll('"', '""')}"`;
}

export default function ExportCenter() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const organizations = useAppStore((state) => state.organizations);
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId);
  const organizationMembers = useAppStore((state) => state.organizationMembers);
  const timeEntries = useAppStore((state) => state.timeEntries);
  const projects = useAppStore((state) => state.projects);
  const clients = useAppStore((state) => state.clients);
  const activeSession = useAppStore((state) => state.activeSession);

  const initialPeriod = getCurrentPayPeriod(
    {
      payPeriodFrequency: settings.payPeriodFrequency ?? settings.invoiceFrequency ?? currentUser.invoiceFrequency,
      payPeriodStartDate: settings.payPeriodStartDate,
      periodWeekStartsOn: settings.periodWeekStartsOn,
    },
    new Date(),
  );

  const workspaceOptions = useMemo(() => {
    if (organizations.length > 0) return organizations;
    return [{
      id: activeOrganizationId ?? "workspace-default",
      name: settings.businessName || "Default Workspace",
      ownerUserId: currentUser.id,
      createdAt: new Date().toISOString(),
      status: "active" as const,
    }];
  }, [activeOrganizationId, currentUser.id, organizations, settings.businessName]);

  const [payPeriodStart, setPayPeriodStart] = useState(initialPeriod.startDate);
  const [payPeriodEnd, setPayPeriodEnd] = useState(initialPeriod.endDate);
  const [workspaceId, setWorkspaceId] = useState(activeOrganizationId ?? workspaceOptions[0]?.id ?? "workspace-default");
  const [exportType, setExportType] = useState<ExportType>("mission_hub_timesheet");
  const [previewPayload, setPreviewPayload] = useState<MissionHubTimesheetExportPackage | null>(null);
  const [exportMarked, setExportMarked] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  const memberById = useMemo(() => new Map(organizationMembers.map((member) => [member.id, member])), [organizationMembers]);
  const memberByUserId = useMemo(() => new Map(organizationMembers.filter((member) => member.userId).map((member) => [member.userId as string, member])), [organizationMembers]);
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const periodEntries = useMemo(
    () => timeEntries.filter((entry) => isInRange(entry.date, payPeriodStart, payPeriodEnd)),
    [payPeriodEnd, payPeriodStart, timeEntries],
  );

  const outOfScopeEntries = useMemo(
    () => periodEntries.filter((entry) => Boolean(entry.organizationId) && entry.organizationId !== workspaceId),
    [periodEntries, workspaceId],
  );

  const scopedEntries = useMemo(
    () => periodEntries.filter((entry) => !entry.organizationId || entry.organizationId === workspaceId),
    [periodEntries, workspaceId],
  );

  const unassignedEntries = useMemo(
    () => scopedEntries.filter((entry) => !entry.employeeMemberId && !entry.userId && !entry.workerName?.trim()),
    [scopedEntries],
  );

  const unmappedEntries = useMemo(
    () => scopedEntries.filter((entry) => !clientById.has(entry.clientId) || (entry.projectId ? !projectById.has(entry.projectId) : false)),
    [clientById, projectById, scopedEntries],
  );

  const summaryHours = useMemo(() => {
    let regularHours = 0;
    let manualHours = 0;
    let ptoHours = 0;
    let vacationHours = 0;
    let sickHours = 0;
    let holidayHours = 0;
    let unpaidLeaveHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;

    for (const entry of scopedEntries) {
      const hours = Math.max(0, entry.durationHours || 0);
      const bucket = classifyHourBucket(entry);

      if (bucket === "regular") regularHours += hours;
      if (bucket === "manual") manualHours += hours;
      if (bucket === "pto") ptoHours += hours;
      if (bucket === "vacation") vacationHours += hours;
      if (bucket === "sick") sickHours += hours;
      if (bucket === "holiday") holidayHours += hours;
      if (bucket === "unpaid_leave") unpaidLeaveHours += hours;

      if (entry.billable) billableHours += hours;
      else nonBillableHours += hours;
    }

    return {
      regularHours: roundHours(regularHours),
      manualHours: roundHours(manualHours),
      ptoHours: roundHours(ptoHours),
      vacationHours: roundHours(vacationHours),
      sickHours: roundHours(sickHours),
      holidayHours: roundHours(holidayHours),
      unpaidLeaveHours: roundHours(unpaidLeaveHours),
      billableHours: roundHours(billableHours),
      nonBillableHours: roundHours(nonBillableHours),
      totalHours: roundHours(regularHours + manualHours + ptoHours + vacationHours + sickHours + holidayHours + unpaidLeaveHours),
    };
  }, [scopedEntries]);

  const employeeRows = useMemo(() => {
    const grouped = new Map<string, EmployeeExportRow>();

    for (const entry of scopedEntries) {
      const member = entry.employeeMemberId ? memberById.get(entry.employeeMemberId) : undefined;
      const userMember = entry.userId ? memberByUserId.get(entry.userId) : undefined;
      const employeeId = entry.employeeMemberId || entry.userId || entry.workerName?.trim() || "unassigned";
      const employeeName = entry.workerName || member?.name || userMember?.name || "Unassigned";
      const employeeEmail = member?.email || userMember?.email;

      if (!grouped.has(employeeId)) {
        grouped.set(employeeId, {
          employeeId,
          employeeName,
          employeeEmail,
          regularHours: 0,
          manualHours: 0,
          ptoHours: 0,
          vacationHours: 0,
          sickHours: 0,
          holidayHours: 0,
          unpaidLeaveHours: 0,
          totalPaidHours: 0,
          totalUnpaidHours: 0,
          totalHours: 0,
          approvalStatus: "approved",
          sourceTimeEntryIds: [],
          sourceEntries: [],
          projects: [],
        });
      }

      const row = grouped.get(employeeId);
      if (!row) continue;

      const hours = Math.max(0, entry.durationHours || 0);
      const bucket = classifyHourBucket(entry);

      if (bucket === "regular") row.regularHours += hours;
      if (bucket === "manual") row.manualHours += hours;
      if (bucket === "pto") row.ptoHours += hours;
      if (bucket === "vacation") row.vacationHours += hours;
      if (bucket === "sick") row.sickHours += hours;
      if (bucket === "holiday") row.holidayHours += hours;
      if (bucket === "unpaid_leave") row.unpaidLeaveHours += hours;

      if (bucket === "unpaid_leave") row.totalUnpaidHours += hours;
      else row.totalPaidHours += hours;

      row.totalHours += hours;
      row.sourceTimeEntryIds.push(entry.id);
      row.sourceEntries.push(entry);

      const project = entry.projectId ? projectById.get(entry.projectId) : undefined;
      const client = clientById.get(entry.clientId);
      const projectKey = `${entry.projectId ?? "no-project"}::${entry.clientId}`;
      let projectSummary = row.projects.find((item) => `${item.projectId ?? "no-project"}::${item.clientId}` === projectKey);
      if (!projectSummary) {
        projectSummary = {
          projectId: entry.projectId,
          projectName: project?.name,
          clientId: entry.clientId,
          clientName: client?.name,
          hours: 0,
          billableHours: 0,
          nonBillableHours: 0,
        };
        row.projects.push(projectSummary);
      }
      projectSummary.hours += hours;
      if (entry.billable) projectSummary.billableHours += hours;
      else projectSummary.nonBillableHours += hours;
    }

    const approvedStatuses = new Set(["approved", "invoiced", "paid"]);

    return [...grouped.values()]
      .map((row) => {
        const hasRejected = row.sourceEntries.some((entry) => entry.status === "rejected");
        const allApproved = row.sourceEntries.length > 0 && row.sourceEntries.every((entry) => approvedStatuses.has(entry.status));
        row.approvalStatus = hasRejected ? "rejected" : allApproved ? "approved" : "pending";

        row.regularHours = roundHours(row.regularHours);
        row.manualHours = roundHours(row.manualHours);
        row.ptoHours = roundHours(row.ptoHours);
        row.vacationHours = roundHours(row.vacationHours);
        row.sickHours = roundHours(row.sickHours);
        row.holidayHours = roundHours(row.holidayHours);
        row.unpaidLeaveHours = roundHours(row.unpaidLeaveHours);
        row.totalPaidHours = roundHours(row.totalPaidHours);
        row.totalUnpaidHours = roundHours(row.totalUnpaidHours);
        row.totalHours = roundHours(row.totalHours);
        row.projects = row.projects.map((project) => ({
          ...project,
          hours: roundHours(project.hours),
          billableHours: roundHours(project.billableHours),
          nonBillableHours: roundHours(project.nonBillableHours),
        }));

        return row;
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [clientById, memberById, memberByUserId, projectById, scopedEntries]);

  const checklist = useMemo(() => {
    const openClockIns = activeSession.isActive || scopedEntries.some((entry) => ["running", "active", "open"].includes(entry.status));
    const manualEntries = scopedEntries.filter((entry) => classifyHourBucket(entry) === "manual");
    const leaveEntries = scopedEntries.filter((entry) => ["pto", "vacation", "sick", "holiday", "unpaid_leave"].includes(classifyHourBucket(entry)));
    const reviewedStatuses = new Set(["approved", "invoiced", "paid"]);
    const manualUnreviewed = manualEntries.filter((entry) => !reviewedStatuses.has(entry.status));
    const leaveUnreviewed = leaveEntries.filter((entry) => !reviewedStatuses.has(entry.status));
    const approvalsPending = scopedEntries.filter((entry) => !reviewedStatuses.has(entry.status));

    return [
      {
        label: "No open clock-ins",
        status: openClockIns ? "blocked" : "ready",
        detail: openClockIns ? "Stop active sessions and resolve running/open entries before export." : "No active sessions or open entries.",
      },
      {
        label: "All manual entries reviewed",
        status: manualUnreviewed.length === 0 ? "ready" : "warning",
        detail: manualUnreviewed.length === 0 ? "Manual entries are reviewed." : `${manualUnreviewed.length} manual entries still need review.`,
      },
      {
        label: "All PTO/sick/vacation entries reviewed",
        status: leaveUnreviewed.length === 0 ? "ready" : "warning",
        detail: leaveUnreviewed.length === 0 ? "Leave entries are reviewed." : `${leaveUnreviewed.length} leave entries still need review.`,
      },
      {
        label: "All time entries assigned to employees",
        status: unassignedEntries.length === 0 ? "ready" : "blocked",
        detail: unassignedEntries.length === 0 ? "Every entry has an employee." : `${unassignedEntries.length} entries are missing employee assignment.`,
      },
      {
        label: "All time entries scoped to this workspace",
        status: outOfScopeEntries.length === 0 ? "ready" : "blocked",
        detail: outOfScopeEntries.length === 0 ? "All entries match the selected workspace." : `${outOfScopeEntries.length} entries belong to a different workspace.`,
      },
      {
        label: "All projects/clients mapped where required",
        status: unmappedEntries.length === 0 ? "ready" : "blocked",
        detail: unmappedEntries.length === 0 ? "Client/project references are mapped." : `${unmappedEntries.length} entries have missing or invalid client/project links.`,
      },
      {
        label: "Pay period totals calculated",
        status: scopedEntries.length > 0 ? "ready" : "warning",
        detail: scopedEntries.length > 0 ? `Totals built from ${scopedEntries.length} time entries.` : "No entries in this pay period yet.",
      },
      {
        label: "Approvals complete",
        status: approvalsPending.length === 0 ? "ready" : "blocked",
        detail: approvalsPending.length === 0 ? "All entries are approved/invoiced/paid." : `${approvalsPending.length} entries are pending approval or rejected.`,
      },
    ] as Array<{ label: string; status: ChecklistStatus; detail: string }>;
  }, [activeSession.isActive, outOfScopeEntries.length, scopedEntries, unassignedEntries.length, unmappedEntries.length]);

  const hasBlockedChecklistItems = checklist.some((item) => item.status === "blocked");

  const projectCount = useMemo(() => new Set(scopedEntries.map((entry) => entry.projectId).filter(Boolean)).size, [scopedEntries]);
  const clientCount = useMemo(() => new Set(scopedEntries.map((entry) => entry.clientId).filter(Boolean)).size, [scopedEntries]);

  const exportSummary = useMemo(() => ({
    totalEmployees: employeeRows.length,
    totalHours: summaryHours.totalHours,
    regularHours: summaryHours.regularHours,
    manualHours: summaryHours.manualHours,
    ptoHours: summaryHours.ptoHours,
    vacationHours: summaryHours.vacationHours,
    sickHours: summaryHours.sickHours,
    holidayHours: summaryHours.holidayHours,
    unpaidLeaveHours: summaryHours.unpaidLeaveHours,
    billableHours: summaryHours.billableHours,
    nonBillableHours: summaryHours.nonBillableHours,
  }), [employeeRows.length, summaryHours]);

  const buildMissionHubPackage = () => {
    const nowIso = new Date().toISOString();
    const payPeriodStatus: MissionHubTimesheetExportPackage["payPeriod"]["status"] = exportMarked
      ? "exported"
      : hasBlockedChecklistItems
        ? "reviewing"
        : "approved";

    return {
      exportId: `exp-${crypto.randomUUID()}`,
      sourceApp: "timeflow",
      exportType: "mission_hub_timesheet",
      workspaceId,
      organizationId: workspaceId,
      payPeriod: {
        id: `${workspaceId}-${payPeriodStart}-${payPeriodEnd}`,
        startDate: payPeriodStart,
        endDate: payPeriodEnd,
        status: payPeriodStatus,
      },
      summary: exportSummary,
      employees: employeeRows.map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeEmail: row.employeeEmail,
        regularHours: row.regularHours,
        manualHours: row.manualHours,
        ptoHours: row.ptoHours,
        vacationHours: row.vacationHours,
        sickHours: row.sickHours,
        holidayHours: row.holidayHours,
        unpaidLeaveHours: row.unpaidLeaveHours,
        totalPaidHours: row.totalPaidHours,
        totalUnpaidHours: row.totalUnpaidHours,
        projects: row.projects,
        sourceTimeEntryIds: row.sourceTimeEntryIds,
        approvalStatus: row.approvalStatus,
      })),
      createdAt: nowIso,
      createdBy: currentUser.email || currentUser.name || currentUser.id || "unknown",
    } satisfies MissionHubTimesheetExportPackage;
  };

  const handlePreviewExport = () => {
    const payload = buildMissionHubPackage();
    setPreviewPayload(payload);
    toast({ title: "Preview ready", description: "Mission Hub export preview generated." });
  };

  const handleDownloadJson = () => {
    const payload = buildMissionHubPackage();
    const dateTag = toDateOnlyString(new Date());
    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `timeflow-mission-hub-export-${dateTag}.json`,
      "application/json",
    );
    toast({ title: "JSON exported", description: "Mission Hub package downloaded as JSON." });
  };

  const handleDownloadCsv = () => {
    const header = ["Employee", "Regular", "Manual", "PTO", "Sick", "Vacation", "Holiday", "Total", "Status"];
    const lines = [
      header.join(","),
      ...employeeRows.map((row) => [
        toCsvCell(row.employeeName),
        toCsvCell(row.regularHours),
        toCsvCell(row.manualHours),
        toCsvCell(row.ptoHours),
        toCsvCell(row.sickHours),
        toCsvCell(row.vacationHours),
        toCsvCell(row.holidayHours),
        toCsvCell(row.totalHours),
        toCsvCell(row.approvalStatus),
      ].join(",")),
    ];

    const dateTag = toDateOnlyString(new Date());
    downloadTextFile(lines.join("\n"), `timeflow-timesheet-export-${dateTag}.csv`, "text/csv;charset=utf-8");
    toast({ title: "CSV exported", description: "Employee export table downloaded as CSV." });
  };

  const handleDownloadPdfSummary = () => {
    const printWindow = window.open("about:blank", "_blank", "width=980,height=760");
    if (!printWindow) {
      toast({ title: "Popup blocked", description: "Allow popups to open PDF summary preview.", variant: "destructive" });
      return;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>TimeFlow Export Summary</title><style>
      body { font-family: Georgia, 'Times New Roman', serif; margin: 32px; color: #111827; }
      h1 { margin: 0 0 8px; }
      p { margin: 4px 0; }
      table { border-collapse: collapse; width: 100%; margin-top: 20px; }
      th, td { border-bottom: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; }
      th { text-transform: uppercase; font-size: 11px; color: #6b7280; }
      .num { text-align: right; }
    </style><script>window.onload = () => window.print();</script></head><body>
      <h1>Export Center Summary</h1>
      <p>Workspace: ${workspaceOptions.find((workspace) => workspace.id === workspaceId)?.name ?? workspaceId}</p>
      <p>Pay Period: ${payPeriodStart} to ${payPeriodEnd}</p>
      <p>Total Employees: ${exportSummary.totalEmployees}</p>
      <p>Total Hours: ${exportSummary.totalHours}</p>
      <table><thead><tr><th>Employee</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
      ${employeeRows.map((row) => `<tr><td>${row.employeeName}</td><td class="num">${row.totalHours.toFixed(2)}</td><td>${row.approvalStatus}</td></tr>`).join("")}
      </tbody></table>
    </body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    toast({ title: "PDF summary ready", description: "Printable summary opened in a new tab." });
  };

  const handleCreateMissionHubExport = () => {
    if (hasBlockedChecklistItems) {
      toast({ title: "Export blocked", description: "Resolve blocked checklist items before creating export.", variant: "destructive" });
      return;
    }

    const payload = buildMissionHubPackage();
    const dateTag = toDateOnlyString(new Date());
    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `mission-hub-timesheet-export-${dateTag}.json`,
      "application/json",
    );
    setPreviewPayload(payload);
    toast({ title: "Mission Hub export created", description: `Export ${payload.exportId} generated successfully.` });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Export Center"
        subtitle="Prepare approved Time Flow records for Mission Hub, Finance Hub, payroll review, and backup records."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Primary export type for now: Mission Hub Timesheet Export</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">1. Select pay period</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Pay Period Start</Label>
            <Input type="date" value={payPeriodStart} onChange={(event) => setPayPeriodStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pay Period End</Label>
            <Input type="date" value={payPeriodEnd} onChange={(event) => setPayPeriodEnd(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Workspace / Company</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaceOptions.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Export Type</Label>
            <Select value={exportType} onValueChange={(value) => setExportType(value as ExportType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select export type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mission_hub_timesheet">Mission Hub Timesheet Export</SelectItem>
                <SelectItem value="csv_backup">CSV Backup Export</SelectItem>
                <SelectItem value="pdf_summary">PDF Summary Export</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">2. Export readiness checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">3. Pay period summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="text-xs text-muted-foreground uppercase">Total employees</p><p className="text-sm font-semibold">{employeeRows.length}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Total hours</p><p className="text-sm font-semibold">{summaryHours.totalHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Regular hours</p><p className="text-sm font-semibold">{summaryHours.regularHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Manual hours</p><p className="text-sm font-semibold">{summaryHours.manualHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">PTO hours</p><p className="text-sm font-semibold">{summaryHours.ptoHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Vacation hours</p><p className="text-sm font-semibold">{summaryHours.vacationHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Sick hours</p><p className="text-sm font-semibold">{summaryHours.sickHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Holiday hours</p><p className="text-sm font-semibold">{summaryHours.holidayHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Unpaid leave hours</p><p className="text-sm font-semibold">{summaryHours.unpaidLeaveHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Billable hours</p><p className="text-sm font-semibold">{summaryHours.billableHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Non-billable hours</p><p className="text-sm font-semibold">{summaryHours.nonBillableHours.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Total projects</p><p className="text-sm font-semibold">{projectCount}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Total clients</p><p className="text-sm font-semibold">{clientCount}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Unmapped records</p><p className="text-sm font-semibold">{unmappedEntries.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">4. Employee export table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Employee</th>
                  <th className="px-3 py-2 text-right font-medium">Regular</th>
                  <th className="px-3 py-2 text-right font-medium">Manual</th>
                  <th className="px-3 py-2 text-right font-medium">PTO</th>
                  <th className="px-3 py-2 text-right font-medium">Sick</th>
                  <th className="px-3 py-2 text-right font-medium">Vacation</th>
                  <th className="px-3 py-2 text-right font-medium">Holiday</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.length > 0 ? employeeRows.map((row) => {
                  const rowStatus: ChecklistStatus = row.approvalStatus === "rejected" ? "blocked" : row.approvalStatus === "pending" ? "warning" : "ready";
                  const isExpanded = expandedEmployeeId === row.employeeId;

                  return (
                    <>
                      <tr key={row.employeeId} className="border-b">
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.employeeName}</div>
                          {row.employeeEmail ? <div className="text-xs text-muted-foreground">{row.employeeEmail}</div> : null}
                        </td>
                        <td className="px-3 py-2 text-right">{row.regularHours.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{row.manualHours.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{row.ptoHours.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{row.sickHours.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{row.vacationHours.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{row.holidayHours.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{row.totalHours.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${statusClass(rowStatus)}`}>
                            {rowStatus === "ready" ? "Ready" : rowStatus === "warning" ? "Warning" : "Blocked"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedEmployeeId((current) => current === row.employeeId ? null : row.employeeId)}
                          >
                            {isExpanded ? "Hide" : "View"}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={10} className="px-3 py-3">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Source time entries</p>
                                <div className="mt-2 space-y-1">
                                  {row.sourceEntries.map((entry) => (
                                    <div key={entry.id} className="rounded border bg-background px-2 py-1 text-xs">
                                      <span className="font-medium">{entry.date}</span>
                                      <span className="mx-2 text-muted-foreground">{entry.durationHours.toFixed(2)}h</span>
                                      <span>{entry.notes || "No notes"}</span>
                                      <span className="ml-2 text-muted-foreground">({entry.id})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Project breakdown</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {row.projects.map((project) => (
                                    <div key={`${project.projectId ?? "none"}-${project.clientId ?? "none"}`} className="rounded border bg-background px-2 py-1 text-xs">
                                      <p className="font-medium">{project.projectName || "No project"}</p>
                                      <p className="text-muted-foreground">Client: {project.clientName || "Unknown"}</p>
                                      <p>Hours: {project.hours.toFixed(2)} | Billable: {project.billableHours.toFixed(2)} | Non-billable: {project.nonBillableHours.toFixed(2)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                }) : (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No time entries found for the selected pay period and workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">5. Export actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportType !== "mission_hub_timesheet" ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              Mission Hub Timesheet Export is the primary path right now. Backup export actions are available, but creation is only enabled for Mission Hub.
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" onClick={handlePreviewExport}>
              <Eye className="mr-2 h-4 w-4" /> Preview Export
            </Button>
            <Button variant="outline" onClick={handleDownloadCsv}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download CSV
            </Button>
            <Button variant="outline" onClick={handleDownloadJson}>
              <FileJson className="mr-2 h-4 w-4" /> Download JSON
            </Button>
            <Button variant="outline" onClick={handleDownloadPdfSummary}>
              <FileText className="mr-2 h-4 w-4" /> Download PDF Summary
            </Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleCreateMissionHubExport}
              disabled={hasBlockedChecklistItems || exportType !== "mission_hub_timesheet"}
            >
              <Send className="mr-2 h-4 w-4" /> Create Mission Hub Export
            </Button>
            <Button
              variant="outline"
              disabled={hasBlockedChecklistItems}
              onClick={() => {
                setExportMarked(true);
                toast({ title: "Marked exported", description: "Pay period export status set to exported." });
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Exported
            </Button>
          </div>

          {hasBlockedChecklistItems ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Export is blocked until all blocked checklist items are resolved.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {previewPayload ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Export package preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">{JSON.stringify(previewPayload, null, 2)}</pre>
            <Separator className="my-3" />
            <Button variant="outline" onClick={() => downloadTextFile(JSON.stringify(previewPayload, null, 2), `preview-export-${toDateOnlyString(new Date())}.json`, "application/json")}>
              <Download className="mr-2 h-4 w-4" /> Download This Preview
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
