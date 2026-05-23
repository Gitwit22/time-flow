import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnlyString } from "@/lib/date";

interface EmployeeOption {
  id: string;
  name: string;
  email?: string;
}

interface TimeOffRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId: string;
  employees: EmployeeOption[];
  onSubmit: (value: {
    employeeId: string;
    leaveType: "pto" | "vacation" | "sick" | "holiday" | "unpaid" | "bereavement" | "admin_leave";
    startDate: string;
    endDate: string;
    hoursRequested: number;
    reason?: string;
    autoApprove?: boolean;
  }) => Promise<void>;
}

export function TimeOffRequestDialog({
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
  employees,
  onSubmit,
}: TimeOffRequestDialogProps) {
  const [employeeId, setEmployeeId] = useState(currentUserId);
  const [leaveType, setLeaveType] = useState<"pto" | "vacation" | "sick" | "holiday" | "unpaid" | "bereavement" | "admin_leave">("pto");
  const [startDate, setStartDate] = useState(toDateOnlyString(new Date()));
  const [endDate, setEndDate] = useState(toDateOnlyString(new Date()));
  const [hoursRequested, setHoursRequested] = useState("8");
  const [reason, setReason] = useState("");
  const [autoApprove, setAutoApprove] = useState(isAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const employeeOptions = useMemo(() => {
    if (employees.length > 0) return employees;
    return [{ id: currentUserId, name: "Current User" }];
  }, [currentUserId, employees]);

  const handleSubmit = async () => {
    setError("");

    const parsedHours = Number(hoursRequested);
    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError("Hours requested must be greater than 0.");
      return;
    }
    if (endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        employeeId,
        leaveType,
        startDate,
        endDate,
        hoursRequested: Number(parsedHours.toFixed(2)),
        reason: reason.trim() || undefined,
        autoApprove: isAdmin ? autoApprove : false,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Time</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Time Off Type</Label>
            <Select value={leaveType} onValueChange={(value) => setLeaveType(value as typeof leaveType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pto">PTO</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                <SelectItem value="bereavement">Bereavement</SelectItem>
                <SelectItem value="admin_leave">Admin Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={!isAdmin}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Hours Requested</Label>
            <Input type="number" min="0.25" step="0.25" value={hoursRequested} onChange={(event) => setHoursRequested(event.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Reason / Notes</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-20 resize-none" />
          </div>

          {isAdmin ? (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoApprove} onChange={(event) => setAutoApprove(event.target.checked)} />
              Approve immediately and generate leave time entry
            </label>
          ) : null}

          {error ? <div className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit} disabled={saving}>
            {saving ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
