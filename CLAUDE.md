# Stars Private Investigations — Time Clock & Shift Scheduling System
### Software Blueprint

---

## 1. Project Overview

A web application for Stars Private Investigations that replaces manual time tracking with a digital time clock for payroll, and adds a shift marketplace where open shifts get posted and employees claim them themselves — instead of manually assigning coverage.

Two systems, one app:

1. **Time Clock** — employees clock in/out at the office; the system calculates hours, overtime, and produces payroll-ready exports.
2. **Shift Board** — admins post open shifts (date, time, role); employees browse and claim them; approved claims become their schedule.

Since clock-in happens at a fixed location (the office), there's no need for GPS/geofencing, mobile native apps, or offline sync — which keeps this materially simpler and cheaper to build and run than a field-service version.

---

## 2. Target Users & Roles

| Role | Who | Key Permissions |
|---|---|---|
| **Owner/Admin** | Business owner | Full access: manage employees, post shifts, approve claims, review/edit/approve timesheets, run payroll exports, view audit logs |
| **Office Manager** (optional, Phase 2) | Delegated staff | Everything except payroll export + employee pay-rate edits |
| **Employee** (Investigator/Staff) | Team members | Clock in/out, view own timesheet, browse & claim open shifts, view own schedule |

---

## 3. Core Problems Being Solved

- No reliable, auditable record of hours worked → payroll disputes and manual reconciliation
- No overtime visibility until after the fact
- Shift coverage handled manually (calls/texts) instead of self-service
- No single source of truth for "who's scheduled when"

---

## 4. Software Architecture

### System Components

1. **Frontend Web App** — Employee-facing (clock in/out, shift board) + Admin dashboard (same app, role-gated)
2. **Backend / Database** — Supabase (Postgres + Auth + Row Level Security)
3. **Scheduled Jobs** — Weekly/biweekly payroll calculation, shift reminder notifications
4. **Integrations** — SMS/email notifications; payroll export (CSV, matching the payroll processor's import format)

### Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (React) + Tailwind CSS + shadcn/ui** | Fast to build against, no custom design system needed for MVP |
| Backend/DB | **Supabase** (Postgres, Auth, Row Level Security, Edge Functions) | RLS gives clean role-based data isolation without hand-rolling an API layer — call Supabase directly from the frontend, no custom backend needed |
| Hosting (frontend) | **Vercel** | Zero-config Next.js deploys |
| Scheduled jobs / notifications | **n8n** (self-hosted or existing instance) | Daily/weekly cron jobs (overtime alerts, shift reminders, payroll export generation) rather than a custom job runner |
| Notifications | **Twilio (SMS)** via n8n, or email via Resend/SendGrid | Keep employee comms separate from any marketing CRM |
| Auth | **Supabase Auth** (email + password, or magic link) | Simple per-employee login; no PIN/kiosk complexity needed for MVP |

**Note on "fixed location" clock-in:** since GPS isn't needed, there are two clean options — pick one for MVP:

- **Option A (recommended for a small office):** each employee logs into their own account (phone or desktop browser) and taps Clock In/Out. Fast to build, no shared hardware.
- **Option B:** a shared tablet/kiosk at the office running the app in "kiosk mode" — employee enters an Employee ID + PIN to punch. More like a traditional time clock, better if staff don't all have work phones or a single physical station is preferred.

Build A first and add B in Phase 2 without touching the data model — both write to the same `time_punches` table.

---

## 5. Database Schema

```
employees
- id (uuid, pk)
- auth_user_id (fk → auth.users, nullable until they set up login)
- full_name
- email
- phone
- role (enum: admin, office_manager, employee)
- pay_type (enum: hourly, salary)
- hourly_rate (numeric, nullable — sensitive, admin-only visibility via RLS)
- pin_code (hashed, nullable — only used if kiosk mode enabled)
- status (enum: active, inactive)
- hire_date
- created_at

time_punches
- id (uuid, pk)
- employee_id (fk → employees)
- punch_type (enum: clock_in, clock_out, break_start, break_end)
- timestamp (timestamptz)
- source (enum: web_self, kiosk, manual_admin_entry)
- notes (text, nullable)
- created_at

timesheets  (derived/aggregated per employee per pay period — computed, not hand-entered)
- id (uuid, pk)
- employee_id (fk → employees)
- pay_period_id (fk → pay_periods)
- regular_hours (numeric)
- overtime_hours (numeric)
- total_hours (numeric)
- status (enum: pending_review, approved, exported)
- approved_by (fk → employees, nullable)
- approved_at (timestamptz, nullable)

pay_periods
- id (uuid, pk)
- start_date
- end_date
- status (enum: open, closed, exported)

punch_corrections  (audit trail for edits — never overwrite raw punches)
- id (uuid, pk)
- original_punch_id (fk → time_punches, nullable if punch was missing entirely)
- employee_id (fk → employees)
- corrected_timestamp
- reason (text)
- edited_by (fk → employees)
- created_at

shifts
- id (uuid, pk)
- title (e.g. "Evening Surveillance Coverage")
- date
- start_time
- end_time
- role_needed (text, nullable)
- status (enum: open, claimed, filled, cancelled)
- posted_by (fk → employees)
- created_at

shift_claims
- id (uuid, pk)
- shift_id (fk → shifts)
- employee_id (fk → employees)
- status (enum: pending, approved, denied)
- claimed_at (timestamptz)
- decided_by (fk → employees, nullable)
- decided_at (timestamptz, nullable)

audit_log
- id (uuid, pk)
- actor_id (fk → employees)
- action (text — e.g. "edited_punch", "approved_timesheet", "posted_shift")
- target_table
- target_id
- metadata (jsonb)
- created_at
```

**Row Level Security approach:** employees can `SELECT`/`INSERT` their own `time_punches` and `shift_claims` only; only `admin`/`office_manager` roles can read `hourly_rate`, edit others' punches, or approve timesheets/claims. Every edit to a punch goes through `punch_corrections`, never a silent overwrite — this matters if a wage dispute ever comes up.

The starting migration in `supabase/migrations/` implements this schema plus RLS end to end — see §14 below.

---

## 6. Feature Breakdown

### MVP (Phase 1) — Must-have for launch

**Estimated build time: 35–50 hours**

1. **Auth & Employee Management** — Admin can add/deactivate employees, set pay type/rate. Employee login (email/password via Supabase Auth).
2. **Time Clock** — Clock In / Clock Out button (own account, web). Optional break start/end. Live "currently clocked in" indicator.
3. **Timesheet Calculation** — Auto-calculate regular vs. overtime hours per pay period (over 40 hrs/week = OT, per FLSA). Rounding rule applied consistently (e.g., nearest 15 min — must not systematically favor employer, per DOL guidance).
4. **Admin Timesheet Review** — View all employees' hours for the pay period. Flag missing punches (clock-in with no matching clock-out). Manually add/correct a punch (writes to `punch_corrections`, with required reason). Approve timesheet → locks it.
5. **Payroll Export** — CSV export of approved hours per employee per pay period, formatted for the payroll processor (Gusto/QuickBooks/ADP — confirm which one to match the exact column format).
6. **Shift Board (basic)** — Admin posts an open shift. Employees see a list of open shifts and claim one (first-come, admin can override). Claimed shift appears on employee's "My Schedule" view.

### Phase 2 — Enhanced functionality

**Estimated build time: 20–25 hours**

1. Shift reminders (SMS/email, day-before + hour-before) via n8n + Twilio
2. Overtime alert to admin when an employee crosses 35 hrs mid-week (get ahead of OT before it happens)
3. Shift swap/give-away between employees (with admin approval)
4. Office Manager role (delegated review without payroll/rate visibility)
5. PTO/sick time request + balance tracking
6. Kiosk mode (Option B above) for a shared-device station

### Phase 3 — Nice-to-haves

**Estimated build time: 15–20 hours**

1. Direct payroll API integration (Gusto or QuickBooks Payroll API) instead of CSV export
2. Investigator license/certification expiration tracking + renewal reminders (PI licenses expire)
3. Basic labor-cost dashboard (hours + $ by week/employee)
4. Employee self-service PDF pay-period summary

---

## 7. Compliance & Payroll Rules (build these into the logic, not as an afterthought)

- **Overtime:** Federal FLSA requires 1.5x pay for hours worked over 40 in a workweek for non-exempt employees. Texas has no daily-overtime rule (unlike CA), so weekly-only OT logic is correct here.
- **Recordkeeping:** FLSA requires payroll records be retained at least 3 years, and records used to calculate pay (like time cards) at least 2 years. Punches and corrections are never deleted — soft-delete/status flags only.
- **Rounding:** If rounding punch times, DOL guidance says the rounding policy must not, over time, systematically shortchange employees. Nearest-5/10/15-minute rounding is standard and defensible; document the rule in the app.
- **Breaks:** Texas doesn't mandate meal/rest breaks by state law. Federally, short breaks (under ~20 min) must be paid; a bona fide meal break (30+ min, employee fully relieved of duty) can be unpaid. Break tracking can be skipped in MVP and added later without a schema change (already in the `punch_type` enum).
- **Exempt vs. non-exempt:** This system is built for hourly non-exempt tracking. Salaried/exempt staff don't need OT logic — the `pay_type` field lets the app skip OT calculation for salaried employees.

*(This is engineering-level guidance, not legal advice — worth a quick confirmation from a payroll provider or employment attorney once, especially to lock in the rounding policy and OT treatment for investigators, since some field-investigator roles can raise exempt/non-exempt classification questions.)*

---

## 8. Step-by-Step Implementation Plan (4-Week Track)

### Week 1 — Foundation
- Set up Next.js + Tailwind project, connect to Supabase
- Build `employees`, `time_punches`, `punch_corrections`, `pay_periods`, `timesheets` tables + RLS policies
- Supabase Auth login flow, role-based route protection (admin vs employee views)

### Week 2 — Time Clock Core
- Clock In/Out UI + live status indicator
- Timesheet calculation logic (regular/OT split, rounding rule)
- Admin timesheet review screen: flag missing punches, manual correction flow, approve/lock

### Week 3 — Payroll Export + Shift Board MVP
- CSV export matching the payroll processor's format
- `shifts` + `shift_claims` tables/RLS
- Admin: post shift screen. Employee: open-shift list + claim button. Claimed → "My Schedule"

### Week 4 — Polish, Testing, Handoff
- Full QA pass (see checklist below)
- Deploy to Vercel + production Supabase project
- Write the two-page employee quick-start guide + record a 5-minute walkthrough

**Total MVP estimate: 3.5–4.5 weeks solo, working with Claude Code against this file.**

---

## 9. One-Week Sprint Track (Compressed MVP)

Realistic in a week if scope is cut hard and Claude Code is prompted in **vertical slices** (a whole feature — schema + RLS + UI — in one pass) rather than file-by-file.

### The 3 levers that make this possible

1. **Skip building a backend.** Supabase generates a REST/GraphQL API the moment tables exist. Call Supabase directly from the frontend; RLS enforces security. This removes an entire "backend layer" from the timeline.
2. **Use a prebuilt UI kit, not custom design.** shadcn/ui + Tailwind for every screen (login, clock button, admin table, shift board). Nothing custom-designed in week 1 — visual polish is a Phase 2 problem.
3. **Prompt Claude Code in vertical slices, not files.** Instead of "build the login page," then "build the auth hook," then "build the protected route" — give the whole feature in one prompt: "Build the complete time clock feature: employees table + RLS policies + clock in/out UI + live status indicator, using the schema in CLAUDE.md." One pass, not ten.

### What has to get cut to hit 1 week

Everything already in Phase 2/3 stays out — no exceptions, even if it looks quick mid-build:

- Kiosk mode, PTO tracking, shift swaps, office manager role, overtime alerts, license tracking — all deferred
- Payroll CSV export ships in a generic format first; matching the exact processor column layout happens after (a 30-minute tweak later, not a reason to block launch)
- Testing is critical-path only (checklist below), not exhaustive — a parallel run against the current method (old + new side by side for one pay period) is what catches real edge cases, not pre-launch QA theater

### Day-by-day

**Day 1 — Foundation**
Next.js + Tailwind + shadcn/ui scaffolded, Supabase project created, full schema (§5) pushed as one migration, RLS policies written, Supabase Auth wired up with the prebuilt Auth UI component. Have Claude Code generate the whole schema + RLS as one SQL file, not table-by-table — see `supabase/migrations/` for the starting artifact.

**Day 2 — Time clock core**
Clock In/Out button, live "who's on the clock" view, punch storage, timesheet calculation (regular vs. OT split, one rounding rule, no configurability yet — hardcode it).

**Day 3 — Admin review + export**
Admin table of all timesheets, flag missing punches, manual correction with required reason, approve/lock, generic CSV export button.

**Day 4 — Shift board**
Post shift (admin), browse/claim open shifts (employee), claimed shift shows on "My Schedule." Simplest module — should move fast.

**Day 5 — Deploy + harden**
Deploy to Vercel + production Supabase, run through the critical-path checklist below, write the two one-pagers (employee + admin quick start), record a 5-minute walkthrough.

Weekend is buffer, not a planned work day — if Days 1–4 slip, it absorbs the slip instead of Day 5 launch slipping.

### Critical-path checklist for Day 5 (non-negotiable subset of §11)

- [ ] Clock in → clock out → correct hours in timesheet
- [ ] OT triggers only over 40 hrs/week
- [ ] Missing clock-out gets flagged, not dropped
- [ ] Employee can't see another employee's rate or punches
- [ ] CSV export opens cleanly and hours match manual calculation
- [ ] Shift claim by two people on the same shift resolves predictably

---

## 10. Deployment Strategy

- **Frontend:** Vercel (subdomain, e.g. `app.starspi.com` or `timeclock.starspi.com`)
- **Database/Auth:** Supabase project (separate from any other Supabase projects, to keep employee PII isolated)
- **Scheduled jobs:** n8n workflow triggers weekly payroll calc + daily shift-reminder check
- **Environment variables:** Supabase URL/anon key + service-role key (service-role key only in server-side/Edge Function context, never shipped to the browser)
- **Domain:** subdomain off starspi.com via Vercel

**Estimated monthly infra cost:** ~$0–25/mo (Supabase free tier likely covers this employee count; Vercel hobby tier; n8n if already run) — no per-employee software fee since it's self-owned.

---

## 11. Security Considerations

- Row Level Security on every table — employees literally cannot query another employee's punches or pay rate at the database level, not just hidden in the UI
- `hourly_rate` and `pay_type` visible only to admin/office_manager roles (the starting migration splits self-service reads through a `my_profile` view that excludes these columns — see §14)
- All punch corrections logged with actor + reason — this is protection in a wage dispute
- Passwords/PINs never stored in plaintext (Supabase Auth handles password hashing; PIN, if used, gets hashed the same way)
- Regular Supabase automated backups (enabled by default on paid tier — worth the upgrade once this is live payroll data)

---

## 12. Pre-Launch Testing Checklist

- [ ] Clock in → clock out → correct hours appear in timesheet
- [ ] Overtime correctly triggers only after 40 hrs in a single workweek
- [ ] Missing clock-out is flagged, not silently dropped
- [ ] Manual correction requires a reason and shows up in audit log
- [ ] Employee cannot view another employee's punches, rate, or pay type
- [ ] Payroll CSV export matches the payroll processor's required column format exactly (test with a real import, not just visually)
- [ ] Shift claim by two employees on the same open shift resolves predictably (first claim wins, or admin decides — confirm which behavior is wanted)
- [ ] Mobile browser (not just desktop) tested for clock in/out, since staff may use phones even at a fixed location

---

## 13. Handoff & Training

- One-page **Employee Quick Start**: how to log in, clock in/out, claim a shift
- One-page **Admin Guide**: how to add an employee, review/approve a timesheet, correct a punch, export payroll, post a shift
- Short screen-recorded walkthrough for both roles
- 30-day post-launch window to fix anything that surfaces in real payroll use before fully retiring the old method

---

## 14. Starting Artifact: Supabase Migration

`supabase/migrations/20260721000000_initial_schema.sql` implements the full schema from §5 as a single migration, ready to apply with `supabase db push` (or paste into the Supabase SQL editor) as the first step of Day 1:

- All tables, enums, indexes, and foreign keys from §5
- RLS enabled on every table with policies enforcing: employees see/insert only their own `time_punches` and `shift_claims`; only `admin`/`office_manager` can read all rows, approve timesheets, decide claims, or write `punch_corrections`
- A `my_profile` view for employee self-service reads that excludes `hourly_rate`/`pay_type` (true column-level protection, not just app-layer hiding)
- Trigger-based `audit_log` writes on punch corrections, timesheet approval, shift posting, and shift claim decisions — so the audit trail can't be skipped by a client that forgets to log an action
- A partial unique index ensuring only one `approved` claim can ever exist per shift, so two employees claiming the same open shift resolves predictably at the database level

## 15. Next Steps

1. Confirm the payroll processor (Gusto / QuickBooks Payroll / ADP / other) so the CSV export format is built right the first time
2. Confirm rounding rule (nearest 5, 10, or 15 minutes) and OT treatment for any staff who might be exempt
3. Decide MVP clock-in mode: individual login (Option A) vs. shared kiosk (Option B) — recommend starting with A
4. Apply the migration in §14 as the first Supabase step, then build week-by-week (§8) or day-by-day (§9) against this file
5. Run payroll in parallel (old method + new system) for one full pay period before fully cutting over
