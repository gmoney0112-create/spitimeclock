import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/get-current-employee";
import { ClockPanel } from "@/components/clock-panel";
import { AdminOnClock } from "@/components/admin-on-clock";
import { SignOutButton } from "@/components/sign-out-button";
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: activeShiftRows } = await supabase
    .from("shift_claims")
    .select("shifts!inner(id, title, date, sites(name))")
    .eq("employee_id", profile.id)
    .eq("status", "approved")
    .eq("shifts.date", today)
    .order("start_time", { foreignTable: "shifts" })
    .limit(1);

  const activeShiftRow = activeShiftRows?.[0];
  const activeShiftEntry = activeShiftRow
    ? Array.isArray(activeShiftRow.shifts)
      ? activeShiftRow.shifts[0]
      : activeShiftRow.shifts
    : null;
  const activeShiftSite = activeShiftEntry
    ? Array.isArray(activeShiftEntry.sites)
      ? activeShiftEntry.sites[0]
      : activeShiftEntry.sites
    : null;
  const activeShift = activeShiftEntry
    ? {
        id: activeShiftEntry.id as string,
        title: activeShiftEntry.title as string,
        siteName: (activeShiftSite?.name as string | undefined) ?? null,
      }
    : null;

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
          activeShift={activeShift}
        />
        {isAdmin && <AdminOnClock initial={adminInitial} />}
      </div>
    </main>
  );
}
