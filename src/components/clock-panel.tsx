"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clockIn, clockOut } from "@/app/actions/punches";

export interface ActiveShift {
  id: string;
  title: string;
  siteName: string | null;
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export function ClockPanel({
  initiallyClockedIn,
  lastPunchAt,
  activeShift,
}: {
  initiallyClockedIn: boolean;
  lastPunchAt: string | null;
  activeShift?: ActiveShift | null;
}) {
  const [clockedIn, setClockedIn] = useState(initiallyClockedIn);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      let opts: { shiftId?: string; latitude?: number; longitude?: number } | undefined;

      if (activeShift) {
        const position = await getPosition();
        opts = {
          shiftId: activeShift.id,
          ...(position
            ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
            : {}),
        };
      }

      const result = clockedIn ? await clockOut(opts) : await clockIn(opts);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (activeShift && result.withinGeofence === false) {
        setNotice(
          "You appear to be outside the site's radius — this punch was flagged for admin review.",
        );
      }
      setClockedIn(!clockedIn);
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Time Clock
          <Badge variant={clockedIn ? "success" : "secondary"}>
            {clockedIn ? "Clocked In" : "Clocked Out"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {activeShift
            ? `Clocking in for: ${activeShift.title}${activeShift.siteName ? ` @ ${activeShift.siteName}` : ""}`
            : lastPunchAt
              ? `Last punch: ${new Date(lastPunchAt).toLocaleString()}`
              : "No punches recorded yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          size="lg"
          variant={clockedIn ? "destructive" : "default"}
          disabled={pending}
          onClick={handleClick}
        >
          {pending ? "Saving…" : clockedIn ? "Clock Out" : "Clock In"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      </CardContent>
    </Card>
  );
}
