"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PunchType } from "@/types/database";

type EmployeeStatus = {
  id: string;
  full_name: string;
  clockedIn: boolean;
  lastPunchAt: string | null;
  siteName: string | null;
  withinGeofence: boolean | null;
};

export function AdminOnClock({ initial }: { initial: EmployeeStatus[] }) {
  const [statuses, setStatuses] = useState(initial);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("time_punches_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "time_punches" },
        (payload) => {
          const row = payload.new as {
            employee_id: string;
            punch_type: PunchType;
            timestamp: string;
            within_geofence: boolean | null;
          };

          setStatuses((current) =>
            current.map((employee) =>
              employee.id === row.employee_id
                ? {
                    ...employee,
                    clockedIn: row.punch_type === "clock_in",
                    lastPunchAt: row.timestamp,
                    withinGeofence: row.within_geofence,
                  }
                : employee,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onClock = statuses.filter((employee) => employee.clockedIn);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Who&apos;s On The Clock</CardTitle>
        <CardDescription>
          {onClock.length === 0
            ? "Nobody is currently clocked in."
            : `${onClock.length} clocked in right now`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {statuses.map((employee) => (
          <div
            key={employee.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>
              {employee.full_name}
              {employee.clockedIn && employee.siteName && (
                <span className="text-muted-foreground"> — {employee.siteName}</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {employee.clockedIn && employee.withinGeofence === false && (
                <Badge variant="destructive">Out of range</Badge>
              )}
              <Badge variant={employee.clockedIn ? "success" : "secondary"}>
                {employee.clockedIn ? "In" : "Out"}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
