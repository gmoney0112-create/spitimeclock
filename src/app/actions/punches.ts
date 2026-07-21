"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PunchType } from "@/types/database";

async function insertPunch(punchType: PunchType) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("my_profile")
    .select("id")
    .single();

  if (profileError || !profile) {
    return { error: "Could not resolve your employee profile." };
  }

  const { error } = await supabase.from("time_punches").insert({
    employee_id: profile.id,
    punch_type: punchType,
    source: "web_self",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { error: null };
}

export async function clockIn() {
  return insertPunch("clock_in");
}

export async function clockOut() {
  return insertPunch("clock_out");
}
