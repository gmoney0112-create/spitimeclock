"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { redirectWithError } from "@/lib/action-error";
import type { EmployeeRole, PayType } from "@/types/database";

export async function addEmployee(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const full_name = String(formData.get("full_name") ?? "");
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "employee") as EmployeeRole;
  const pay_type = String(formData.get("pay_type") ?? "hourly") as PayType;
  const hourly_rate = formData.get("hourly_rate")
    ? Number(formData.get("hourly_rate"))
    : null;
  const hire_date = String(formData.get("hire_date") ?? "");

  const { error } = await supabase.from("employees").insert({
    full_name,
    email,
    role,
    pay_type,
    hourly_rate,
    hire_date: hire_date || undefined,
  });

  if (error) {
    const message = error.code === "23505" ? `${email} is already in use.` : error.message;
    redirectWithError("/admin/employees", message);
  }

  revalidatePath("/admin/employees");
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "employee") as EmployeeRole;
  const pay_type = String(formData.get("pay_type") ?? "hourly") as PayType;
  const hourly_rate = formData.get("hourly_rate")
    ? Number(formData.get("hourly_rate"))
    : null;

  const { error } = await supabase
    .from("employees")
    .update({ role, pay_type, hourly_rate })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/employees");
  return { error: null };
}

export async function setEmployeeStatus(id: string, status: "active" | "inactive") {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("employees").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/employees");
  return { error: null };
}
