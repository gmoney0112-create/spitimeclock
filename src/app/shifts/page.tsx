import Link from "next/link";
import { getCurrentEmployee } from "@/lib/get-current-employee";
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
  postShift,
  claimShift,
  approveClaim,
  denyClaim,
  cancelShift,
} from "@/app/shifts/actions";
import type { Shift, Site } from "@/types/database";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentEmployee();
  const { error: actionError } = await searchParams;

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

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, sites(name)")
    .in("status", ["open", "claimed"])
    .order("date")
    .order("start_time")
    .returns<(Shift & { sites: { name: string } | { name: string }[] | null })[]>();

  const { data: sites } = isAdmin
    ? await supabase.from("sites").select("id, name").order("name").returns<
        Pick<Site, "id" | "name">[]
      >()
    : { data: null };

  const { data: ownClaims } = await supabase
    .from("shift_claims")
    .select("shift_id, status")
    .eq("employee_id", profile.id);

  const ownClaimByShift = new Map(
    (ownClaims ?? []).map((c) => [c.shift_id, c.status]),
  );

  let pendingClaimsByShift = new Map<
    string,
    { id: string; full_name: string; claimed_at: string }[]
  >();

  if (isAdmin) {
    const { data: pending } = await supabase
      .from("shift_claims")
      .select("id, shift_id, claimed_at, employees!shift_claims_employee_id_fkey(full_name)")
      .eq("status", "pending")
      .order("claimed_at");

    pendingClaimsByShift = new Map();
    for (const claim of pending ?? []) {
      const employee = Array.isArray(claim.employees)
        ? claim.employees[0]
        : claim.employees;
      const list = pendingClaimsByShift.get(claim.shift_id) ?? [];
      list.push({
        id: claim.id,
        full_name: employee?.full_name ?? "Unknown",
        claimed_at: claim.claimed_at,
      });
      pendingClaimsByShift.set(claim.shift_id, list);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shift Board</h1>
        <div className="flex gap-4">
          <Link href="/schedule" className="text-sm text-muted-foreground hover:underline">
            My Schedule
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>

      {actionError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Post a Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData: FormData) => {
                "use server";
                await postShift(formData);
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required className="min-w-48" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
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
                  <option value="">No site (office / general)</option>
                  {(sites ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm">
                Post Shift
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {(shifts ?? []).map((shift) => {
          const ownStatus = ownClaimByShift.get(shift.id);
          const pending = pendingClaimsByShift.get(shift.id) ?? [];
          const site = Array.isArray(shift.sites) ? shift.sites[0] : shift.sites;

          return (
            <Card key={shift.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {shift.title}
                  <Badge variant={shift.status === "claimed" ? "secondary" : "outline"}>
                    {shift.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {shift.date} · {shift.start_time}–{shift.end_time}
                  {shift.role_needed ? ` · ${shift.role_needed}` : ""}
                  {site ? ` · ${site.name}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {ownStatus === "approved" ? (
                  <Badge variant="success" className="w-fit">
                    You&apos;re scheduled for this shift
                  </Badge>
                ) : ownStatus === "pending" ? (
                  <Badge variant="secondary" className="w-fit">
                    Claim pending review
                  </Badge>
                ) : ownStatus === "denied" ? (
                  <Badge variant="outline" className="w-fit">
                    Your claim was denied
                  </Badge>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await claimShift(shift.id);
                    }}
                  >
                    <Button type="submit" size="sm">
                      Claim Shift
                    </Button>
                  </form>
                )}

                {isAdmin && (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    {pending.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No pending claims.
                      </p>
                    ) : (
                      pending.map((claim) => (
                        <div
                          key={claim.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span>{claim.full_name}</span>
                          <div className="flex gap-2">
                            <form
                              action={async () => {
                                "use server";
                                await approveClaim(claim.id);
                              }}
                            >
                              <Button type="submit" size="sm" variant="outline">
                                Approve
                              </Button>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await denyClaim(claim.id);
                              }}
                            >
                              <Button type="submit" size="sm" variant="ghost">
                                Deny
                              </Button>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await cancelShift(shift.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="destructive">
                        Cancel Shift
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {(shifts ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No open shifts right now.</p>
        )}
      </div>
    </main>
  );
}
