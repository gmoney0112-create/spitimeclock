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

export function ClockPanel({
  initiallyClockedIn,
  lastPunchAt,
}: {
  initiallyClockedIn: boolean;
  lastPunchAt: string | null;
}) {
  const [clockedIn, setClockedIn] = useState(initiallyClockedIn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = clockedIn ? await clockOut() : await clockIn();
      if (result.error) {
        setError(result.error);
        return;
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
          {lastPunchAt
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
      </CardContent>
    </Card>
  );
}
