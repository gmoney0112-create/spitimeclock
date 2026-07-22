"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { redirectWithError } from "@/lib/action-error";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    headers: {
      // Nominatim's usage policy requires a descriptive User-Agent.
      "User-Agent": "StarsPI-TimeClock/1.0 (internal field-ops scheduling app)",
    },
  });

  if (!response.ok) {
    throw new Error("Geocoding service unavailable — try again in a moment.");
  }

  const results = (await response.json()) as { lat: string; lon: string }[];
  if (results.length === 0) {
    throw new Error(`Couldn't find coordinates for "${address}" — check the address and try again.`);
  }

  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

export async function addSite(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "");
  const address = String(formData.get("address") ?? "");
  const geofence_radius_meters = Number(formData.get("geofence_radius_meters") ?? 150);
  const client_notes = String(formData.get("client_notes") ?? "") || null;

  let coords: { lat: number; lng: number };
  try {
    coords = await geocodeAddress(address);
  } catch (err) {
    redirectWithError("/admin/sites", err instanceof Error ? err.message : "Geocoding failed.");
  }

  const { error } = await supabase.from("sites").insert({
    name,
    address,
    latitude: coords.lat,
    longitude: coords.lng,
    geofence_radius_meters,
    client_notes,
  });

  if (error) redirectWithError("/admin/sites", error.message);

  revalidatePath("/admin/sites");
}

export async function updateSite(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const geofence_radius_meters = Number(formData.get("geofence_radius_meters") ?? 150);
  const client_notes = String(formData.get("client_notes") ?? "") || null;

  const { error } = await supabase
    .from("sites")
    .update({ geofence_radius_meters, client_notes })
    .eq("id", id);

  if (error) redirectWithError("/admin/sites", error.message);

  revalidatePath("/admin/sites");
}
