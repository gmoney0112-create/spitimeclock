"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clockIn, clockOut } from "@/app/actions/punches";

export interface TodayShift {
  id: string;
  title: string;
  siteName: string | null;
}

const GENERAL_VALUE = "__general__";

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
  todaysShifts,
}: {
  initiallyClockedIn: boolean;
  lastPunchAt: string | null;
  todaysShifts: TodayShift[];
}) {
  const [clockedIn, setClockedIn] = useState(initiallyClockedIn);
  const [selectedId, setSelectedId] = useState(
    todaysShifts[0]?.id ?? GENERAL_VALUE,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedShift = todaysShifts.find((s) => s.id === selectedId) ?? null;

  function handleClick() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      let opts: { shiftId?: string; latitude?: number; longitude?: number } | undefined;

      let gotPosition = false;
      if (selectedShift) {
        opts = { shiftId: selectedShift.id };
        if (selectedShift.siteName) {
          const position = await getPosition();
          if (position) {
            gotPosition = true;
            opts.latitude = position.coords.latitude;
            opts.longitude = position.coords.longitude;
          }
        }
      }

      const result = clockedIn ? await clockOut(opts) : await clockIn(opts);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (selectedShift?.siteName) {
        if (result.withinGeofence === false) {
          setNotice(
            "You appear to be outside the site's radius — this punch was flagged for admin review.",
          );
        } else if (!gotPosition) {
          setNotice(
            "Location access wasn't available, so this punch couldn't be GPS-verified — it's been flagged for admin review. Try allowing location access if prompted next time.",
          );
        }
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
          {selectedShift
            ? `Clocking in for: ${selectedShift.title}${selectedShift.siteName ? ` @ ${selectedShift.siteName}` : ""}`
            : lastPunchAt
              ? `Last punch: ${new Date(lastPunchAt).toLocaleString()}`
              : "No punches recorded yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {todaysShifts.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="shift-select">Clocking in for</Label>
            <select
              id="shift-select"
              value={selectedId}
              disabled={clockedIn || pending}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {todaysShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.siteName ? ` @ ${s.siteName}` : ""}
                </option>
              ))}
              <option value={GENERAL_VALUE}>General (no site)</option>
            </select>
          </div>
        )}
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
