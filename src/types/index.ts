// ============================================================
// User & Authentication Types
// ============================================================

export type UserRole = "super_admin" | "admin" | "engineer" | "customer"

export interface UserProfile {
  id: string
  user_id: string
  email?: string
  role: UserRole
  name: string
  mobile: string
  address: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  profile: UserProfile | null
}

// ============================================================
// Machine Types
// ============================================================

export interface Machine {
  id: string
  serial_number: string
  model_number: string
  name: string
  specs: string
  owner_id: string
  owner_name?: string
  purchase_date: string
  status: "active" | "inactive" | "under_service" | "retired"
  created_at: string
  updated_at: string
}

// ============================================================
// Part Types
// ============================================================

export interface Part {
  id: string
  part_number: string
  name: string
  compatible_models: string
  stock_status: "in_stock" | "low_stock" | "out_of_stock"
  assigned_machine_id?: string
  created_at: string
  updated_at: string
}

// ============================================================
// Issue Types
// ============================================================

export type IssueUrgency = "low" | "medium" | "high" | "critical"
export type IssueStatus = "submitted" | "under_review" | "assigned" | "resolved"

export interface Issue {
  id: string
  customer_id: string
  machine_id: string
  description: string
  urgency: IssueUrgency
  status: IssueStatus
  assigned_engineer_id?: string
  tentative_days?: number
  created_at: string
  updated_at: string
  // Joined fields
  machine_name?: string
  machine_model?: string
  customer_name?: string
  engineer_name?: string
}

// ============================================================
// Issue Media Types
// ============================================================

export interface IssueMedia {
  id: string
  issue_id: string
  file_url: string
  file_type: "image" | "video"
  created_at: string
}

// ============================================================
// Service Report Types
// ============================================================

export interface ServiceReport {
  id: string
  issue_id: string
  machine_id: string
  engineer_id: string
  service_details: string
  parts_replaced: string
  next_service_date: string
  remarks: string
  actual_resolution_date: string
  pdf_url?: string
  created_at: string
  updated_at: string
  // Joined fields
  machine_name?: string
  machine_model?: string
  engineer_name?: string
}

// ============================================================
// Machine History Types
// ============================================================

export interface MachineHistoryEntry {
  id: string
  machine_id: string
  event_type: "issue_raised" | "engineer_assigned" | "service_completed" | "part_replaced" | "note"
  description: string
  reference_id?: string
  created_by?: string
  created_at: string
}

// ============================================================
// Engineer Assignment Types
// ============================================================

export interface EngineerAssignment {
  id: string
  engineer_id: string
  customer_id: string
  machine_id: string
  issue_id: string
  assigned_by_admin_id: string
  status: "pending" | "approved" | "revoked"
  created_at: string
  updated_at: string
  // Joined fields
  engineer_name?: string
  customer_name?: string
  machine_name?: string
}

// ============================================================
// Notification Types
// ============================================================

export interface Notification {
  id: string
  user_id: string
  type: "issue_submitted" | "engineer_assigned" | "service_completed" | "report_generated" | "general"
  title: string
  message: string
  read: boolean
  reference_id?: string
  created_at: string
}

// ============================================================
// Dashboard Stats Types
// ============================================================

export interface DashboardStats {
  totalMachines: number
  activeIssues: number
  totalEngineers: number
  totalCustomers: number
  resolvedThisMonth: number
  pendingAssignments: number
}

// ============================================================
// Admin types for Super Admin
// ============================================================

export interface AdminConfig {
  id: string
  user_id: string
  can_manage_engineers: boolean
  can_manage_customers: boolean
  can_manage_machines: boolean
  can_manage_parts: boolean
  can_view_reports: boolean
  name?: string
  email?: string
}

export interface AppUser {
  id: string
  email: string
  profile?: UserProfile
  created_at?: string
}
