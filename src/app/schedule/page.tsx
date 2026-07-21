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

  const { data: claims } = await supabase
    .from("shift_claims")
    .select("id, shifts(title, date, start_time, end_time, role_needed)")
    .eq("employee_id", profile.id)
    .eq("status", "approved");

  const shifts = (claims ?? [])
    .map((c) => (Array.isArray(c.shifts) ? c.shifts[0] : c.shifts))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Schedule</h1>
        <div className="flex gap-4">
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
          No upcoming shifts yet — claim one from the Shift Board.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((shift, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>{shift.title}</CardTitle>
                <CardDescription>
                  {shift.date} · {shift.start_time}–{shift.end_time}
                  {shift.role_needed ? ` · ${shift.role_needed}` : ""}
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
