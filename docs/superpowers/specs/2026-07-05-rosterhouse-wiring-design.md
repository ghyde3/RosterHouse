# RosterHouse — Next.js app + DB design (wiring the Claude Design export)

**Date:** 2026-07-05
**Status:** Awaiting user review (decisions below were made autonomously with
reasoning; flag anything you'd choose differently)
**Inputs:** `RosterHouse Design System/` export; multi-agent design review
(6 readers + completeness critic, findings summarized in
`docs/superpowers/specs/2026-07-05-design-review-findings.md`)

## What we're building

Wire the two designed click-through kits into a working product on one
Next.js app backed by Postgres, deployable to Railway:

- **Manager web** (`/manager/...`): dashboard, schedule builder
  (week/day/month), team, availability overview, time-off approvals,
  swaps & open-shift approvals.
- **Employee mobile web** (`/(employee)/...`): login, accept invite, my
  shifts + detail, availability, time clock, open shifts/swap,
  notifications, profile.

MVP loop: employees set availability → manager assigns shifts with conflict
warnings → manager publishes → employees are notified and view the schedule.

## Decisions (with reasoning)

1. **Single Next.js app, two route groups** — both kits are web (the
   "mobile app" is mobile-web). One deploy, one auth system, shared domain
   layer. A native app can consume the same API later.
2. **Postgres + Prisma 7** — Railway's first-class DB; Prisma 7 with the pg
   driver adapter (schema in `prisma/schema.prisma`, applied). Local dev via
   `docker compose up -d`.
3. **Auth: Auth.js (next-auth v5), Credentials provider, JWT sessions** —
   login is phone-or-email + password per the designs; invites create the
   account. No OAuth need; JWT keeps us free of session tables. Manager
   login reuses the employee login screen design (`role` decides the
   redirect). OTP/magic-link can come later (design flags SMS-first users).
4. **No Tailwind** — the design system is CSS custom properties + inline
   styles. Tokens are imported globally; components get ported to typed
   `.tsx` with CSS classes for hover/press (shrinks the client boundary vs.
   the kit's JS hover state).
5. **Icons: `lucide-react` (pinned)** — replaces the unpinned unpkg CDN +
   `createIcons()` pattern. Fonts: Figtree self-hosted via `next/font`
   (done).
6. **Conflicts are computed, never stored** — double-booked, outside
   availability, overtime (per-location weekly threshold, default 40h,
   nullable to disable). Recomputed on schedule reads and on a
   `POST /api/shifts/validate` dry-run so the assign dialog can warn before
   save — the review found the MVP's flagship interaction has display
   components but no trigger; we design that trigger in the plan.
7. **"Coverage gaps" = count of open (unassigned) shifts this week** for
   v1. The designed stat is otherwise uncomputable — real coverage needs
   per-position staffing targets that have no screens. A
   `StaffingRequirement` entity is deferred until that UI exists.
8. **Qualifications are many-to-many** (`EmployeePosition` join): the
   export's own demo data has a Server and a Host working Dishwasher
   shifts, and swap copy says "anyone qualified". Primary position remains
   for display.
9. **Notifications: in-app rows first; SMS/push behind a provider
   interface** — publish/approve/deny write `Notification` rows and fan out
   through a `Notifier` interface. v1 ships a console/log driver; Twilio
   (SMS) and web push are drop-in follow-ups. iOS web push requires an
   installed PWA + service worker, so push is explicitly phase-2 with a PWA
   pass; SMS is the realistic primary channel for this audience.
10. **Time semantics** — `Location.timezone` (IANA) is the source of truth;
    shifts store UTC instants plus a location-local service date (shifts
    cross midnight in the designs); weeks start Monday; display is 12-hour
    clock ("7:00 AM – 3:00 PM") and "8 hrs" durations everywhere.
11. **Geofenced clock-in is soft in v1** — record lat/lng and flag
    out-of-range rather than block (fields exist on `Location`; the strict
    policy and its settings UI are deferred).
12. **Missing screens get minimal net-new UI from existing primitives** —
    the review found four blockers with no designs: manager auth +
    org/location bootstrap, invite/team management, the conflict-warning
    moment, and the swap composer. These are built from the kit's
    primitives (Dialog, Select, Input, Card, Badge) following the design
    system's conventions rather than waiting on new design work.
13. **Fresh seed data** — the kits' mock arrays are mutually inconsistent
    (day-of-week errors, a swap referencing a nonexistent shift, three
    different "notified" counts) and can't be translated; `prisma/seed.ts`
    authors a coherent demo org instead.

## Architecture

```
src/
  app/
    (auth)/login, /invite/[token], /forgot-password
    manager/            # left-rail layout: dashboard, schedule, team,
                        # availability, time-off, swaps
    (employee)/         # bottom-tab layout: home, shifts/[id], availability,
                        # clock, swaps, notifications, profile
    api/                # route handlers (see endpoint list in findings doc)
  components/ui/        # 16 ported primitives + Toaster, Textarea, Sheet,
                        # TimeField, Icon, Avatar, StatCard, nav chrome
  lib/                  # db.ts, auth.ts, time.ts (tz math), conflicts.ts,
                        # notify/ (Notifier interface + drivers), authz.ts
  styles/tokens/        # ported token CSS (done)
prisma/                 # schema (applied), migrations, seed.ts
```

- **Data flow:** server components fetch via `lib` query helpers; mutations
  are route handlers (single API also serves a future native app); every
  handler enforces session → org → location membership (tenancy is
  server-side, not UI-side).
- **Validation:** zod schemas shared between route handlers and forms;
  times accepted as "h:mm AM/PM" and normalized.
- **Publish** is the key transaction: flip schedule + draft shifts to
  published atomically, then fan out notifications to distinct affected
  employees and return the real notified count (the kits hardcode three
  different numbers).
- **Error handling:** every screen gets the loading/empty/error states the
  kits omit; API errors return typed JSON consumed by a toast layer.
- **Testing:** unit tests for `conflicts.ts` and `time.ts` (the risky
  logic: overlaps, midnight-crossing, DST, OT accumulation), integration
  tests on publish/swap/claim approval transactions, plus `/qa` passes on
  the flows.

## Out of scope (deliberately)

Drag-and-drop scheduling (click-to-assign is the designed interaction; DnD
is a later enhancement), billing, payroll/POS/reporting (phase 3),
multi-location switcher UI (modeled in schema, single location in UI),
PWA/offline/push delivery (phase 2), SMS provider hookup (interface ready,
driver stubbed), manager mobile responsiveness (fixed rail per design).
