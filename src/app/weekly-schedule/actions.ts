"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { redirectWithError } from "@/lib/action-error";
import { addDays } from "@/lib/week";

export async function addAssignedShift(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const employee_id = String(formData.get("employee_id") ?? "");
  const title = String(formData.get("title") ?? "");
  const date = String(formData.get("date") ?? "");
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");
  const role_needed = String(formData.get("role_needed") ?? "") || null;
  const site_id = String(formData.get("site_id") ?? "") || null;

  const { error } = await supabase.from("shifts").insert({
    title,
    date,
    start_time,
    end_time,
    role_needed,
    site_id,
    posted_by: admin.id,
    schedule_type: "assigned",
    assigned_to: employee_id,
    status: "filled",
  });

  if (error) redirectWithError("/weekly-schedule", error.message);

  revalidatePath("/weekly-schedule");
  revalidatePath("/schedule");
}

export async function removeAssignedShift(shiftId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("schedule_type", "assigned");

  if (error) redirectWithError("/weekly-schedule", error.message);

  revalidatePath("/weekly-schedule");
  revalidatePath("/schedule");
}

export async function copyWeekForward(weekStart: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const weekEnd = addDays(weekStart, 6);

  const { data: shifts, error: fetchError } = await supabase
    .from("shifts")
    .select("title, date, start_time, end_time, role_needed, site_id, assigned_to")
    .eq("schedule_type", "assigned")
    .neq("status", "cancelled")
    .gte("date", weekStart)
    .lte("date", weekEnd);

  if (fetchError) redirectWithError("/weekly-schedule", fetchError.message);

  const rows = (shifts ?? []).map((s) => ({
    title: s.title,
    date: addDays(s.date, 7),
    start_time: s.start_time,
    end_time: s.end_time,
    role_needed: s.role_needed,
    site_id: s.site_id,
    assigned_to: s.assigned_to,
    posted_by: admin.id,
    schedule_type: "assigned" as const,
    status: "filled" as const,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("shifts").insert(rows);
    if (error) redirectWithError("/weekly-schedule", error.message);
  }

  revalidatePath("/weekly-schedule");
  revalidatePath("/schedule");
}
