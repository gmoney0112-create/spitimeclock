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

  const isAdmin = profile.role === "admin" || profile.role === "office_manager";

  let adminInitial: {
    id: string;
    full_name: string;
    clockedIn: boolean;
    lastPunchAt: string | null;
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
        .select("employee_id, punch_type, timestamp")
        .order("timestamp", { ascending: false })
        .limit(500),
    ]);

    const latestByEmployee = new Map<
      string,
      { punch_type: PunchType; timestamp: string }
    >();
    for (const punch of recentPunches ?? []) {
      if (!latestByEmployee.has(punch.employee_id)) {
        latestByEmployee.set(punch.employee_id, punch);
      }
    }

    adminInitial = (employees ?? []).map((employee) => {
      const latest = latestByEmployee.get(employee.id);
      return {
        id: employee.id,
        full_name: employee.full_name,
        clockedIn: latest?.punch_type === "clock_in",
        lastPunchAt: latest?.timestamp ?? null,
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
        <SignOutButton />
      </div>

      <div className="flex w-full max-w-3xl flex-wrap justify-center gap-6">
        <ClockPanel
          initiallyClockedIn={lastPunch?.punch_type === "clock_in"}
          lastPunchAt={lastPunch?.timestamp ?? null}
        />
        {isAdmin && <AdminOnClock initial={adminInitial} />}
      </div>
    </main>
  );
}
