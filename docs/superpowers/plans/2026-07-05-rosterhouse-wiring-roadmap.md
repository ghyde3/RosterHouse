# RosterHouse Wiring Roadmap (master plan)

> **For agentic workers:** This is the index + shared contracts. Execute the
> phase plans in order via superpowers:subagent-driven-development or
> superpowers:executing-plans; each phase plan is self-contained:
> - Phase 1: `2026-07-05-phase-1-design-system-port.md`
> - Phase 2: `2026-07-05-phase-2-auth-tenancy.md`
> - Phase 3: `2026-07-05-phase-3-manager-scheduling.md`
> - Phase 4: `2026-07-05-phase-4-employee-app.md`
> - Phase 5: `2026-07-05-phase-5-requests-timeclock.md`

**Goal:** Wire the Claude Design export into a working shift-management app
on the scaffolded Next.js + Prisma/Postgres stack, deployable to Railway.

**Architecture:** Single Next.js App Router app; `/manager` route group
(left rail) and `/(employee)` route group (bottom tabs); route-handler API
under `/api` (also serves a future native client); server components read
via `src/lib` query helpers; all mutations enforce session → org → location
tenancy server-side. Conflicts computed, never stored. Publish is a
transaction with notification fan-out.

**Tech stack (pinned):** Next.js 16.2 / React 19 / TypeScript · Prisma 7 +
`@prisma/adapter-pg` (client generated to `src/generated/prisma`) ·
PostgreSQL 17 · Auth.js `next-auth@beta` (v5) Credentials + JWT ·
`zod@4` · `lucide-react` · `date-fns@4` + `@date-fns/tz` · `bcryptjs` ·
`vitest` + `@testing-library/react` · no Tailwind (design-token CSS).

**Spec:** `docs/superpowers/specs/2026-07-05-rosterhouse-wiring-design.md`
**Review findings:** `docs/superpowers/specs/2026-07-05-design-review-findings.md`
**Schema:** `prisma/schema.prisma` (migration `init` applied)

## Global constraints (apply to every task in every phase)

- Copy rules (from the design readme): sentence case everywhere; 12-hour
  times ("7:00 AM – 3:00 PM", en dash, never military); durations as
  "8 hrs"; no emoji in UI chrome; calm confirmations (no exclamation
  points); errors specific and actionable ("This shift overlaps with
  Maria's 2:00 PM – 6:00 PM shift"), never blaming.
- Styling: design tokens only — no raw hex colors, no font-family other
  than Figtree (`var(--font-sans)`). Hover/press via CSS `:hover` /
  `:active` classes (CSS Modules), not JS state. Focus states use
  `--shadow-focus` + brand ring.
- All interactive elements are real `<button>`/`<a>`/`<input>` elements
  with keyboard focus — never onClick divs (the export's dominant defect).
- Weeks start Monday. `Location.timezone` (IANA) drives all wall-clock
  rendering; shifts store UTC instants + location-local service `date`.
- Every screen ships loading, empty, and error states.
- Every API handler: zod-validate input → authenticate → tenancy check →
  act → typed JSON (`{ ok: true, data }` / `{ ok: false, error }`).
- Test-first (vitest) for `src/lib` logic; route handlers get integration
  tests against the docker Postgres; commit at the end of every task.

## Phase sequence and deliverables

| Phase | Delivers | Depends on |
|---|---|---|
| 1. Design-system port | 16 primitives + 9 net-new (typed .tsx, a11y-correct), Icon set, nav chrome, `/design-system` gallery route, lint guardrails, vitest setup | — (schema/scaffold done) |
| 2. Auth & tenancy | Signup wizard (org+location+positions bootstrap), login, invites (send + accept), team CRUD, session/authz helpers, seed data | 1 (primitives) |
| 3. Manager scheduling | time/conflict libs, week/day/month schedule views wired, assign dialog with live conflict warnings, publish transaction + in-app notifications, real dashboard | 2 |
| 4. Employee app | Home/my-shifts, shift detail, availability editor (with save), manager availability overview, notifications feed + bell | 3 |
| 5. Requests & time clock | Time-off request/approve, swap composer + approvals, open-shift claim/approve, geolocated time clock, Notifier drivers (console v1) | 4 |

Railway deploy is verified at the end of each phase (config exists:
`railway.json`, preDeploy `prisma migrate deploy`, healthcheck
`/api/health`).

## Shared contracts (phase plans MUST use these exact names/signatures)

### Route map

```
/                       public marketing landing page (BUILT — src/app/page.tsx)
/login  /signup  /invite/[token]  /forgot-password          (auth pages)
/manager                → dashboard
/manager/schedule       ?week=YYYY-MM-DD&view=week|day|month
/manager/team           (+ invite dialog, member edit)
/manager/availability
/manager/time-off
/manager/swaps
/(employee)/shifts      → "/shifts" — employee home ("My shifts")
/(employee)/shifts/[shiftId]
/(employee)/availability
/(employee)/clock
/(employee)/swaps       (open shifts + my swap requests)
/(employee)/notifications
/(employee)/profile
```

Middleware: `/` is public (marketing) — authenticated users hitting `/`
redirect by role (manager → `/manager`, employee → `/shifts`);
unauthenticated users hitting app routes → `/login`; employees hitting
`/manager/*` → `/shifts`; managers hitting employee tabs → `/manager`.
The employee home lives at `/shifts` so the marketing page can own `/`
(a root `page.tsx` and `(employee)/page.tsx` cannot both resolve `/`).

### `src/lib/time.ts` (Phase 3 implements; 3/4/5 consume)

```ts
type ISODate = string; // "2026-07-06"
weekStartOf(d: Date, timezone: string): ISODate            // Monday
addDaysISO(d: ISODate, n: number): ISODate
weekDatesOf(weekStart: ISODate): ISODate[]                  // 7 entries
parseTime12h(input: string): { hour: number; minute: number } | null
                                                            // "7:00 AM"; null = invalid
localToUtc(date: ISODate, time: {hour:number;minute:number}, timezone: string): Date
formatTime(instant: Date, timezone: string): string         // "7:00 AM"
formatShiftRange(startsAt: Date, endsAt: Date, timezone: string): string
                                                            // "7:00 AM – 3:00 PM"
shiftDurationHours(startsAt: Date, endsAt: Date): number     // 8, 7.5
formatDurationHrs(hours: number): string                     // "8 hrs", "7.5 hrs"
formatDayLabel(d: ISODate): string                           // "Mon 6"
```
End-before-start means the shift crosses midnight (ends next day). Built on
`date-fns@4` + `@date-fns/tz` (`TZDate`).

### `src/lib/conflicts.ts` (Phase 3 implements; 3/5 consume)

```ts
type ConflictKind = 'double_booked' | 'outside_availability' | 'overtime';
type Conflict = { kind: ConflictKind; message: string };
type ProposedShift = {
  shiftId?: string;                 // exclude self when editing
  employeeProfileId: string | null; // null (open shift) → no conflicts
  date: ISODate; startsAt: Date; endsAt: Date;
};
detectConflicts(shift: ProposedShift, ctx: ConflictContext): Conflict[];
type ConflictContext = {
  timezone: string;
  employeeName: string;
  employeeShifts: { id: string; startsAt: Date; endsAt: Date; positionName: string }[]; // same week
  availability: { dayOfWeek: number; isAvailable: boolean; startTime: string|null; endTime: string|null }[];
  approvedTimeOff: { startDate: ISODate; endDate: ISODate }[];
  overtimeHoursPerWeek: number | null;  // null = OT checks off
};
buildConflictContext(employeeProfileId: string, weekStart: ISODate): Promise<ConflictContext>; // prisma-backed
```
Approved time off renders as `outside_availability` with message
"…has approved time off Jul 14 – Jul 16".

### `src/lib/auth.ts` + `src/lib/authz.ts` (Phase 2 implements; all consume)

```ts
// auth.ts (Auth.js v5)
export const { handlers, auth, signIn, signOut }: NextAuthResult;
// JWT session; session.user: { id, name, role: 'manager'|'employee', organizationId }
requireUser(): Promise<SessionUser>;      // redirect('/login') if absent
requireManager(): Promise<SessionUser>;   // + redirect('/shifts') if employee
// authz.ts
getManagerLocation(userId: string): Promise<Location>;   // v1: sole location
getEmployeeProfile(userId: string): Promise<EmployeeProfile & { location: Location; primaryPosition: Position | null }>;
assertLocationMember(userId: string, locationId: string): Promise<void>; // throws 403
hashPassword(plain: string): Promise<string>;             // bcryptjs, 10 rounds
verifyPassword(plain: string, hash: string): Promise<boolean>;
```

### `src/lib/notify/index.ts` (Phase 3 implements minimal; Phase 5 extends)

```ts
type NotifyInput = { userId: string; type: NotificationType; title: string; body: string };
notifyUsers(inputs: NotifyInput[]): Promise<{ count: number }>;
// writes Notification rows, then per-user channel prefs → driver
interface ChannelDriver {
  sendSms(phone: string, body: string): Promise<void>;
  sendPush(deviceToken: string, payload: { title: string; body: string }): Promise<void>;
}
// v1 driver: ConsoleDriver (logs). Twilio/web-push are drop-in later.
```

### API response envelope (all phases)

```ts
type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string } };
// src/lib/api.ts: jsonOk(data), jsonErr(code, message, status)
```

### Component library (Phase 1 implements; all consume)

Ported primitives keep their `.d.ts` prop names, and additionally all
accept `className?: string`, spread rest props onto the root element, and
forward refs: `Button, Input, Select, Checkbox, Switch, Badge, Tag, Toast,
Tooltip, Card, Dialog, Tabs, ShiftBlock, WeekGridCell, AvatarStatus,
ConflictChip` in `src/components/ui/<Name>.tsx`.

Net-new primitives (same folder): `Icon` (pinned lucide-react set,
strokeWidth 1.75 default), `Avatar` (initials, no status dot), `Textarea`,
`TimeField` (12-hour text field with `parseTime12h` validation +
error state), `Toaster`/`useToast()` (portal, queue, 3.5s auto-dismiss),
`Sheet` (mobile bottom sheet), `StatCard`, `EmptyState`, `Spinner`.

App chrome in `src/components/chrome/`: `ManagerSidebar`, `EmployeeTabBar`,
`EmployeeTopBar`, `DatePager`.

### Seed (`prisma/seed.ts`, Phase 2)

Fresh coherent dataset (the export's mock data is contradictory — do not
translate it): org "Harbor & Vine", location "Downtown" (America/New_York,
OT 40), positions Line cook/Server/Dishwasher/Host, manager Jamie Park
(`jamie@harborvine.test` / `rosterhouse1`), 10 employees incl. Maria Garcia
(`maria@harborvine.test` / `rosterhouse1`), multi-position qualifications,
availability rules, current + next week schedules (current published, next
draft) with one open shift and one deliberate double-booking, one pending
time-off, one pending swap, one pending claim.

## Verification gates (end of each phase)

1. `npm run build` passes; `npx vitest run` green.
2. Phase-specific manual QA flow listed at the end of each phase plan
   (use `/qa` skill against `npm run dev`).
3. `git log` shows per-task commits; working tree clean.
