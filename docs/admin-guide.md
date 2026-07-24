# Admin Guide — Stars PI Time Clock

You get everything an employee gets (clock in/out, shift board) plus the admin-only tools below, reachable from links in the dashboard header once you're signed in as an admin.

## Add an employee

1. Go to **Employees** (`/admin/employees`).
2. Fill out **Add Employee**: full name, email, role, pay type, hourly rate (if hourly), hire date. Click **Add**.
3. They don't need an account yet — add them ahead of time so their rate and role are set correctly from day one. The first time they sign up with that exact email, their login links to this record automatically.
4. To change someone's rate, pay type, or role later, click **Edit role / pay** on their card, update the fields, and **Save**.
5. To remove someone's access without deleting their history, click **Deactivate** (and **Reactivate** later if needed — nothing is ever deleted).

**Note:** the very first person to ever sign up automatically becomes admin (there's no other way to seed the first admin). Everyone after that lands as a plain employee until you change their role here.

## Manage sites

1. Go to **Sites** (`/admin/sites`).
2. Fill out **Add Site**: name and address, then click **Add**. The address is automatically geocoded to a map coordinate (no Google Maps account needed) — double check the pin looks right if the address is unusual or new construction.
3. Every site defaults to a 150-meter check-in radius. That's adjustable per site if a location needs a tighter or looser radius (a big warehouse vs. a single office suite, for example).
4. Sites are optional — a shift with no site attached still works exactly like the original office clock-in (no GPS check at all). Only attach a site when you want that shift's clock-in verified against a location.

## Review and approve a pay period

1. Go to **Timesheets** (`/admin/timesheets`).
2. If the pay period you need isn't listed, create one: pick a start and end date, click **Create pay period**.
3. Click the pay period's badge to select it, then click **Calculate / Refresh Hours**. This pairs everyone's clock-in/clock-out punches, rounds to the nearest 15 minutes, and splits regular vs. overtime hours at 40/week — you can re-run this any time before approving, it just recalculates.
4. Check the **Missing Punches** list — anyone with a clock-in but no matching clock-out shows up here, and their hours for that shift won't be counted until it's fixed.
5. When everything looks right, click **Approve** on each employee's row. Approved rows are locked — recalculating won't touch them again.

## Correct or add a punch

Never edit an employee's raw time — every fix is logged instead, with a required reason:

- **Add Missing Punch**: use this when a punch never happened at all (forgotten clock-out, etc.). Pick the employee, punch type, the actual time it happened, and a reason.
- **Correct a Punch**: use this when a punch exists but the time is wrong. Pick the punch from the dropdown, enter the corrected time and a reason.

Both show up in the audit trail — this is your protection if a wage dispute ever comes up.

## Review flagged GPS punches

On **Timesheets** (`/admin/timesheets`), the **Flagged Punches (Geofence)** card lists any punch tied to a site-based shift that needs a look:

- **"outside the geofence"** — the employee's phone/browser reported a location, but it was outside the site's radius. Could be GPS drift near a building, or could be a real out-of-location punch — use judgment, and correct the punch if needed (see above).
- **"no location data received"** — the employee's device never sent a location at all (they denied the location permission prompt, their browser doesn't support it, or it timed out). The punch still recorded — clock-ins are never blocked for GPS reasons — it's just unverified. Worth a quick check-in with that employee if it keeps happening, since it usually means their browser is blocking location access.

A shift with no site attached never shows up here — there's nothing to verify it against.

## Export payroll

Once a pay period's timesheets are approved, click **Export Approved Hours (CSV)** on that period. It downloads a CSV with employee name, email, pay period dates, and regular/overtime/total hours — only approved rows are included. This is a generic format; if it needs to match your payroll processor's exact column layout, that's a quick follow-up tweak.

## Post a shift (Shift Board — spontaneous coverage)

Use this for unplanned, first-come coverage — someone calls in sick, a client needs last-minute surveillance, etc.

1. Go to **Shift Board** (`/shifts`).
2. Fill out **Post a Shift**: title, date, start/end time, role needed (optional), and a site if you want that shift's clock-in GPS-verified. Click **Post Shift**.
3. As employees claim it, their names appear under the shift with **Approve** / **Deny** buttons. Approving one claim automatically denies every other pending claim on that shift and fills it — only one person can ever be approved for a given shift, even if several claim it first.
4. **Cancel Shift** removes it from the open list if it's no longer needed.

## Weekly Schedule builder (planned, assigned coverage)

Use this instead of the Shift Board when you already know who's working when — it's the regular, preplanned weekly schedule, not open for anyone to grab.

1. Go to **Weekly Schedule** (`/weekly-schedule`) — every employee can view this (read-only for them), but only admin/office manager see the add/remove controls.
2. Fill out **Add Assigned Shift**: employee, title, date, start/end time, role (optional), site (optional). It's on that employee's schedule immediately — no claim or approval step, unlike the Shift Board.
3. **Remove** takes a shift off the schedule (soft-cancelled, not deleted — it stays in the record).
4. **Copy this week to next week** duplicates every assigned shift on the current week forward by 7 days — the fastest way to repeat a standard week. Adjust individual shifts afterward for that week's exceptions.
5. Assigned shifts never appear on the Shift Board (nothing to claim), but they do show up on the employee's own **My Schedule** page, labeled "Scheduled" to distinguish them from shifts they claimed ("Claimed").

## A few things worth knowing

- **Rounding & overtime**: punches round to the nearest 15 minutes; overtime is calculated per calendar week (Monday–Sunday) at 1.5x-eligible hours past 40 — hardcoded for now, not yet configurable in the UI.
- **Security**: employees can only ever see their own punches and schedule — pay rates and other people's hours are enforced at the database level, not just hidden in the UI.
- **Nothing is ever deleted**: punches, corrections, and shifts are kept indefinitely (soft-status changes only), which matters for payroll recordkeeping requirements.
- **GPS is flag-only, never a hard block**: a clock-in/out always records, even if the employee is outside a site's radius or their location never came through. It just lands in the Flagged Punches queue for a human to look at — this avoids locking someone out of clocking in over ordinary GPS drift.
- **Installable on phones**: employees can add the app to their phone's home screen (Chrome/Safari share menu → "Add to Home Screen") for one-tap access — it's a standard installable web app, not a separate App Store download.
