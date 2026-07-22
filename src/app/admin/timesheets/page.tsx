import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createPayPeriod,
  calculateTimesheets,
  approveTimesheet,
  addMissingPunch,
  correctPunch,
} from "@/app/admin/actions";
import type { PayPeriod, TimesheetStatus } from "@/types/database";

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const { period: periodParam } = await searchParams;

  const { data: payPeriods } = await supabase
    .from("pay_periods")
    .select("*")
    .order("start_date", { ascending: false })
    .returns<PayPeriod[]>();

  const selectedPeriod =
    payPeriods?.find((p) => p.id === periodParam) ?? payPeriods?.[0] ?? null;

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name");

  const { data: flaggedPunches } = await supabase.rpc("list_flagged_punches");

  let timesheetRows: {
    id: string;
    employee_id: string;
    full_name: string;
    regular_hours: number;
    overtime_hours: number;
    total_hours: number;
    status: TimesheetStatus;
  }[] = [];
  let missingPunches: {
    employee_id: string;
    full_name: string;
    punch_id: string;
    punch_timestamp: string;
  }[] = [];
  let recentPunches: {
    id: string;
    punch_type: string;
    timestamp: string;
    full_name: string;
  }[] = [];

  if (selectedPeriod) {
    const [{ data: timesheets }, { data: missing }, { data: punches }] =
      await Promise.all([
        supabase
          .from("timesheets")
          .select("id, employee_id, regular_hours, overtime_hours, total_hours, status, employees!timesheets_employee_id_fkey(full_name)")
          .eq("pay_period_id", selectedPeriod.id),
        supabase.rpc("list_missing_punches", {
          p_pay_period_id: selectedPeriod.id,
        }),
        supabase
          .from("time_punches")
          .select("id, punch_type, timestamp, employees(full_name)")
          .gte("timestamp", selectedPeriod.start_date)
          .lt(
            "timestamp",
            new Date(
              new Date(selectedPeriod.end_date).getTime() + 86400000,
            )
              .toISOString()
              .slice(0, 10),
          )
          .order("timestamp", { ascending: false }),
      ]);

    timesheetRows = (timesheets ?? [])
      .map((row) => {
        const employee = Array.isArray(row.employees)
          ? row.employees[0]
          : row.employees;
        return {
          id: row.id,
          employee_id: row.employee_id,
          full_name: employee?.full_name ?? "Unknown",
          regular_hours: row.regular_hours,
          overtime_hours: row.overtime_hours,
          total_hours: row.total_hours,
          status: row.status,
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    missingPunches = missing ?? [];

    recentPunches = (punches ?? []).map((row) => {
      const employee = Array.isArray(row.employees)
        ? row.employees[0]
        : row.employees;
      return {
        id: row.id,
        punch_type: row.punch_type,
        timestamp: row.timestamp,
        full_name: employee?.full_name ?? "Unknown",
      };
    });
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Timesheet Review</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pay Periods</CardTitle>
          <CardDescription>
            Select a period below, or create a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(payPeriods ?? []).map((p) => (
              <Link key={p.id} href={`/admin/timesheets?period=${p.id}`}>
                <Badge
                  variant={p.id === selectedPeriod?.id ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  {p.start_date} → {p.end_date} ({p.status})
                </Badge>
              </Link>
            ))}
            {(payPeriods ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No pay periods yet — create one below.
              </p>
            )}
          </div>
          <form
            action={async (formData: FormData) => {
              "use server";
              await createPayPeriod(formData);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" name="end_date" type="date" required />
            </div>
            <Button type="submit" variant="secondary">
              Create pay period
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flagged Punches (Out of Geofence)</CardTitle>
          <CardDescription>
            Clock-ins/outs recorded outside the assigned site&apos;s radius —
            recorded, not blocked, but worth a look.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(flaggedPunches ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None flagged.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {(flaggedPunches ?? []).map(
                (p: {
                  punch_id: string;
                  full_name: string;
                  shift_title: string | null;
                  site_name: string | null;
                  punch_type: string;
                  punch_timestamp: string;
                }) => (
                  <li key={p.punch_id}>
                    {p.full_name} — {p.punch_type} at{" "}
                    {new Date(p.punch_timestamp).toLocaleString()}
                    {p.site_name ? ` — expected near ${p.site_name}` : ""}
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedPeriod && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Hours: {selectedPeriod.start_date} → {selectedPeriod.end_date}
              </CardTitle>
              <CardDescription>
                Regular/overtime split at 40hrs/week, nearest-15-minute rounding.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <form
                  action={async () => {
                    "use server";
                    await calculateTimesheets(selectedPeriod.id);
                  }}
                >
                  <Button type="submit" size="sm">
                    Calculate / Refresh Hours
                  </Button>
                </form>
                <Button asChild size="sm" variant="outline">
                  <a href={`/admin/timesheets/export?period=${selectedPeriod.id}`}>
                    Export Approved Hours (CSV)
                  </a>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Employee</th>
                      <th className="py-2 pr-4">Regular</th>
                      <th className="py-2 pr-4">Overtime</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {timesheetRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{row.full_name}</td>
                        <td className="py-2 pr-4">{row.regular_hours}</td>
                        <td className="py-2 pr-4">{row.overtime_hours}</td>
                        <td className="py-2 pr-4">{row.total_hours}</td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={row.status === "approved" ? "success" : "secondary"}
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          {row.status === "pending_review" && (
                            <form
                              action={async () => {
                                "use server";
                                await approveTimesheet(row.id);
                              }}
                            >
                              <Button type="submit" size="sm" variant="outline">
                                Approve
                              </Button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                    {timesheetRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-muted-foreground">
                          No timesheets yet — click Calculate / Refresh Hours.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missing Punches</CardTitle>
              <CardDescription>
                Clock-ins with no matching clock-out — excluded from hours above
                until corrected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {missingPunches.length === 0 ? (
                <p className="text-sm text-muted-foreground">None flagged.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {missingPunches.map((m) => (
                    <li key={m.punch_id}>
                      {m.full_name} — clocked in{" "}
                      {new Date(m.punch_timestamp).toLocaleString()}, no clock-out
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Missing Punch</CardTitle>
              <CardDescription>
                Use for a punch that never happened (e.g. forgotten clock-out).
                Logged to the audit trail with your reason.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await addMissingPunch(formData);
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor="employee_id">Employee</Label>
                  <select
                    id="employee_id"
                    name="employee_id"
                    required
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {(employees ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="punch_type">Type</Label>
                  <select
                    id="punch_type"
                    name="punch_type"
                    required
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="clock_in">Clock In</option>
                    <option value="clock_out">Clock Out</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="local_timestamp">Time (office local time)</Label>
                  <Input
                    id="local_timestamp"
                    name="local_timestamp"
                    type="datetime-local"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="reason">Reason</Label>
                  <Input id="reason" name="reason" required className="min-w-48" />
                </div>
                <Button type="submit" size="sm">
                  Add Punch
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Correct a Punch</CardTitle>
              <CardDescription>
                Fixes a wrong time on an existing punch. The original punch is
                never overwritten — this adds a correction record.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await correctPunch(formData);
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor="punch_id">Punch</Label>
                  <select
                    id="punch_id"
                    name="punch_id"
                    required
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {recentPunches.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} — {p.punch_type} —{" "}
                        {new Date(p.timestamp).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="correct_local_timestamp">
                    Corrected time (office local time)
                  </Label>
                  <Input
                    id="correct_local_timestamp"
                    name="local_timestamp"
                    type="datetime-local"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="correct_reason">Reason</Label>
                  <Input
                    id="correct_reason"
                    name="reason"
                    required
                    className="min-w-48"
                  />
                </div>
                <Button type="submit" size="sm">
                  Save Correction
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
