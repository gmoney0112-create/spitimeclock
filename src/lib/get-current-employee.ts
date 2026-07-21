import { createClient } from "@/lib/supabase/server";
import type { MyProfile } from "@/types/database";

export async function getCurrentEmployee(): Promise<MyProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("my_profile").select("*").single();
  return data;
}
