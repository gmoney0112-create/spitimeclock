# Admin Guide — Stars PI Time Clock

You get everything an employee gets (clock in/out, shift board) plus the admin-only tools below, reachable from links in the dashboard header once you're signed in as an admin.

## Add an employee

1. Go to **Employees** (`/admin/employees`).
2. Fill out **Add Employee**: full name, email, role, pay type, hourly rate (if hourly), hire date. Click **Add**.
3. They don't need an account yet — add them ahead of time so their rate and role are set correctly from day one. The first time they sign up with that exact email, their login links to this record automatically.
4. To change someone's rate, pay type, or role later, click **Edit role / pay** on their card, update the fields, and **Save**.
5. To remove someone's access without deleting their history, click **Deactivate** (and **Reactivate** later if needed — nothing is ever deleted).

**Note:** the very first person to ever sign up automatically becomes admin (there's no other way to seed the first admin). Everyone after that lands as a plain employee until you change their role here.

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

## Export payroll

Once a pay period's timesheets are approved, click **Export Approved Hours (CSV)** on that period. It downloads a CSV with employee name, email, pay period dates, and regular/overtime/total hours — only approved rows are included. This is a generic format; if it needs to match your payroll processor's exact column layout, that's a quick follow-up tweak.

## Post a shift

1. Go to **Shift Board** (`/shifts`).
2. Fill out **Post a Shift**: title, date, start/end time, and role needed (optional). Click **Post Shift**.
3. As employees claim it, their names appear under the shift with **Approve** / **Deny** buttons. Approving one claim automatically denies every other pending claim on that shift and fills it — only one person can ever be approved for a given shift, even if several claim it first.
4. **Cancel Shift** removes it from the open list if it's no longer needed.

## A few things worth knowing

- **Rounding & overtime**: punches round to the nearest 15 minutes; overtime is calculated per calendar week (Monday–Sunday) at 1.5x-eligible hours past 40 — hardcoded for now, not yet configurable in the UI.
- **Security**: employees can only ever see their own punches and schedule — pay rates and other people's hours are enforced at the database level, not just hidden in the UI.
- **Nothing is ever deleted**: punches, corrections, and shifts are kept indefinitely (soft-status changes only), which matters for payroll recordkeeping requirements.
