# Stars PI — Time Clock & Shift Scheduling

A web app for Stars Private Investigations that replaces manual time tracking with a digital time clock (with GPS-verified clock-in at client sites) and a shift scheduling system — both a spontaneous open-shift board and a preplanned weekly schedule.

**Live app:** https://spitimeclock.vercel.app

## For the admin testing this

You don't need this repo at all to test the app — just the live URL above and the two guides in `docs/`:

- **[docs/admin-guide.md](docs/admin-guide.md)** — everything admin/office-manager: adding employees, managing sites, reviewing/approving timesheets, correcting punches, exporting payroll, posting shifts, and building the weekly schedule.
- **[docs/employee-quick-start.md](docs/employee-quick-start.md)** — everything a regular employee sees: logging in, clocking in/out, claiming shifts, checking their schedule and hours.

**To get started:** open the live URL and create an account. The very first account ever created automatically becomes admin — use that one for testing admin features, then create a second account (or ask a coworker to) to see the employee side. Everyone after the first signup lands as a plain employee until an admin changes their role on the Employees page.

## What's built (current status)

- **Time clock** — clock in/out, live "who's on the clock" view for admins, automatic regular/overtime calculation (40 hrs/week, Texas FLSA rules), 15-minute rounding
- **Timesheets & payroll** — admin review per pay period, flag missing punches, manual punch corrections (always logged with a reason, never a silent overwrite), approve/lock, CSV export
- **Shift Board** — admins post open/spontaneous shifts, employees claim them, admin approves/denies (first-approved wins, race-safe at the database level)
- **Weekly Schedule** — a second, separate scheduling flow: admin/office manager directly assigns shifts to specific employees for the regular planned week; every employee can view the full week read-only; "copy this week forward" for repeating schedules
- **Sites & GPS geofencing** — admins add client site addresses (auto-geocoded, no Google Maps account needed); shifts can be tied to a site; clock-in/out at a site-linked shift captures GPS and flags (never blocks) punches taken outside the site's radius or with no location data
- **PWA** — installable to a phone home screen for one-tap access, no App Store needed
- **Security** — Row Level Security in the database: employees can only ever see their own punches, pay rate, and schedule; every punch correction and approval is written to an audit trail

## Known limitations / not yet built

These are deliberate, deferred scope — not bugs:

- No SMS/email notifications yet (shift reminders, missed clock-in alerts) — needs a Twilio or similar account before it can be wired up
- No shift-swap requests between employees
- No PTO/sick-time tracking
- No kiosk/shared-device mode (each employee uses their own login)
- Payroll CSV export is a generic column format — hasn't been matched to a specific payroll processor's (Gusto/QuickBooks/ADP) exact import format yet
- Rounding rule (nearest 15 min) and overtime treatment are hardcoded, not admin-configurable

## Reporting issues while testing

If something looks wrong (hours don't match, a punch didn't record, a page errors out), note: what you clicked, what you expected, what happened instead, and roughly when — that's enough to trace it through the audit log.

## Tech stack (for whoever maintains this next)

Next.js (App Router) + TypeScript + Tailwind CSS, backed entirely by Supabase (Postgres + Auth + Row Level Security — no separate custom backend). Hosted on Vercel with git-based continuous deployment: every push to `claude/time-clock-shift-scheduling-3uxivq` deploys straight to the live URL above. Full architecture, schema, and design decisions are documented in [CLAUDE.md](CLAUDE.md); database migrations live in `supabase/migrations/`.
