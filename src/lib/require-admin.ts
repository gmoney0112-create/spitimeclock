import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/get-current-employee";
import type { MyProfile } from "@/types/database";

export async function requireAdmin(): Promise<MyProfile> {
  const profile = await getCurrentEmployee();

  if (!profile || (profile.role !== "admin" && profile.role !== "office_manager")) {
    redirect("/");
  }

  return profile;
}
