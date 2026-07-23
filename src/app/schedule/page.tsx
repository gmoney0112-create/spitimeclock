import Link from "next/link";
import { getCurrentEmployee } from "@/lib/get-current-employee";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ScheduleEntry = {
  key: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  role_needed: string | null;
  source: "assigned" | "claimed";
};

export default async function SchedulePage() {
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

  const [{ data: claims }, { data: assignedShifts }] = await Promise.all([
    supabase
      .from("shift_claims")
      .select("id, shifts(title, date, start_time, end_time, role_needed)")
      .eq("employee_id", profile.id)
      .eq("status", "approved"),
    supabase
      .from("shifts")
      .select("id, title, date, start_time, end_time, role_needed")
      .eq("schedule_type", "assigned")
      .eq("assigned_to", profile.id)
      .neq("status", "cancelled"),
  ]);

  const claimedEntries: ScheduleEntry[] = (claims ?? [])
    .map((c) => (Array.isArray(c.shifts) ? c.shifts[0] : c.shifts))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s, i) => ({ key: `claimed-${i}`, source: "claimed" as const, ...s }));

  const assignedEntries: ScheduleEntry[] = (assignedShifts ?? []).map((s) => ({
    key: `assigned-${s.id}`,
    source: "assigned" as const,
    title: s.title,
    date: s.date,
    start_time: s.start_time,
    end_time: s.end_time,
    role_needed: s.role_needed,
  }));

  const shifts = [...assignedEntries, ...claimedEntries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time),
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Schedule</h1>
        <div className="flex gap-4">
          <Link
            href="/weekly-schedule"
            className="text-sm text-muted-foreground hover:underline"
          >
            Weekly Schedule
          </Link>
          <Link href="/shifts" className="text-sm text-muted-foreground hover:underline">
            Shift Board
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>

      {shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming shifts yet — claim one from the Shift Board, or check the
          Weekly Schedule.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <Card key={shift.key}>
              <CardHeader>
                <CardTitle>{shift.title}</CardTitle>
                <CardDescription>
                  {shift.date} · {shift.start_time}–{shift.end_time}
                  {shift.role_needed ? ` · ${shift.role_needed}` : ""}
                  {shift.source === "assigned" ? " · Scheduled" : " · Claimed"}
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
