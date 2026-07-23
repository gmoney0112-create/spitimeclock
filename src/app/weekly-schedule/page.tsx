import Link from "next/link";
import { getCurrentEmployee } from "@/lib/get-current-employee";
import { createClient } from "@/lib/supabase/server";
import { mondayOf, addDays, todayISO } from "@/lib/week";
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
import { addAssignedShift, removeAssignedShift, copyWeekForward } from "./actions";
import type { Site } from "@/types/database";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default async function WeeklySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string }>;
}) {
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

  const isAdmin = profile.role === "admin" || profile.role === "office_manager";
  const supabase = await createClient();
  const { week: weekParam, error } = await searchParams;

  const weekStart = mondayOf(weekParam || todayISO());
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const { data: weekShifts } = await supabase
    .from("shifts")
    .select(
      "id, title, date, start_time, end_time, role_needed, employees!shifts_assigned_to_fkey(full_name), sites(name)",
    )
    .eq("schedule_type", "assigned")
    .neq("status", "cancelled")
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .order("date")
    .order("start_time");

  const shiftsByDate = new Map<
    string,
    { id: string; title: string; start_time: string; end_time: string; role_needed: string | null; full_name: string; siteName: string | null }[]
  >();
  for (const s of weekShifts ?? []) {
    const employee = Array.isArray(s.employees) ? s.employees[0] : s.employees;
    const site = Array.isArray(s.sites) ? s.sites[0] : s.sites;
    const list = shiftsByDate.get(s.date) ?? [];
    list.push({
      id: s.id,
      title: s.title,
      start_time: s.start_time,
      end_time: s.end_time,
      role_needed: s.role_needed,
      full_name: employee?.full_name ?? "Unassigned",
      siteName: site?.name ?? null,
    });
    shiftsByDate.set(s.date, list);
  }

  let employees: { id: string; full_name: string }[] = [];
  let sites: Pick<Site, "id" | "name">[] = [];
  if (isAdmin) {
    const [{ data: employeeRows }, { data: siteRows }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name"),
      supabase.from("sites").select("id, name").order("name").returns<Pick<Site, "id" | "name">[]>(),
    ]);
    employees = employeeRows ?? [];
    sites = siteRows ?? [];
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Weekly Schedule</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Link
          href={`/weekly-schedule?week=${prevWeek}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Previous week
        </Link>
        <p className="text-sm font-medium">
          {weekStart} – {weekEnd}
        </p>
        <Link
          href={`/weekly-schedule?week=${nextWeek}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Next week →
        </Link>
      </div>

      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add Assigned Shift</CardTitle>
              <CardDescription>
                Directly assigns a shift to an employee as part of the regular
                schedule — no claiming, and it won&apos;t show up on the Shift
                Board.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await addAssignedShift(formData);
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
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required className="min-w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    required
                    defaultValue={weekStart}
                    min={weekStart}
                    max={weekEnd}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="start_time">Start</Label>
                  <Input id="start_time" name="start_time" type="time" required />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="end_time">End</Label>
                  <Input id="end_time" name="end_time" type="time" required />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="role_needed">Role (optional)</Label>
                  <Input id="role_needed" name="role_needed" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="site_id">Site (optional)</Label>
                  <select
                    id="site_id"
                    name="site_id"
                    defaultValue=""
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">No site</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm">
                  Add to Schedule
                </Button>
              </form>
            </CardContent>
          </Card>

          <form
            action={async () => {
              "use server";
              await copyWeekForward(weekStart);
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              Copy this week to next week
            </Button>
          </form>
        </>
      )}

      <div className="flex flex-col gap-3">
        {DAY_NAMES.map((dayName, i) => {
          const date = addDays(weekStart, i);
          const dayShifts = shiftsByDate.get(date) ?? [];
          return (
            <Card key={date}>
              <CardHeader>
                <CardTitle>
                  {dayName} <span className="text-muted-foreground">{date}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {dayShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
                ) : (
                  dayShifts.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{s.full_name}</span> —{" "}
                        {s.title} ({s.start_time}–{s.end_time})
                        {s.role_needed ? ` · ${s.role_needed}` : ""}
                        {s.siteName ? ` · ${s.siteName}` : ""}
                      </span>
                      {isAdmin && (
                        <form
                          action={async () => {
                            "use server";
                            await removeAssignedShift(s.id);
                          }}
                        >
                          <Button type="submit" size="sm" variant="ghost">
                            Remove
                          </Button>
                        </form>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
