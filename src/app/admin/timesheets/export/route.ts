import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/get-current-employee";

function csvField(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentEmployee();
  if (!profile || (profile.role !== "admin" && profile.role !== "office_manager")) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const payPeriodId = request.nextUrl.searchParams.get("period");
  if (!payPeriodId) {
    return NextResponse.json({ error: "missing period" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("start_date, end_date")
    .eq("id", payPeriodId)
    .single();

  if (!payPeriod) {
    return NextResponse.json({ error: "pay period not found" }, { status: 404 });
  }

  const { data: timesheets, error } = await supabase
    .from("timesheets")
    .select("regular_hours, overtime_hours, total_hours, status, employees(full_name, email)")
    .eq("pay_period_id", payPeriodId)
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = [
    "Employee Name",
    "Email",
    "Pay Period Start",
    "Pay Period End",
    "Regular Hours",
    "Overtime Hours",
    "Total Hours",
  ];

  const rows = (timesheets ?? []).map((row) => {
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    return [
      employee?.full_name ?? "",
      employee?.email ?? "",
      payPeriod.start_date,
      payPeriod.end_date,
      String(row.regular_hours),
      String(row.overtime_hours),
      String(row.total_hours),
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(csvField).join(","))
    .join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${payPeriod.start_date}-to-${payPeriod.end_date}.csv"`,
    },
  });
}
