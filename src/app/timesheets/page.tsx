import Link from "next/link";
import { getCurrentEmployee } from "@/lib/get-current-employee";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TimesheetStatus } from "@/types/database";

export default async function MyTimesheetsPage() {
  const profile = await getCurrentEmployee();

  if (!profile) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground">
          Signed in, but no employee profile was found. Contact your admin.
        </p>
      </main>
    );
  }

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("timesheets")
    .select(
      "id, regular_hours, overtime_hours, total_hours, status, pay_periods(start_date, end_date)",
    )
    .eq("employee_id", profile.id);

  const timesheets = (rows ?? [])
    .map((row) => {
      const period = Array.isArray(row.pay_periods)
        ? row.pay_periods[0]
        : row.pay_periods;
      return {
        id: row.id,
        regular_hours: row.regular_hours as number,
        overtime_hours: row.overtime_hours as number,
        total_hours: row.total_hours as number,
        status: row.status as TimesheetStatus,
        start_date: period?.start_date ?? "",
        end_date: period?.end_date ?? "",
      };
    })
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Timesheets</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
      </div>

      {timesheets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No timesheets yet — hours show up here once an admin calculates a
          pay period you worked in.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {timesheets.map((ts) => (
            <Card key={ts.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {ts.start_date} → {ts.end_date}
                  <Badge variant={ts.status === "approved" ? "success" : "secondary"}>
                    {ts.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {ts.regular_hours} regular + {ts.overtime_hours} overtime ={" "}
                  {ts.total_hours} total hours
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
