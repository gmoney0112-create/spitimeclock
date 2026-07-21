"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import type { PunchType } from "@/types/database";

export async function createPayPeriod(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "");

  const { error } = await supabase.from("pay_periods").insert({ start_date, end_date });
  if (error) return { error: error.message };

  revalidatePath("/admin/timesheets");
  return { error: null };
}

export async function calculateTimesheets(payPeriodId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("calculate_timesheets", {
    p_pay_period_id: payPeriodId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/timesheets");
  return { error: null };
}

export async function approveTimesheet(timesheetId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("timesheets")
    .update({
      status: "approved",
      approved_by: admin.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", timesheetId);

  if (error) return { error: error.message };

  revalidatePath("/admin/timesheets");
  return { error: null };
}

export async function addMissingPunch(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const employee_id = String(formData.get("employee_id") ?? "");
  const punch_type = String(formData.get("punch_type") ?? "") as PunchType;
  const local_timestamp = String(formData.get("local_timestamp") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const { error } = await supabase.rpc("add_missing_punch", {
    p_employee_id: employee_id,
    p_punch_type: punch_type,
    p_local_timestamp: local_timestamp,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/timesheets");
  return { error: null };
}

export async function correctPunch(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const punch_id = String(formData.get("punch_id") ?? "");
  const local_timestamp = String(formData.get("local_timestamp") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const { error } = await supabase.rpc("correct_punch", {
    p_punch_id: punch_id,
    p_local_timestamp: local_timestamp,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/timesheets");
  return { error: null };
}
