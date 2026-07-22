"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PunchType } from "@/types/database";

export interface PunchOptions {
  shiftId?: string;
  latitude?: number;
  longitude?: number;
}

async function insertPunch(punchType: PunchType, opts?: PunchOptions) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("my_profile")
    .select("id")
    .single();

  if (profileError || !profile) {
    return { error: "Could not resolve your employee profile.", withinGeofence: null };
  }

  const { data, error } = await supabase
    .from("time_punches")
    .insert({
      employee_id: profile.id,
      punch_type: punchType,
      source: "web_self",
      shift_id: opts?.shiftId ?? null,
      latitude: opts?.latitude ?? null,
      longitude: opts?.longitude ?? null,
    })
    .select("within_geofence")
    .single();

  if (error) {
    return { error: error.message, withinGeofence: null };
  }

  revalidatePath("/");
  return { error: null, withinGeofence: data?.within_geofence as boolean | null };
}

export async function clockIn(opts?: PunchOptions) {
  return insertPunch("clock_in", opts);
}

export async function clockOut(opts?: PunchOptions) {
  return insertPunch("clock_out", opts);
}
