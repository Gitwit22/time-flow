/**
 * crossProgram.ts
 * Shared identity, scoping, audit, and pipeline types for
 * cross-program integration between TimeFlow, Mission Hub, and Finance Hub.
 */

// ---------------------------------------------------------------------------
// 1. Shared Identity Map
//    One record per real person that exists across multiple programs.
// ---------------------------------------------------------------------------

export interface SharedIdentityMap {
  /** Canonical cross-program person identifier */
  sharedPersonId: string;
  organizationId: string;
  workspaceId?: string;

  /** TimeFlow OrganizationMember.id */
  timeFlowEmployeeId?: string;
  /** Mission Hub Personnel.id */
  missionHubStaffId?: string;
  /** Finance Hub PayeeProfile.id */
  financeHubPayeeId?: string;
  /** ADP employee file number */
  adpEmployeeFileNumber?: string;

  /** Canonical email — used for fuzzy-matching across apps */
  email: string;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 2. Cross-Program Record Scope
//    Every imported/exported record should carry these fields.
// ---------------------------------------------------------------------------

export type SourceApp = "timeflow" | "mission-hub" | "finance-hub" | "adp" | "manual";

export interface CrossProgramScope {
  organizationId: string;
  workspaceId?: string;
  sourceApp: SourceApp;
  /** ID of the originating record in the source app */
  sourceRecordId?: string;
  /** Entity type in the source app (e.g. "TimeEntry", "Personnel", "PayrollBatch") */
  sourceRecordType?: string;
}

// ---------------------------------------------------------------------------
// 3. Audit Trail
//    Every major action on a cross-program record must append one of these.
// ---------------------------------------------------------------------------

export type CrossProgramAuditAction =
  | "created"
  | "edited"
  | "approved"
  | "denied"
  | "locked"
  | "unlocked"
  | "exported"
  | "imported"
  | "mapped"
  | "rejected"
  | "re-exported"
  | "uploaded_to_adp"
  | "reconciled";

export interface CrossProgramAuditEvent {
  id: string;
  action: CrossProgramAuditAction;
  recordType: string;
  recordId: string;
  userId: string;
  userName: string;
  timestamp: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string;
  sourceApp: SourceApp;
}

// ---------------------------------------------------------------------------
// 4. Data Flow Pipeline Statuses
// ---------------------------------------------------------------------------

/**
 * TimeFlow payroll pipeline:
 *   Open → Approved → Locked → Exported
 */
export type TimeFlowPayrollPipelineStatus =
  | "open"
  | "approved"
  | "locked"
  | "exported";

/**
 * Mission Hub payroll pipeline:
 *   Imported → Mapped → Reviewed → Sent to Finance
 */
export type MissionHubPayrollPipelineStatus =
  | "imported"
  | "mapped"
  | "reviewed"
  | "sent_to_finance";

/**
 * Finance Hub / ADP pipeline:
 *   Received → Validated → Exported to ADP → ADP Accepted → Reconciled
 */
export type FinanceHubPayrollPipelineStatus =
  | "received"
  | "validated"
  | "exported_to_adp"
  | "adp_accepted"
  | "reconciled";
