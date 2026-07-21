"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { getCurrentEmployee } from "@/lib/get-current-employee";

export async function postShift(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "");
  const date = String(formData.get("date") ?? "");
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");
  const role_needed = String(formData.get("role_needed") ?? "") || null;

  const { error } = await supabase.from("shifts").insert({
    title,
    date,
    start_time,
    end_time,
    role_needed,
    posted_by: admin.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/shifts");
  return { error: null };
}

export async function claimShift(shiftId: string) {
  const profile = await getCurrentEmployee();
  if (!profile) return { error: "No employee profile found." };

  const supabase = await createClient();
  const { error } = await supabase.from("shift_claims").insert({
    shift_id: shiftId,
    employee_id: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/shifts");
  return { error: null };
}

export async function approveClaim(claimId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_shift_claim", {
    p_claim_id: claimId,
  });
  if (error) return { error: error.message };

  revalidatePath("/shifts");
  revalidatePath("/schedule");
  return { error: null };
}

export async function denyClaim(claimId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("deny_shift_claim", {
    p_claim_id: claimId,
  });
  if (error) return { error: error.message };

  revalidatePath("/shifts");
  return { error: null };
}

export async function cancelShift(shiftId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId);

  if (error) return { error: error.message };

  revalidatePath("/shifts");
  return { error: null };
}
