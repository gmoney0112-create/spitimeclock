// Hand-written to match supabase/migrations/20260721000000_initial_schema.sql.
// Regenerate with `supabase gen types typescript` once CLI access to the
// project is available, and this file can be replaced wholesale.

export type EmployeeRole = "admin" | "office_manager" | "employee";
export type PayType = "hourly" | "salary";
export type EmployeeStatus = "active" | "inactive";
export type PunchType = "clock_in" | "clock_out" | "break_start" | "break_end";
export type PunchSource = "web_self" | "kiosk" | "manual_admin_entry";
export type TimesheetStatus = "pending_review" | "approved" | "exported";
export type PayPeriodStatus = "open" | "closed" | "exported";
export type ShiftStatus = "open" | "claimed" | "filled" | "cancelled";
export type ShiftClaimStatus = "pending" | "approved" | "denied";
export type ShiftScheduleType = "marketplace" | "assigned";

export interface Employee {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: EmployeeRole;
  pay_type: PayType;
  hourly_rate: number | null;
  pin_code: string | null;
  status: EmployeeStatus;
  hire_date: string;
  created_at: string;
}

export type MyProfile = Omit<
  Employee,
  "pay_type" | "hourly_rate" | "pin_code"
>;

export interface TimePunch {
  id: string;
  employee_id: string;
  punch_type: PunchType;
  timestamp: string;
  source: PunchSource;
  notes: string | null;
  created_at: string;
}

export interface PunchCorrection {
  id: string;
  original_punch_id: string | null;
  employee_id: string;
  corrected_timestamp: string;
  reason: string;
  edited_by: string;
  created_at: string;
}

export interface Timesheet {
  id: string;
  employee_id: string;
  pay_period_id: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  status: TimesheetStatus;
  approved_by: string | null;
  approved_at: string | null;
}

export interface PayPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: PayPeriodStatus;
}

export interface Shift {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  role_needed: string | null;
  status: ShiftStatus;
  posted_by: string;
  site_id: string | null;
  schedule_type: ShiftScheduleType;
  assigned_to: string | null;
  created_at: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  client_notes: string | null;
  created_at: string;
}

export interface ShiftClaim {
  id: string;
  shift_id: string;
  employee_id: string;
  status: ShiftClaimStatus;
  claimed_at: string;
  decided_by: string | null;
  decided_at: string | null;
}
