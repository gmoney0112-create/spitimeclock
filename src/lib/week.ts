export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// The office's fixed business timezone (matches CLAUDE.md's timesheet
// calculation and geofencing) -- not the server's UTC clock, which would
// roll to "tomorrow" hours before Central Time actually does.
const BUSINESS_TIMEZONE = "America/Chicago";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(new Date());
}
