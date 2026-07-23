import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/get-current-employee";
import { ClockPanel } from "@/components/clock-panel";
import { AdminOnClock } from "@/components/admin-on-clock";
import { SignOutButton } from "@/components/sign-out-button";
import { todayISO } from "@/lib/week";
import type { PunchType } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
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

  const { data: lastPunch } = await supabase
    .from("time_punches")
    .select("punch_type, timestamp")
    .eq("employee_id", profile.id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = todayISO();
  const [{ data: claimedRows }, { data: assignedRows }] = await Promise.all([
    supabase
      .from("shift_claims")
      .select("shifts!inner(id, title, date, start_time, sites(name))")
      .eq("employee_id", profile.id)
      .eq("status", "approved")
      .eq("shifts.date", today),
    supabase
      .from("shifts")
      .select("id, title, date, start_time, sites(name)")
      .eq("schedule_type", "assigned")
      .eq("assigned_to", profile.id)
      .eq("date", today)
      .neq("status", "cancelled"),
  ]);

  const todaysShifts = [
    ...(claimedRows ?? []).map((row) => {
      const shift = Array.isArray(row.shifts) ? row.shifts[0] : row.shifts;
      return shift;
    }),
    ...(assignedRows ?? []),
  ]
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => {
      const site = Array.isArray(s.sites) ? s.sites[0] : s.sites;
      return {
        id: s.id as string,
        title: s.title as string,
        siteName: (site?.name as string | undefined) ?? null,
        start_time: s.start_time as string,
      };
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const isAdmin = profile.role === "admin" || profile.role === "office_manager";

  let adminInitial: {
    id: string;
    full_name: string;
    clockedIn: boolean;
    lastPunchAt: string | null;
    siteName: string | null;
    withinGeofence: boolean | null;
  }[] = [];

  if (isAdmin) {
    const [{ data: employees }, { data: recentPunches }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("time_punches")
        .select("employee_id, punch_type, timestamp, within_geofence, shifts(sites(name))")
        .order("timestamp", { ascending: false })
        .limit(500),
    ]);

    const latestByEmployee = new Map<
      string,
      {
        punch_type: PunchType;
        timestamp: string;
        within_geofence: boolean | null;
        siteName: string | null;
      }
    >();
    for (const punch of recentPunches ?? []) {
      if (!latestByEmployee.has(punch.employee_id)) {
        const shift = Array.isArray(punch.shifts) ? punch.shifts[0] : punch.shifts;
        const site = shift ? (Array.isArray(shift.sites) ? shift.sites[0] : shift.sites) : null;
        latestByEmployee.set(punch.employee_id, {
          punch_type: punch.punch_type,
          timestamp: punch.timestamp,
          within_geofence: punch.within_geofence,
          siteName: site?.name ?? null,
        });
      }
    }

    adminInitial = (employees ?? []).map((employee) => {
      const latest = latestByEmployee.get(employee.id);
      return {
        id: employee.id,
        full_name: employee.full_name,
        clockedIn: latest?.punch_type === "clock_in",
        lastPunchAt: latest?.timestamp ?? null,
        siteName: latest?.siteName ?? null,
        withinGeofence: latest?.within_geofence ?? null,
      };
    });
  }

  return (
    <main className="flex min-h-svh flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-3xl items-center justify-between">
        <div>
          <p className="font-medium">{profile.full_name}</p>
          <p className="text-sm text-muted-foreground">{profile.role}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/weekly-schedule"
            className="text-sm text-muted-foreground hover:underline"
          >
            Weekly Schedule
          </Link>
          <Link href="/shifts" className="text-sm text-muted-foreground hover:underline">
            Shift Board
          </Link>
          <Link href="/schedule" className="text-sm text-muted-foreground hover:underline">
            My Schedule
          </Link>
          <Link href="/timesheets" className="text-sm text-muted-foreground hover:underline">
            My Timesheets
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/admin/employees"
                className="text-sm text-muted-foreground hover:underline"
              >
                Employees
              </Link>
              <Link
                href="/admin/sites"
                className="text-sm text-muted-foreground hover:underline"
              >
                Sites
              </Link>
              <Link
                href="/admin/timesheets"
                className="text-sm text-muted-foreground hover:underline"
              >
                Timesheets
              </Link>
            </>
          )}
          <SignOutButton />
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-wrap justify-center gap-6">
        <ClockPanel
          initiallyClockedIn={lastPunch?.punch_type === "clock_in"}
          lastPunchAt={lastPunch?.timestamp ?? null}
          todaysShifts={todaysShifts}
        />
        {isAdmin && <AdminOnClock initial={adminInitial} />}
      </div>
    </main>
  );
}
