import type { OrganizationMemberRole, UserRole } from "@/types";

export function normalizeOrganizationRole(role: UserRole): OrganizationMemberRole {
  if (
    role === "owner"
    || role === "admin"
    || role === "manager"
    || role === "payroll_reviewer"
    || role === "employee"
    || role === "auditor"
    || role === "viewer"
  ) {
    return role;
  }

  if (role === "client_viewer") {
    return "viewer";
  }

  return "owner";
}

export function canManageTeam(role: UserRole) {
  return role === "owner" || role === "admin";
}

export function canManageWorkspace(role: UserRole) {
  return role === "contractor" || role === "owner" || role === "admin" || role === "manager";
}

export function canManageProjects(role: UserRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canApproveTime(role: UserRole) {
  return role === "owner" || role === "admin" || role === "manager" || role === "payroll_reviewer";
}

export function canEditTime(role: UserRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canGenerateInvoices(role: UserRole) {
  return role === "contractor" || role === "owner" || role === "admin" || role === "manager" || role === "payroll_reviewer";
}

export function canViewAdminWorkspace(role: UserRole) {
  return (
    role === "owner"
    || role === "admin"
    || role === "manager"
    || role === "payroll_reviewer"
    || role === "auditor"
    || role === "viewer"
    || role === "contractor"
  );
}

export function isEmployeeRole(role: UserRole) {
  return role === "employee";
}

export function isViewerLikeRole(role: UserRole) {
  return role === "viewer" || role === "client_viewer";
}
