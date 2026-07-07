# RosterHouse — Feature Ideas

A review of the app as it stands today, and a prioritized list of features we could add.

## Where the app is today

RosterHouse covers the core scheduling loop end to end: managers build and publish weekly schedules with derived conflict detection (double-booking, availability, overtime), employees view shifts, set availability, swap shifts, claim open shifts, request time off, and clock in/out with geofencing. Managers approve requests, review timesheets, export CSV, and manage positions, templates, and location settings. In-app notifications work; SMS/push delivery is stubbed behind a console driver.

The ideas below are grouped by how directly they build on what already exists.

---

## Tier 1 — Finish what's started (highest leverage, lowest risk)

These close gaps where the schema, UI copy, or data model already promises the feature.

### 1. Self-serve password reset
`/forgot-password` is a static placeholder that tells users to contact their manager. Add a reset-token table, a request/confirm API pair, and an email send. This blocks real-world adoption — locked-out employees currently have no recovery path.

### 2. Real SMS and push delivery
`src/lib/notify/console-driver.ts` only logs delivery intents, but the product's whole pitch is "employees get a text link." Wire up Twilio (SMS) and web-push/VAPID (the `PushDevice` table already exists but nothing registers subscriptions). Includes a service-worker registration flow on the employee app and a "enable notifications" prompt on `/profile`.

### 3. Email notification channel
`EmployeeProfile.notifyEmail` exists in the schema and in the prefs UI model, but `notifyUsers` only fans out to SMS + push. Add an email driver (Resend/Postmark/SES) and send schedule-published, approval, and reminder emails. Also unlocks #1.

### 4. Automated shift reminders
The `shift_reminder` NotificationType exists but nothing fires it. Add a scheduled job (Railway cron or a `/api/cron/reminders` route hit by an external scheduler) that notifies employees N hours before a shift starts, respecting the location timezone. Reminder lead time could be a location setting.

### 5. Multi-location support
The schema is fully multi-location (Organization → Location, one `EmployeeProfile` per user+location) but the app assumes one location per user (`getManagerLocation` is documented as "v1: sole location"). Add a location switcher for managers, per-location scoping in the sidebar, and cross-location conflict detection for employees who work at more than one site.

---

## Tier 2 — Round out the manager workflow

### 6. Labor cost forecasting & budget targets
The dashboard already computes projected vs. actual labor cost from `hourlyRate`. Extend it: set a weekly labor budget (or target % of sales) per location, show live budget burn while building the schedule, and warn in the publish dialog when over budget.

### 7. Reporting & analytics page
There's one dashboard and a CSV export today. Add a `/manager/reports` section: hours by employee/position over time, overtime trends, scheduled-vs-actual hours (schedule adherence), late clock-ins, time-off usage, and open-shift fill rate. Most data already exists in `Shift` + `TimeClockEntry`.

### 8. Copy previous week / auto-fill schedule
Templates exist, but the most common real-world action is "do what we did last week." Add one-click copy-last-week (assignments included, with conflicts re-derived), and a "suggest assignments" pass that fills open shifts from availability + qualified positions + fewest-hours-first.

### 9. Shift confirmation / read receipts
After publishing, managers can't tell who has actually seen the schedule. Track notification opens or add an explicit "confirm" tap on the employee shift view, and show confirmed/unconfirmed status per employee on the manager schedule.

### 10. Manager notes & shift instructions
`Shift.notes` exists — surface it better: rich per-day notes on the schedule ("truck delivery at 7am"), visible to everyone scheduled that day, plus pinned location-wide announcements.

### 11. Timesheet approval & payroll export formats
Timesheets are editable and export to generic CSV. Add an explicit approve/lock step per pay period and preformatted exports for common payroll providers (Gusto, ADP, QuickBooks), including OT split-out based on the existing `overtimeHoursPerWeek` setting.

---

## Tier 3 — Round out the employee experience

### 12. Availability effective dates & one-off exceptions
`AvailabilityRule` is weekly-recurring only. Add date-bounded overrides ("can't work next Tuesday" without burning a time-off request) and "availability changes take effect on date X" so managers aren't surprised mid-week.

### 13. Shift drop requests
Employees can swap, but can't simply ask to drop a shift (which becomes an open shift on approval). It's a small addition on top of the existing `SwapRequest`/approval machinery and matches how hourly teams actually operate.

### 14. iCal / Google Calendar feed
A per-employee tokenized `.ics` feed URL so shifts appear in their phone calendar automatically. Cheap to build (shifts are already UTC instants + timezone) and high perceived value.

### 15. Time-off balances
`TimeOffRequest` tracks requests but not entitlement. Add optional accrual/balance tracking per employee (vacation/sick hours), shown to both the employee when requesting and the manager when approving.

### 16. Team contact & shift-mate visibility
Let employees see who else is working their shift (already implicit in the schedule data) and optionally a location contact list — useful for arranging swaps out-of-band.

---

## Tier 4 — Bigger bets

### 17. Billing & subscriptions
The landing page says pricing isn't published yet; there's no payment integration. Stripe subscriptions with per-active-employee pricing, a free tier, and plan gating (e.g. multi-location and reports as paid features). Prerequisite for launch as a business.

### 18. Native mobile app / PWA hardening
The roadmap notes the API "also serves a future native client." A near-term step: make the employee app a proper installable PWA (manifest, offline shift viewing, service worker — which #2's push work already requires). Longer term: React Native/Expo client on the existing API.

### 19. Labor-law compliance guardrails
Extend the conflict engine with configurable rules: minimum rest between shifts ("clopening" detection), max consecutive days, minor work restrictions, and predictive-scheduling notice periods (required in several US cities). Fits naturally into the existing derived-at-read-time conflict architecture.

### 20. Manager audit log
Decision audit fields exist on requests and time-clock edits, but there's no unified view. An org-level activity log (who published, who edited a punch, who changed a rate) — table stakes for larger customers and a natural paid-tier feature.

---

## Suggested sequencing

1. **Now:** #1 password reset, #3 email channel, #2 real SMS/push — the app looks feature-complete but can't actually reach users.
2. **Next:** #4 shift reminders, #8 copy-last-week, #14 iCal feed — small builds, big daily-use payoff.
3. **Then:** #7 reports, #11 payroll exports, #5 multi-location — deepen the manager value proposition.
4. **Later:** #17 billing once there's usage worth charging for, and #19 compliance as a differentiator.
