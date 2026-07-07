# Phase 4 — Timesheets / Time & Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Turn the clock-in/out punches into weekly manager timesheets with computed hours, actual labor cost, schedule-vs-actual reconciliation (no-show / late / overtime), manager punch corrections with an audit trail, and CSV export.

**Architecture:** A read-time data layer (`src/lib/timesheet-data.ts`) fetches one week of `TimeClockEntry` rows plus that week's shifts and derives per-employee hours, cost, and reconciliation flags (nothing is stored). A server page `/manager/timesheets` renders it via a client `TimesheetsView` with weekly `DatePager` nav; three manager-guarded API routes (`POST/PATCH/DELETE /api/time-clock-entries[/id]`) let managers add/edit/delete punches, each stamped with `editedByUserId`/`editedAt`; a CSV export route streams the same computed data. The dashboard gains an actual-labor-cost figure beside the projected one.

**Tech Stack:** Next.js 16, Prisma 7 + Postgres, zod 4, React 19, Vitest 4, CSS modules.

## Global Constraints

- Next.js 16 App Router: route-handler params are `{ params: Promise<{ id: string }> }` and MUST be awaited; server pages take `searchParams`/`params` as Promises.
- Tenancy on EVERY endpoint: `const guard = await requireManagerForApi(); if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);` then scope to `guard.location.id`; for punch routes compare `entry.locationId === guard.location.id`.
- JSON envelopes from `@/lib/api`: `jsonOk(data, status?)`, `jsonErr(code,message,status)`, wrap handlers in `try {…} catch (err) { return handleApiError(err); }`, throw `new ApiError(status,code,message)` in lib helpers.
- Prisma: `import { prisma } from "@/lib/db";`; types: `import { Prisma } from "@/generated/prisma/client";`.
- Reconciliation is **computed at read time, never stored**. Timesheets are **weekly**, navigated by date range like the schedule pager (weekStart is a Monday ISO date).
- **Late** = an entry whose `shiftId` matches an assigned published shift AND `clockInAt > shift.startsAt + 5 min` (fixed 5-minute grace).
- **No-show** = an assigned, published shift in the week with **no** `TimeClockEntry` pointing at it (`shiftId`).
- **Overtime** = `hoursActual` (sum of completed entries) `> location.overtimeHoursPerWeek` (skip when the threshold is null).
- **Incomplete** entry = `clockOutAt === null`; excluded from `hoursActual`/`laborCost` totals but still listed and flagged.
- Hours use the interval formula from `src/lib/timeclock.ts` (`sumHoursToday`): `(clockOutAt - clockInAt) / 3_600_000`, rounded to one decimal.
- `laborCost` = `hoursActual × hourlyRate`; **null** when the employee has no `hourlyRate`.
- Manager punch APIs accept ISO-8601 datetime strings (`clockInAt`, `clockOutAt`); each mutation stamps `editedByUserId = guard.userId` and `editedAt = new Date()`.
- CSV export: `GET /api/locations/[locationId]/timesheets/export?weekStart=…` → `text/csv`; tenancy `guard.location.id === locationId`.
- No Tailwind — CSS modules + design tokens (`var(--...)`). UI kit from `@/components/ui/{...}` (no barrel). `useRouter().refresh()` after mutations; toast via `useToast` from `@/components/ui/Toaster`.
- The `timer` glyph is ALREADY registered in `src/components/ui/Icon.tsx` — no Icon change is needed.
- Commit after EVERY task with a `feat:`/`test:` message.

---

## Task 1 — Migration: audit fields on TimeClockEntry

Adds the nullable audit columns the manager-correction routes stamp. No behaviour change yet; this task only proves the schema/generated client updates.

**Files:**
- Modify: `prisma/schema.prisma` (add two fields to `model TimeClockEntry`)
- (Generated) `prisma/migrations/<timestamp>_timeclock_audit_fields/migration.sql`
- Test: `src/tests/timeclock-audit-fields.test.ts` (Create)

**Interfaces:**
- Produces: `TimeClockEntry.editedByUserId: string | null`, `TimeClockEntry.editedAt: Date | null` on the generated Prisma type.
- Consumes: existing `TimeClockEntry` model, `createFixture`/`destroyFixture` from `./helpers/factory`.

**Steps:**

1. - [ ] Write the failing test at `src/tests/timeclock-audit-fields.test.ts`:
   ```ts
   // @vitest-environment node
   import { afterAll, beforeAll, describe, expect, it } from "vitest";
   import { prisma } from "@/lib/db";
   import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

   describe("TimeClockEntry audit fields", () => {
     let f: Fixture;
     beforeAll(async () => {
       f = await createFixture();
     });
     afterAll(async () => {
       await destroyFixture(f);
     });

     it("defaults the audit fields to null and can persist a stamp", async () => {
       const created = await prisma.timeClockEntry.create({
         data: { employeeProfileId: f.ana.profileId, locationId: f.locationId, clockInAt: new Date() },
       });
       expect(created.editedByUserId).toBeNull();
       expect(created.editedAt).toBeNull();

       const stamp = new Date();
       const updated = await prisma.timeClockEntry.update({
         where: { id: created.id },
         data: { editedByUserId: f.managerUserId, editedAt: stamp },
       });
       expect(updated.editedByUserId).toBe(f.managerUserId);
       expect(updated.editedAt?.getTime()).toBe(stamp.getTime());
     });
   });
   ```

2. - [ ] Run it and expect FAIL (the columns don't exist yet — Prisma type error / runtime error):
   `npm test -- src/tests/timeclock-audit-fields.test.ts`

3. - [ ] Add the two fields to `model TimeClockEntry` in `prisma/schema.prisma`, immediately after the `createdAt` line (before the blank line preceding the relations):
   ```prisma
     createdAt         DateTime  @default(now())
     editedByUserId    String?   // manager who last corrected this entry (audit)
     editedAt          DateTime? // when it was corrected
   ```

4. - [ ] Create and apply the migration, then regenerate the client:
   `npx prisma migrate dev --name timeclock_audit_fields`
   then
   `npx prisma generate`

5. - [ ] Run the test and expect PASS:
   `npm test -- src/tests/timeclock-audit-fields.test.ts`

6. - [ ] Commit:
   `git add prisma/schema.prisma prisma/migrations src/tests/timeclock-audit-fields.test.ts && git commit -m "feat: add TimeClockEntry audit fields (editedByUserId, editedAt)"`

---

## Task 2 — `getTimesheetWeekData` (read-time data layer)

The heart of the feature: fetches a week's entries + shifts and derives per-employee hours, cost, and reconciliation flags. Pure derivation over Prisma reads, tested directly against the DB.

**Files:**
- Create: `src/lib/timesheet-data.ts`
- Test: `src/tests/timesheet-data.test.ts` (Create)

**Interfaces:**
- Produces:
  ```ts
  export type TimesheetEntry = {
    id: string;
    date: ISODate;            // location-local service date of clockInAt
    clockInAt: string;        // ISO instant
    clockOutAt: string | null;
    hours: number;            // 0 when incomplete
    shiftId: string | null;
    shiftLabel: string | null; // "4:00 PM – 10:00 PM" when matched
    incomplete: boolean;      // clockOutAt === null
    late: boolean;            // matched shift, clockInAt > start + 5 min
    edited: boolean;          // editedAt != null
  };
  export type TimesheetEmployee = {
    profileId: string;
    name: string;
    primaryPositionName: string | null;
    hourlyRate: number | null;
    entries: TimesheetEntry[];
    hoursActual: number;      // sum of completed entries, 1-dp
    laborCost: number | null; // hoursActual * hourlyRate, null if no rate
    lateCount: number;
    noShowCount: number;
    overtime: boolean;        // hoursActual > overtimeHoursPerWeek
  };
  export type TimesheetWeekData = {
    weekStart: ISODate;
    overtimeHoursPerWeek: number | null;
    employees: TimesheetEmployee[];
  };
  export const LATE_GRACE_MS = 5 * 60 * 1000;
  export function entryHours(clockInAt: Date, clockOutAt: Date | null): number;
  export async function getTimesheetWeekData(locationId: string, weekStart: ISODate): Promise<TimesheetWeekData>;
  ```
- Consumes: `prisma` (`@/lib/db`); `ISODate`, `weekDatesOf`, `addDaysISO`, `localISODate`, `formatShiftRange` (`@/lib/time`).

**Steps:**

1. - [ ] Write the failing test at `src/tests/timesheet-data.test.ts`:
   ```ts
   // @vitest-environment node
   import { afterAll, beforeAll, describe, expect, it } from "vitest";
   import { prisma } from "@/lib/db";
   import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
   import { entryHours, getTimesheetWeekData, LATE_GRACE_MS } from "@/lib/timesheet-data";
   import { localToUtc, weekStartOf } from "@/lib/time";

   // A fixed Monday in the fixture timezone (America/New_York).
   const WEEK = "2026-07-06";
   // 09:00 local on WEEK, as a UTC instant.
   function at(dateISO: string, hour: number, minute = 0): Date {
     return localToUtc(dateISO, { hour, minute }, "America/New_York");
   }

   describe("entryHours", () => {
     it("returns 0 for an open entry", () => {
       expect(entryHours(new Date(), null)).toBe(0);
     });
     it("rounds to one decimal", () => {
       const a = at(WEEK, 9);
       const b = at(WEEK, 12, 30);
       expect(entryHours(a, b)).toBe(3.5);
     });
     it("sums a cross-midnight span correctly", () => {
       const a = at(WEEK, 22); // 10 PM
       const b = at("2026-07-07", 2); // 2 AM next day
       expect(entryHours(a, b)).toBe(4);
     });
   });

   describe("getTimesheetWeekData", () => {
     let f: Fixture;
     beforeAll(async () => {
       f = await createFixture();

       // Ana: on-time completed 09:00–17:00 (8h) matched to a shift.
       const anaShift = await createShiftAt(f, {
         positionId: f.positionIds.server,
         employeeProfileId: f.ana.profileId,
         startsAt: at(WEEK, 9),
         endsAt: at(WEEK, 17),
       });
       await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: f.ana.profileId,
           locationId: f.locationId,
           shiftId: anaShift.id,
           clockInAt: at(WEEK, 9),
           clockOutAt: at(WEEK, 17),
         },
       });
       // Ana rate → labor cost is computable.
       await prisma.employeeProfile.update({
         where: { id: f.ana.profileId },
         data: { hourlyRate: 20 },
       });

       // Ben: LATE (matched shift starts 09:00, clock-in 09:10) + an INCOMPLETE entry.
       const benShift = await createShiftAt(f, {
         positionId: f.positionIds.server,
         employeeProfileId: f.ben.profileId,
         startsAt: at("2026-07-07", 9),
         endsAt: at("2026-07-07", 17),
       });
       await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: f.ben.profileId,
           locationId: f.locationId,
           shiftId: benShift.id,
           clockInAt: at("2026-07-07", 9, 10), // 10 min late
           clockOutAt: at("2026-07-07", 17),
         },
       });
       await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: f.ben.profileId,
           locationId: f.locationId,
           clockInAt: at("2026-07-08", 9),
           clockOutAt: null, // incomplete
         },
       });

       // Cal: NO-SHOW — an assigned published shift this week with no entry.
       await createShiftAt(f, {
         positionId: f.positionIds.server,
         employeeProfileId: f.cal.profileId,
         startsAt: at("2026-07-09", 9),
         endsAt: at("2026-07-09", 17),
       });
     });
     afterAll(async () => {
       await destroyFixture(f);
     });

     it("computes hours, cost, and reconciliation flags per employee", async () => {
       expect(weekStartOf(at(WEEK, 9), f.timezone)).toBe(WEEK); // sanity: WEEK is the Monday
       const data = await getTimesheetWeekData(f.locationId, WEEK);
       expect(data.weekStart).toBe(WEEK);
       expect(data.overtimeHoursPerWeek).toBe(40);

       const byName = Object.fromEntries(data.employees.map((e) => [e.name, e]));

       const ana = byName["Ana Diaz"];
       expect(ana.hoursActual).toBe(8);
       expect(ana.laborCost).toBe(160); // 8 * 20
       expect(ana.lateCount).toBe(0);
       expect(ana.noShowCount).toBe(0);
       expect(ana.overtime).toBe(false);
       expect(ana.entries).toHaveLength(1);
       expect(ana.entries[0].late).toBe(false);
       expect(ana.entries[0].incomplete).toBe(false);
       expect(ana.entries[0].shiftLabel).not.toBeNull();

       const ben = byName["Ben Cho"];
       expect(ben.hoursActual).toBe(8); // incomplete entry excluded from the total
       expect(ben.laborCost).toBeNull(); // no rate
       expect(ben.lateCount).toBe(1);
       expect(ben.entries).toHaveLength(2);
       const late = ben.entries.find((e) => e.late);
       expect(late?.late).toBe(true);
       const open = ben.entries.find((e) => e.incomplete);
       expect(open?.hours).toBe(0);

       const cal = byName["Cal Ito"];
       expect(cal.noShowCount).toBe(1);
       expect(cal.entries).toHaveLength(0);
     });

     it("exposes LATE_GRACE_MS as five minutes", () => {
       expect(LATE_GRACE_MS).toBe(5 * 60 * 1000);
     });
   });
   ```

2. - [ ] Run it and expect FAIL (module `@/lib/timesheet-data` does not exist):
   `npm test -- src/tests/timesheet-data.test.ts`

3. - [ ] Implement `src/lib/timesheet-data.ts` in full:
   ```ts
   // src/lib/timesheet-data.ts — read-time weekly timesheet + reconciliation.
   // Nothing here is stored: hours and the no-show/late/overtime flags are all
   // derived on each read (mirrors the conflicts engine).
   import { prisma } from "@/lib/db";
   import {
     addDaysISO,
     formatShiftRange,
     localISODate,
     weekDatesOf,
     type ISODate,
   } from "@/lib/time";

   /** Fixed grace window: a matched clock-in later than start + 5 min is "late". */
   export const LATE_GRACE_MS = 5 * 60 * 1000;

   export type TimesheetEntry = {
     id: string;
     date: ISODate;
     clockInAt: string;
     clockOutAt: string | null;
     hours: number;
     shiftId: string | null;
     shiftLabel: string | null;
     incomplete: boolean;
     late: boolean;
     edited: boolean;
   };

   export type TimesheetEmployee = {
     profileId: string;
     name: string;
     primaryPositionName: string | null;
     hourlyRate: number | null;
     entries: TimesheetEntry[];
     hoursActual: number;
     laborCost: number | null;
     lateCount: number;
     noShowCount: number;
     overtime: boolean;
   };

   export type TimesheetWeekData = {
     weekStart: ISODate;
     overtimeHoursPerWeek: number | null;
     employees: TimesheetEmployee[];
   };

   /** Interval hours, 1-dp; an open entry (no clock-out) is 0. Mirrors sumHoursToday. */
   export function entryHours(clockInAt: Date, clockOutAt: Date | null): number {
     if (clockOutAt === null) return 0;
     const ms = clockOutAt.getTime() - clockInAt.getTime();
     return Math.round((ms / 3_600_000) * 10) / 10;
   }

   export async function getTimesheetWeekData(
     locationId: string,
     weekStart: ISODate,
   ): Promise<TimesheetWeekData> {
     const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
     const tz = location.timezone;
     const dates = weekDatesOf(weekStart);
     // Fetch entries whose clock-in falls inside the local week [Mon 00:00, next Mon 00:00).
     const weekStartInstant = new Date(`${weekStart}T00:00:00.000Z`);
     const weekEndInstant = new Date(`${addDaysISO(weekStart, 7)}T00:00:00.000Z`);
     // The @db.Date shift column is stored UTC-midnight, so bound by date value.
     const shiftDateLo = new Date(`${weekStart}T00:00:00.000Z`);
     const shiftDateHi = new Date(`${dates[6]}T00:00:00.000Z`);

     const [profiles, entries, shifts] = await Promise.all([
       prisma.employeeProfile.findMany({
         where: { locationId, status: "active" },
         include: { user: true, primaryPosition: true },
         orderBy: { user: { name: "asc" } },
       }),
       prisma.timeClockEntry.findMany({
         where: {
           locationId,
           clockInAt: { gte: weekStartInstant, lt: weekEndInstant },
         },
         include: { shift: true },
         orderBy: { clockInAt: "asc" },
       }),
       prisma.shift.findMany({
         where: {
           locationId,
           status: "published",
           employeeProfileId: { not: null },
           date: { gte: shiftDateLo, lte: shiftDateHi },
         },
       }),
     ]);

     // Entries grouped by employee.
     const entriesByProfile = new Map<string, typeof entries>();
     for (const e of entries) {
       const list = entriesByProfile.get(e.employeeProfileId) ?? [];
       list.push(e);
       entriesByProfile.set(e.employeeProfileId, list);
     }
     // Which published-shift ids actually have an entry pointing at them.
     const coveredShiftIds = new Set(
       entries.map((e) => e.shiftId).filter((id): id is string => id !== null),
     );
     // Assigned published shifts grouped by employee (for no-show counting).
     const shiftsByProfile = new Map<string, typeof shifts>();
     for (const s of shifts) {
       if (s.employeeProfileId === null) continue;
       const list = shiftsByProfile.get(s.employeeProfileId) ?? [];
       list.push(s);
       shiftsByProfile.set(s.employeeProfileId, list);
     }

     const employees: TimesheetEmployee[] = profiles.map((p) => {
       const rate = p.hourlyRate === null ? null : Number(p.hourlyRate);
       const raw = entriesByProfile.get(p.id) ?? [];
       const entriesOut: TimesheetEntry[] = raw.map((e) => {
         const hours = entryHours(e.clockInAt, e.clockOutAt);
         const late =
           e.shift !== null &&
           e.clockInAt.getTime() > e.shift.startsAt.getTime() + LATE_GRACE_MS;
         return {
           id: e.id,
           date: localISODate(e.clockInAt, tz),
           clockInAt: e.clockInAt.toISOString(),
           clockOutAt: e.clockOutAt ? e.clockOutAt.toISOString() : null,
           hours,
           shiftId: e.shiftId,
           shiftLabel: e.shift ? formatShiftRange(e.shift.startsAt, e.shift.endsAt, tz) : null,
           incomplete: e.clockOutAt === null,
           late,
           edited: e.editedAt !== null,
         };
       });

       const hoursActual =
         Math.round(
           entriesOut.filter((e) => !e.incomplete).reduce((sum, e) => sum + e.hours, 0) * 10,
         ) / 10;
       const laborCost = rate === null ? null : Math.round(hoursActual * rate * 100) / 100;
       const lateCount = entriesOut.filter((e) => e.late).length;
       const assignedShifts = shiftsByProfile.get(p.id) ?? [];
       const noShowCount = assignedShifts.filter((s) => !coveredShiftIds.has(s.id)).length;
       const overtime =
         location.overtimeHoursPerWeek !== null &&
         hoursActual > location.overtimeHoursPerWeek;

       return {
         profileId: p.id,
         name: p.user.name,
         primaryPositionName: p.primaryPosition?.name ?? null,
         hourlyRate: rate,
         entries: entriesOut,
         hoursActual,
         laborCost,
         lateCount,
         noShowCount,
         overtime,
       };
     });

     return { weekStart, overtimeHoursPerWeek: location.overtimeHoursPerWeek, employees };
   }
   ```

4. - [ ] Run the test and expect PASS:
   `npm test -- src/tests/timesheet-data.test.ts`

5. - [ ] Commit:
   `git add src/lib/timesheet-data.ts src/tests/timesheet-data.test.ts && git commit -m "feat: getTimesheetWeekData — read-time weekly hours/cost/reconciliation"`

---

## Task 3 — Shared zod schemas for punch corrections

Centralizes the validation for the three manager-correction routes. ISO-8601 datetime strings (with or without offset) parse to `Date`; the schema also enforces that when both timestamps are present, clock-out is after clock-in.

**Files:**
- Create: `src/lib/timesheet-schemas.ts`
- Test: `src/tests/timesheet-schemas.test.ts` (Create)

**Interfaces:**
- Produces:
  ```ts
  export const createEntrySchema: z.ZodType<{
    employeeProfileId: string;
    clockInAt: string;
    clockOutAt?: string | null;
    shiftId?: string | null;
  }>;
  export const updateEntrySchema: z.ZodType<{
    clockInAt?: string;
    clockOutAt?: string | null;
  }>;
  ```
- Consumes: `z` (`zod`).

**Steps:**

1. - [ ] Write the failing test at `src/tests/timesheet-schemas.test.ts`:
   ```ts
   // @vitest-environment node
   import { describe, expect, it } from "vitest";
   import { createEntrySchema, updateEntrySchema } from "@/lib/timesheet-schemas";

   describe("createEntrySchema", () => {
     it("accepts a valid completed punch", () => {
       const r = createEntrySchema.safeParse({
         employeeProfileId: "p1",
         clockInAt: "2026-07-06T13:00:00.000Z",
         clockOutAt: "2026-07-06T21:00:00.000Z",
         shiftId: "s1",
       });
       expect(r.success).toBe(true);
     });
     it("accepts an open punch (no clock-out)", () => {
       const r = createEntrySchema.safeParse({
         employeeProfileId: "p1",
         clockInAt: "2026-07-06T13:00:00.000Z",
       });
       expect(r.success).toBe(true);
     });
     it("rejects a missing employeeProfileId", () => {
       const r = createEntrySchema.safeParse({ clockInAt: "2026-07-06T13:00:00.000Z" });
       expect(r.success).toBe(false);
     });
     it("rejects a non-datetime clockInAt", () => {
       const r = createEntrySchema.safeParse({ employeeProfileId: "p1", clockInAt: "nope" });
       expect(r.success).toBe(false);
     });
     it("rejects clock-out before clock-in", () => {
       const r = createEntrySchema.safeParse({
         employeeProfileId: "p1",
         clockInAt: "2026-07-06T21:00:00.000Z",
         clockOutAt: "2026-07-06T13:00:00.000Z",
       });
       expect(r.success).toBe(false);
     });
   });

   describe("updateEntrySchema", () => {
     it("accepts a partial clock-out edit", () => {
       expect(updateEntrySchema.safeParse({ clockOutAt: "2026-07-06T21:00:00.000Z" }).success).toBe(true);
     });
     it("accepts clearing the clock-out to null", () => {
       expect(updateEntrySchema.safeParse({ clockOutAt: null }).success).toBe(true);
     });
     it("rejects a bad clockInAt", () => {
       expect(updateEntrySchema.safeParse({ clockInAt: "nope" }).success).toBe(false);
     });
   });
   ```

2. - [ ] Run it and expect FAIL (module missing):
   `npm test -- src/tests/timesheet-schemas.test.ts`

3. - [ ] Implement `src/lib/timesheet-schemas.ts`:
   ```ts
   import { z } from "zod";

   // ISO-8601 datetimes, offset permitted ("...Z" or "+00:00"). new Date(...) parses both.
   const isoDateTime = z.iso.datetime({ offset: true });

   export const createEntrySchema = z
     .object({
       employeeProfileId: z.string().min(1),
       clockInAt: isoDateTime,
       clockOutAt: isoDateTime.nullable().optional(),
       shiftId: z.string().min(1).nullable().optional(),
     })
     .refine(
       (v) =>
         v.clockOutAt == null ||
         new Date(v.clockOutAt).getTime() > new Date(v.clockInAt).getTime(),
       { message: "Clock-out must be after clock-in", path: ["clockOutAt"] },
     );

   export const updateEntrySchema = z.object({
     clockInAt: isoDateTime.optional(),
     clockOutAt: isoDateTime.nullable().optional(),
   });
   ```

4. - [ ] Run the test and expect PASS:
   `npm test -- src/tests/timesheet-schemas.test.ts`

5. - [ ] Commit:
   `git add src/lib/timesheet-schemas.ts src/tests/timesheet-schemas.test.ts && git commit -m "feat: zod schemas for manager punch corrections"`

---

## Task 4 — `POST /api/time-clock-entries` (add a punch)

Manager adds a punch for one of their location's employees, stamping the audit fields. Validates the target employee (and optional shift) belong to the manager's location.

**Files:**
- Create: `src/app/api/time-clock-entries/route.ts`
- Test: `src/tests/time-clock-entries.api.test.ts` (Create)

**Interfaces:**
- Produces: `POST` handler; success `jsonOk({ entry: { id, clockInAt, clockOutAt, shiftId, editedByUserId, editedAt } })`.
- Consumes: `requireManagerForApi` (`@/lib/manager-guard`); `handleApiError`, `jsonErr`, `jsonOk` (`@/lib/api`); `prisma` (`@/lib/db`); `createEntrySchema` (`@/lib/timesheet-schemas`).

**Steps:**

1. - [ ] Write the failing test at `src/tests/time-clock-entries.api.test.ts` (this file grows in Tasks 5 & 6; start with the POST cases):
   ```ts
   // @vitest-environment node
   import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

   vi.mock("@/lib/auth", () => ({
     auth: vi.fn(),
     requireUser: vi.fn(),
     requireManager: vi.fn(),
     apiUser: vi.fn(),
     signIn: vi.fn(),
     signOut: vi.fn(),
     handlers: {},
   }));

   import { prisma } from "@/lib/db";
   import { POST } from "@/app/api/time-clock-entries/route";
   import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
   import { signInAs } from "./helpers/auth";

   function post(body: unknown) {
     return new Request("http://test/api/time-clock-entries", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body),
     });
   }

   describe("POST /api/time-clock-entries", () => {
     let f: Fixture;
     beforeAll(async () => {
       f = await createFixture();
     });
     afterAll(async () => {
       await destroyFixture(f);
     });

     it("creates a punch and stamps the audit fields", async () => {
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await POST(
         post({
           employeeProfileId: f.ana.profileId,
           clockInAt: "2026-07-06T13:00:00.000Z",
           clockOutAt: "2026-07-06T21:00:00.000Z",
         }),
       );
       const json = await res.json();
       expect(json.ok).toBe(true);
       const entry = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: json.data.entry.id } });
       expect(entry.locationId).toBe(f.locationId);
       expect(entry.editedByUserId).toBe(f.managerUserId);
       expect(entry.editedAt).not.toBeNull();
       expect(entry.clockOutAt?.toISOString()).toBe("2026-07-06T21:00:00.000Z");
     });

     it("rejects an employee from another location (404)", async () => {
       const other = await createFixture();
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await POST(
         post({ employeeProfileId: other.ana.profileId, clockInAt: "2026-07-06T13:00:00.000Z" }),
       );
       expect(res.status).toBe(404);
       await destroyFixture(other);
     });

     it("rejects a shift from another location (404)", async () => {
       const other = await createFixture();
       const foreignShift = await createShiftAt(other, {
         positionId: other.positionIds.server,
         employeeProfileId: other.ana.profileId,
         startsAt: new Date("2026-07-06T13:00:00.000Z"),
         endsAt: new Date("2026-07-06T21:00:00.000Z"),
       });
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await POST(
         post({
           employeeProfileId: f.ana.profileId,
           clockInAt: "2026-07-06T13:00:00.000Z",
           shiftId: foreignShift.id,
         }),
       );
       expect(res.status).toBe(404);
       await destroyFixture(other);
     });

     it("rejects a non-manager (403)", async () => {
       signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
       const res = await POST(post({ employeeProfileId: f.ana.profileId, clockInAt: "2026-07-06T13:00:00.000Z" }));
       expect(res.status).toBe(403);
     });

     it("rejects invalid input (400)", async () => {
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await POST(post({ employeeProfileId: f.ana.profileId, clockInAt: "nope" }));
       expect(res.status).toBe(400);
     });
   });
   ```

2. - [ ] Run it and expect FAIL (route module missing):
   `npm test -- src/tests/time-clock-entries.api.test.ts`

3. - [ ] Implement `src/app/api/time-clock-entries/route.ts`:
   ```ts
   import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
   import { prisma } from "@/lib/db";
   import { requireManagerForApi } from "@/lib/manager-guard";
   import { createEntrySchema } from "@/lib/timesheet-schemas";

   export async function POST(req: Request) {
     try {
       const guard = await requireManagerForApi();
       if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

       let raw: unknown;
       try {
         raw = await req.json();
       } catch {
         return jsonErr("invalid_input", "Request body must be JSON", 400);
       }
       const parsed = createEntrySchema.safeParse(raw);
       if (!parsed.success) {
         return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
       }
       const input = parsed.data;

       const profile = await prisma.employeeProfile.findFirst({
         where: { id: input.employeeProfileId, locationId: guard.location.id },
       });
       if (!profile) {
         return jsonErr("not_found", "That employee isn't on this location's team", 404);
       }
       if (input.shiftId != null) {
         const shift = await prisma.shift.findFirst({
           where: { id: input.shiftId, locationId: guard.location.id },
         });
         if (!shift) {
           return jsonErr("not_found", "That shift doesn't exist at this location", 404);
         }
       }

       const now = new Date();
       const entry = await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: input.employeeProfileId,
           locationId: guard.location.id,
           shiftId: input.shiftId ?? null,
           clockInAt: new Date(input.clockInAt),
           clockOutAt: input.clockOutAt ? new Date(input.clockOutAt) : null,
           editedByUserId: guard.userId,
           editedAt: now,
         },
       });

       return jsonOk({
         entry: {
           id: entry.id,
           clockInAt: entry.clockInAt.toISOString(),
           clockOutAt: entry.clockOutAt ? entry.clockOutAt.toISOString() : null,
           shiftId: entry.shiftId,
           editedByUserId: entry.editedByUserId,
           editedAt: entry.editedAt ? entry.editedAt.toISOString() : null,
         },
       });
     } catch (err) {
       return handleApiError(err);
     }
   }
   ```

4. - [ ] Run the test and expect PASS:
   `npm test -- src/tests/time-clock-entries.api.test.ts`

5. - [ ] Commit:
   `git add src/app/api/time-clock-entries/route.ts src/tests/time-clock-entries.api.test.ts && git commit -m "feat: POST /api/time-clock-entries manager add-punch with audit stamp"`

---

## Task 5 — `PATCH` & `DELETE /api/time-clock-entries/[id]` (edit / close / delete a punch)

Manager edits (re-stamps audit) or deletes an existing punch, tenancy-scoped by the entry's own `locationId`.

**Files:**
- Create: `src/app/api/time-clock-entries/[id]/route.ts`
- Modify: `src/tests/time-clock-entries.api.test.ts` (add PATCH/DELETE describe blocks + imports)

**Interfaces:**
- Produces:
  - `PATCH` handler, params `{ params: Promise<{ id: string }> }`; success `jsonOk({ entry: { id, clockInAt, clockOutAt, editedByUserId, editedAt } })`.
  - `DELETE` handler, params `{ params: Promise<{ id: string }> }`; success `jsonOk({ deleted: true })`.
- Consumes: `requireManagerForApi`; `handleApiError`, `jsonErr`, `jsonOk`; `prisma`; `updateEntrySchema` (`@/lib/timesheet-schemas`).

**Steps:**

1. - [ ] Add the failing PATCH/DELETE cases to `src/tests/time-clock-entries.api.test.ts`. Change the top import line to also import the id-route handlers, and append the two describe blocks:
   - Update the import that currently reads
     `import { POST } from "@/app/api/time-clock-entries/route";`
     to add a second import line directly beneath it:
     ```ts
     import { PATCH, DELETE } from "@/app/api/time-clock-entries/[id]/route";
     ```
   - Append these describe blocks to the end of the file (they create their own fixture so they run independently):
     ```ts
     function ctx(id: string) {
       return { params: Promise.resolve({ id }) };
     }
     function patch(body: unknown) {
       return new Request("http://test/api/time-clock-entries/x", {
         method: "PATCH",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
       });
     }

     describe("PATCH /api/time-clock-entries/[id]", () => {
       let f: Fixture;
       beforeAll(async () => {
         f = await createFixture();
       });
       afterAll(async () => {
         await destroyFixture(f);
       });

       it("edits the clock-out and re-stamps the audit", async () => {
         const entry = await prisma.timeClockEntry.create({
           data: {
             employeeProfileId: f.ana.profileId,
             locationId: f.locationId,
             clockInAt: new Date("2026-07-06T13:00:00.000Z"),
             clockOutAt: null,
           },
         });
         signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
         const res = await PATCH(patch({ clockOutAt: "2026-07-06T21:00:00.000Z" }), ctx(entry.id));
         const json = await res.json();
         expect(json.ok).toBe(true);
         const after = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: entry.id } });
         expect(after.clockOutAt?.toISOString()).toBe("2026-07-06T21:00:00.000Z");
         expect(after.editedByUserId).toBe(f.managerUserId);
         expect(after.editedAt).not.toBeNull();
       });

       it("rejects an entry from another location (404)", async () => {
         const other = await createFixture();
         const foreign = await prisma.timeClockEntry.create({
           data: {
             employeeProfileId: other.ana.profileId,
             locationId: other.locationId,
             clockInAt: new Date("2026-07-06T13:00:00.000Z"),
           },
         });
         signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
         const res = await PATCH(patch({ clockOutAt: "2026-07-06T21:00:00.000Z" }), ctx(foreign.id));
         expect(res.status).toBe(404);
         await destroyFixture(other);
       });

       it("rejects invalid input (400)", async () => {
         const entry = await prisma.timeClockEntry.create({
           data: {
             employeeProfileId: f.ana.profileId,
             locationId: f.locationId,
             clockInAt: new Date("2026-07-06T13:00:00.000Z"),
           },
         });
         signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
         const res = await PATCH(patch({ clockInAt: "nope" }), ctx(entry.id));
         expect(res.status).toBe(400);
       });
     });

     describe("DELETE /api/time-clock-entries/[id]", () => {
       let f: Fixture;
       beforeAll(async () => {
         f = await createFixture();
       });
       afterAll(async () => {
         await destroyFixture(f);
       });

       it("deletes the entry", async () => {
         const entry = await prisma.timeClockEntry.create({
           data: {
             employeeProfileId: f.ana.profileId,
             locationId: f.locationId,
             clockInAt: new Date("2026-07-06T13:00:00.000Z"),
           },
         });
         signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
         const res = await DELETE(new Request("http://test/x", { method: "DELETE" }), ctx(entry.id));
         expect((await res.json()).data.deleted).toBe(true);
         expect(await prisma.timeClockEntry.findUnique({ where: { id: entry.id } })).toBeNull();
       });

       it("rejects an entry from another location (404)", async () => {
         const other = await createFixture();
         const foreign = await prisma.timeClockEntry.create({
           data: {
             employeeProfileId: other.ana.profileId,
             locationId: other.locationId,
             clockInAt: new Date("2026-07-06T13:00:00.000Z"),
           },
         });
         signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
         const res = await DELETE(new Request("http://test/x", { method: "DELETE" }), ctx(foreign.id));
         expect(res.status).toBe(404);
         await destroyFixture(other);
       });
     });
     ```

2. - [ ] Run it and expect FAIL (id-route module missing):
   `npm test -- src/tests/time-clock-entries.api.test.ts`

3. - [ ] Implement `src/app/api/time-clock-entries/[id]/route.ts`:
   ```ts
   import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
   import { prisma } from "@/lib/db";
   import { requireManagerForApi } from "@/lib/manager-guard";
   import { updateEntrySchema } from "@/lib/timesheet-schemas";

   export async function PATCH(
     req: Request,
     { params }: { params: Promise<{ id: string }> },
   ) {
     try {
       const guard = await requireManagerForApi();
       if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
       const { id } = await params;

       const existing = await prisma.timeClockEntry.findFirst({
         where: { id, locationId: guard.location.id },
       });
       if (!existing) return jsonErr("not_found", "That time entry no longer exists", 404);

       let raw: unknown;
       try {
         raw = await req.json();
       } catch {
         return jsonErr("invalid_input", "Request body must be JSON", 400);
       }
       const parsed = updateEntrySchema.safeParse(raw);
       if (!parsed.success) {
         return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
       }
       const input = parsed.data;

       const clockInAt = input.clockInAt ? new Date(input.clockInAt) : existing.clockInAt;
       const clockOutAt =
         input.clockOutAt === undefined
           ? existing.clockOutAt
           : input.clockOutAt === null
             ? null
             : new Date(input.clockOutAt);
       if (clockOutAt !== null && clockOutAt.getTime() <= clockInAt.getTime()) {
         return jsonErr("invalid_input", "Clock-out must be after clock-in", 400);
       }

       const entry = await prisma.timeClockEntry.update({
         where: { id },
         data: {
           clockInAt,
           clockOutAt,
           editedByUserId: guard.userId,
           editedAt: new Date(),
         },
       });

       return jsonOk({
         entry: {
           id: entry.id,
           clockInAt: entry.clockInAt.toISOString(),
           clockOutAt: entry.clockOutAt ? entry.clockOutAt.toISOString() : null,
           editedByUserId: entry.editedByUserId,
           editedAt: entry.editedAt ? entry.editedAt.toISOString() : null,
         },
       });
     } catch (err) {
       return handleApiError(err);
     }
   }

   export async function DELETE(
     _req: Request,
     { params }: { params: Promise<{ id: string }> },
   ) {
     try {
       const guard = await requireManagerForApi();
       if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
       const { id } = await params;

       const existing = await prisma.timeClockEntry.findFirst({
         where: { id, locationId: guard.location.id },
       });
       if (!existing) return jsonErr("not_found", "That time entry no longer exists", 404);

       await prisma.timeClockEntry.delete({ where: { id } });
       return jsonOk({ deleted: true });
     } catch (err) {
       return handleApiError(err);
     }
   }
   ```

4. - [ ] Run the test and expect PASS:
   `npm test -- src/tests/time-clock-entries.api.test.ts`

5. - [ ] Commit:
   `git add src/app/api/time-clock-entries/[id]/route.ts src/tests/time-clock-entries.api.test.ts && git commit -m "feat: PATCH/DELETE /api/time-clock-entries/[id] with audit re-stamp"`

---

## Task 6 — CSV export builder + `GET /api/locations/[locationId]/timesheets/export`

A pure `timesheetsToCsv` builder (unit-tested) plus a manager-guarded route that streams `text/csv` for a week, reusing `getTimesheetWeekData`.

**Files:**
- Modify: `src/lib/timesheet-data.ts` (add `timesheetsToCsv`)
- Create: `src/app/api/locations/[locationId]/timesheets/export/route.ts`
- Test: `src/tests/timesheet-export.api.test.ts` (Create)
- Modify: `src/tests/timesheet-data.test.ts` (add a `timesheetsToCsv` unit block)

**Interfaces:**
- Produces:
  - `export function timesheetsToCsv(data: TimesheetWeekData): string;` — header row `Employee,Date,Clock in,Clock out,Hours,Cost,Flags` then one row per entry (RFC-4180 quoting).
  - `GET` route, params `{ params: Promise<{ locationId: string }> }`, query `weekStart`; `Response` with `Content-Type: text/csv; charset=utf-8` and a `Content-Disposition` filename.
- Consumes: `getTimesheetWeekData`, `TimesheetWeekData` (`@/lib/timesheet-data`); `requireManagerForApi`; `jsonErr`, `handleApiError`; `isoDateSchema` (`@/lib/shift-schemas`); `dayOfWeekMon0`, `weekStartOfISO` (`@/lib/time`).

**Steps:**

1. - [ ] Add the failing CSV-builder unit block to `src/tests/timesheet-data.test.ts`. Add `timesheetsToCsv` to its import from `@/lib/timesheet-data`, then append:
   ```ts
   import { timesheetsToCsv } from "@/lib/timesheet-data";

   describe("timesheetsToCsv", () => {
     it("emits a header and one row per entry with quoted fields", () => {
       const csv = timesheetsToCsv({
         weekStart: "2026-07-06",
         overtimeHoursPerWeek: 40,
         employees: [
           {
             profileId: "p1",
             name: "Ana, Diaz",
             primaryPositionName: "Server",
             hourlyRate: 20,
             hoursActual: 8,
             laborCost: 160,
             lateCount: 0,
             noShowCount: 0,
             overtime: false,
             entries: [
               {
                 id: "e1",
                 date: "2026-07-06",
                 clockInAt: "2026-07-06T13:00:00.000Z",
                 clockOutAt: "2026-07-06T21:00:00.000Z",
                 hours: 8,
                 shiftId: "s1",
                 shiftLabel: "9:00 AM – 5:00 PM",
                 incomplete: false,
                 late: false,
                 edited: true,
               },
             ],
           },
         ],
       });
       const lines = csv.trim().split("\n");
       expect(lines[0]).toBe("Employee,Date,Clock in,Clock out,Hours,Cost,Flags");
       // Name has a comma → must be quoted.
       expect(lines[1]).toContain('"Ana, Diaz"');
       expect(lines[1]).toContain("2026-07-06");
       expect(lines[1]).toContain("8");
       expect(lines[1]).toContain("edited");
     });

     it("marks an incomplete entry and a no-rate cost blank", () => {
       const csv = timesheetsToCsv({
         weekStart: "2026-07-06",
         overtimeHoursPerWeek: null,
         employees: [
           {
             profileId: "p2",
             name: "Ben Cho",
             primaryPositionName: null,
             hourlyRate: null,
             hoursActual: 0,
             laborCost: null,
             lateCount: 0,
             noShowCount: 0,
             overtime: false,
             entries: [
               {
                 id: "e2",
                 date: "2026-07-06",
                 clockInAt: "2026-07-06T13:00:00.000Z",
                 clockOutAt: null,
                 hours: 0,
                 shiftId: null,
                 shiftLabel: null,
                 incomplete: true,
                 late: false,
                 edited: false,
               },
             ],
           },
         ],
       });
       const row = csv.trim().split("\n")[1];
       expect(row).toContain("incomplete");
       // Cost column blank (two commas around it): ...,,... with no number.
       expect(row.split(",").includes("")).toBe(true);
     });
   });
   ```

2. - [ ] Run it and expect FAIL (`timesheetsToCsv` not exported):
   `npm test -- src/tests/timesheet-data.test.ts`

3. - [ ] Add `timesheetsToCsv` to the bottom of `src/lib/timesheet-data.ts`:
   ```ts
   /** RFC-4180 field: quote when it contains a comma, quote, or newline. */
   function csvField(value: string): string {
     if (/[",\n\r]/.test(value)) {
       return `"${value.replace(/"/g, '""')}"`;
     }
     return value;
   }

   /** One header row + one row per entry across all employees. */
   export function timesheetsToCsv(data: TimesheetWeekData): string {
     const header = ["Employee", "Date", "Clock in", "Clock out", "Hours", "Cost", "Flags"];
     const rows: string[] = [header.join(",")];
     for (const emp of data.employees) {
       for (const e of emp.entries) {
         const flags: string[] = [];
         if (e.incomplete) flags.push("incomplete");
         if (e.late) flags.push("late");
         if (e.edited) flags.push("edited");
         const cost =
           e.incomplete || emp.hourlyRate === null
             ? ""
             : String(Math.round(e.hours * emp.hourlyRate * 100) / 100);
         rows.push(
           [
             csvField(emp.name),
             e.date,
             e.clockInAt,
             e.clockOutAt ?? "",
             String(e.hours),
             cost,
             csvField(flags.join(" ")),
           ].join(","),
         );
       }
     }
     return rows.join("\n") + "\n";
   }
   ```

4. - [ ] Run the unit block and expect PASS:
   `npm test -- src/tests/timesheet-data.test.ts`

5. - [ ] Write the failing export-route test at `src/tests/timesheet-export.api.test.ts`:
   ```ts
   // @vitest-environment node
   import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

   vi.mock("@/lib/auth", () => ({
     auth: vi.fn(),
     requireUser: vi.fn(),
     requireManager: vi.fn(),
     apiUser: vi.fn(),
     signIn: vi.fn(),
     signOut: vi.fn(),
     handlers: {},
   }));

   import { prisma } from "@/lib/db";
   import { GET } from "@/app/api/locations/[locationId]/timesheets/export/route";
   import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
   import { signInAs } from "./helpers/auth";
   import { localToUtc } from "@/lib/time";

   const WEEK = "2026-07-06";
   function at(dateISO: string, hour: number) {
     return localToUtc(dateISO, { hour, minute: 0 }, "America/New_York");
   }
   function ctx(locationId: string) {
     return { params: Promise.resolve({ locationId }) };
   }
   function req(locationId: string, weekStart: string) {
     return new Request(
       `http://test/api/locations/${locationId}/timesheets/export?weekStart=${weekStart}`,
     );
   }

   describe("GET timesheets export", () => {
     let f: Fixture;
     beforeAll(async () => {
       f = await createFixture();
       const shift = await createShiftAt(f, {
         positionId: f.positionIds.server,
         employeeProfileId: f.ana.profileId,
         startsAt: at(WEEK, 9),
         endsAt: at(WEEK, 17),
       });
       await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: f.ana.profileId,
           locationId: f.locationId,
           shiftId: shift.id,
           clockInAt: at(WEEK, 9),
           clockOutAt: at(WEEK, 17),
         },
       });
     });
     afterAll(async () => {
       await destroyFixture(f);
     });

     it("returns text/csv rows for the week", async () => {
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await GET(req(f.locationId, WEEK), ctx(f.locationId));
       expect(res.headers.get("content-type")).toContain("text/csv");
       const body = await res.text();
       const lines = body.trim().split("\n");
       expect(lines[0]).toBe("Employee,Date,Clock in,Clock out,Hours,Cost,Flags");
       expect(body).toContain("Ana Diaz");
       expect(lines).toHaveLength(2); // header + one entry
     });

     it("rejects another location (403)", async () => {
       const other = await createFixture();
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await GET(req(other.locationId, WEEK), ctx(other.locationId));
       expect(res.status).toBe(403);
       await destroyFixture(other);
     });

     it("rejects a non-Monday weekStart (400)", async () => {
       signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
       const res = await GET(req(f.locationId, "2026-07-07"), ctx(f.locationId));
       expect(res.status).toBe(400);
     });
   });
   ```

6. - [ ] Run it and expect FAIL (route module missing):
   `npm test -- src/tests/timesheet-export.api.test.ts`

7. - [ ] Implement `src/app/api/locations/[locationId]/timesheets/export/route.ts`:
   ```ts
   import { handleApiError, jsonErr } from "@/lib/api";
   import { requireManagerForApi } from "@/lib/manager-guard";
   import { isoDateSchema } from "@/lib/shift-schemas";
   import { getTimesheetWeekData, timesheetsToCsv } from "@/lib/timesheet-data";
   import { dayOfWeekMon0 } from "@/lib/time";

   export async function GET(
     req: Request,
     { params }: { params: Promise<{ locationId: string }> },
   ) {
     try {
       const guard = await requireManagerForApi();
       if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
       const { locationId } = await params;
       if (guard.location.id !== locationId) {
         return jsonErr("forbidden", "You don't have access to this location", 403);
       }
       const weekStart = new URL(req.url).searchParams.get("weekStart");
       const parsed = isoDateSchema.safeParse(weekStart);
       if (!parsed.success) {
         return jsonErr("invalid_input", "weekStart must be a date like 2026-07-06", 400);
       }
       if (dayOfWeekMon0(parsed.data) !== 0) {
         return jsonErr("invalid_input", "weekStart must be a Monday", 400);
       }

       const data = await getTimesheetWeekData(locationId, parsed.data);
       const csv = timesheetsToCsv(data);
       return new Response(csv, {
         status: 200,
         headers: {
           "Content-Type": "text/csv; charset=utf-8",
           "Content-Disposition": `attachment; filename="timesheets-${parsed.data}.csv"`,
         },
       });
     } catch (err) {
       return handleApiError(err);
     }
   }
   ```

8. - [ ] Run both affected tests and expect PASS:
   `npm test -- src/tests/timesheet-export.api.test.ts src/tests/timesheet-data.test.ts`

9. - [ ] Commit:
   `git add src/lib/timesheet-data.ts src/app/api/locations/[locationId]/timesheets/export/route.ts src/tests/timesheet-export.api.test.ts src/tests/timesheet-data.test.ts && git commit -m "feat: timesheet CSV builder + export route"`

---

## Task 7 — `TimesheetsView` client component

The interactive view: per-employee sections (name · hours · cost · flag badges), each expandable to day-by-day punch rows with Edit / Delete / Add-punch, plus a CSV download button. Uses the punch APIs and refreshes on success. Tested in jsdom with mocked router/toast/fetch.

**Files:**
- Create: `src/components/manager/TimesheetsView.tsx`
- Create: `src/components/manager/TimesheetsView.module.css`
- Test: `src/components/manager/TimesheetsView.test.tsx` (Create)

**Interfaces:**
- Produces:
  ```ts
  export type TimesheetsViewProps = {
    locationId: string;
    weekStart: string;
    weekLabel: string;
    prevHref: string;
    nextHref: string;
    todayHref: string;
    data: TimesheetWeekData; // from "@/lib/timesheet-data"
  };
  export function formatCost(cost: number | null): string; // "$160" | "—"
  export function TimesheetsView(props: TimesheetsViewProps): JSX.Element;
  ```
- Consumes: `useRouter` (`next/navigation`); `useToast` (`@/components/ui/Toaster`); `Button`, `Badge`, `Card`, `Dialog`, `Input`, `Icon` (`@/components/ui/*`); `DatePager` (`@/components/chrome/DatePager`); `EmptyState` (`@/components/ui/EmptyState`); `TimesheetWeekData`, `TimesheetEmployee`, `TimesheetEntry` (`@/lib/timesheet-data`); `formatTime` is NOT used here (timestamps come pre-formatted via `shiftLabel`; punch times render from ISO via `new Date().toLocaleTimeString`).

**Steps:**

1. - [ ] Write the failing test at `src/components/manager/TimesheetsView.test.tsx`:
   ```tsx
   // @vitest-environment jsdom
   import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
   import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

   vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
   vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

   import { TimesheetsView, formatCost } from "@/components/manager/TimesheetsView";
   import type { TimesheetWeekData } from "@/lib/timesheet-data";

   const data: TimesheetWeekData = {
     weekStart: "2026-07-06",
     overtimeHoursPerWeek: 40,
     employees: [
       {
         profileId: "p1",
         name: "Ana Diaz",
         primaryPositionName: "Server",
         hourlyRate: 20,
         hoursActual: 8,
         laborCost: 160,
         lateCount: 0,
         noShowCount: 0,
         overtime: false,
         entries: [
           {
             id: "e1",
             date: "2026-07-06",
             clockInAt: "2026-07-06T13:00:00.000Z",
             clockOutAt: "2026-07-06T21:00:00.000Z",
             hours: 8,
             shiftId: "s1",
             shiftLabel: "9:00 AM – 5:00 PM",
             incomplete: false,
             late: false,
             edited: false,
           },
         ],
       },
       {
         profileId: "p2",
         name: "Ben Cho",
         primaryPositionName: null,
         hourlyRate: null,
         hoursActual: 4,
         laborCost: null,
         lateCount: 1,
         noShowCount: 1,
         overtime: false,
         entries: [
           {
             id: "e2",
             date: "2026-07-07",
             clockInAt: "2026-07-07T13:10:00.000Z",
             clockOutAt: null,
             hours: 0,
             shiftId: "s2",
             shiftLabel: "9:00 AM – 5:00 PM",
             incomplete: true,
             late: true,
             edited: false,
           },
         ],
       },
     ],
   };

   const baseProps = {
     locationId: "loc1",
     weekStart: "2026-07-06",
     weekLabel: "Week of Jul 6",
     prevHref: "/manager/timesheets?week=2026-06-29",
     nextHref: "/manager/timesheets?week=2026-07-13",
     todayHref: "/manager/timesheets",
     data,
   };

   let fetchMock: ReturnType<typeof vi.fn>;
   beforeEach(() => {
     fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
       headers: { "content-type": "application/json" },
     }));
     vi.stubGlobal("fetch", fetchMock);
   });
   afterEach(() => {
     vi.unstubAllGlobals();
     cleanup();
   });

   describe("formatCost", () => {
     it("formats a number as dollars and null as an em dash", () => {
       expect(formatCost(160)).toBe("$160");
       expect(formatCost(null)).toBe("—");
     });
   });

   describe("TimesheetsView", () => {
     it("lists each employee with hours, cost, and flag badges", () => {
       render(<TimesheetsView {...baseProps} />);
       expect(screen.getByText("Ana Diaz")).toBeTruthy();
       expect(screen.getByText("Ben Cho")).toBeTruthy();
       expect(screen.getByText("$160")).toBeTruthy();
       expect(screen.getByText(/1 late/)).toBeTruthy();
       expect(screen.getByText(/1 no-show/)).toBeTruthy();
     });

     it("shows an empty state when there are no employees", () => {
       render(<TimesheetsView {...baseProps} data={{ ...data, employees: [] }} />);
       expect(screen.getByText("No timesheets this week")).toBeTruthy();
     });

     it("expands an employee to reveal punch rows and deletes a punch", async () => {
       render(<TimesheetsView {...baseProps} />);
       fireEvent.click(screen.getByText("Ana Diaz")); // expand
       fireEvent.click(screen.getByRole("button", { name: "Delete punch" }));
       fireEvent.click(screen.getByRole("button", { name: "Delete" })); // dialog confirm
       await waitFor(() => expect(fetchMock).toHaveBeenCalled());
       const [url, init] = fetchMock.mock.calls[0];
       expect(url).toBe("/api/time-clock-entries/e1");
       expect((init as RequestInit).method).toBe("DELETE");
     });

     it("has a CSV download link pointing at the export route", () => {
       render(<TimesheetsView {...baseProps} />);
       const link = screen.getByRole("link", { name: /export csv/i }) as HTMLAnchorElement;
       expect(link.getAttribute("href")).toBe(
         "/api/locations/loc1/timesheets/export?weekStart=2026-07-06",
       );
     });
   });
   ```

2. - [ ] Run it and expect FAIL (component missing):
   `npm test -- src/components/manager/TimesheetsView.test.tsx`

3. - [ ] Create the CSS module `src/components/manager/TimesheetsView.module.css`:
   ```css
   .page {
     display: flex;
     flex-direction: column;
     gap: 18px;
   }

   .header {
     display: flex;
     align-items: flex-start;
     justify-content: space-between;
     gap: 16px;
     flex-wrap: wrap;
   }

   .title {
     font-size: var(--text-h1-size);
     font-weight: var(--text-h1-weight);
     color: var(--text-primary);
     margin: 0 0 6px;
   }

   .subtitle {
     font-size: 13px;
     color: var(--text-secondary);
   }

   .headerActions {
     display: flex;
     align-items: center;
     gap: 12px;
   }

   .exportLink {
     display: inline-flex;
     align-items: center;
     gap: 6px;
     font-size: 13px;
     font-weight: 600;
     color: var(--text-secondary);
     text-decoration: none;
     padding: 8px 12px;
     border: 1px solid var(--border-default);
     border-radius: var(--radius-sm);
   }

   .exportLink:hover {
     color: var(--text-primary);
     background: var(--surface-sunken);
   }

   .list {
     display: flex;
     flex-direction: column;
     gap: 12px;
   }

   .empRow {
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 12px;
     width: 100%;
     background: none;
     border: none;
     text-align: left;
     cursor: pointer;
     padding: 0;
   }

   .empMain {
     display: flex;
     align-items: center;
     gap: 10px;
   }

   .empName {
     font-size: 15px;
     font-weight: 600;
     color: var(--text-primary);
   }

   .empRole {
     font-size: 12px;
     color: var(--text-secondary);
   }

   .empStats {
     display: flex;
     align-items: center;
     gap: 10px;
     flex-wrap: wrap;
   }

   .stat {
     font-size: 13px;
     color: var(--text-secondary);
   }

   .statValue {
     font-weight: 700;
     color: var(--text-primary);
   }

   .badges {
     display: flex;
     gap: 6px;
     flex-wrap: wrap;
   }

   .punches {
     margin-top: 12px;
     display: flex;
     flex-direction: column;
     gap: 8px;
   }

   .punchRow {
     display: grid;
     grid-template-columns: 110px 1fr auto;
     align-items: center;
     gap: 12px;
     padding: 8px 12px;
     background: var(--surface-sunken);
     border-radius: var(--radius-sm);
     font-size: 13px;
   }

   .punchTimes {
     color: var(--text-primary);
   }

   .punchMeta {
     color: var(--text-secondary);
     display: flex;
     gap: 8px;
     align-items: center;
     flex-wrap: wrap;
   }

   .punchActions {
     display: flex;
     gap: 8px;
   }

   .addRow {
     display: flex;
     justify-content: flex-start;
   }

   .dialogFields {
     display: flex;
     flex-direction: column;
     gap: 12px;
   }

   .dialogActions {
     display: flex;
     justify-content: flex-end;
     gap: 8px;
   }

   .emptyPunch {
     font-size: 13px;
     color: var(--text-tertiary);
     padding: 8px 12px;
   }
   ```

4. - [ ] Implement `src/components/manager/TimesheetsView.tsx` in full:
   ```tsx
   "use client";

   import { useState } from "react";
   import { useRouter } from "next/navigation";
   import { Badge } from "@/components/ui/Badge";
   import { Button } from "@/components/ui/Button";
   import { Card } from "@/components/ui/Card";
   import { Dialog } from "@/components/ui/Dialog";
   import { EmptyState } from "@/components/ui/EmptyState";
   import { Icon } from "@/components/ui/Icon";
   import { Input } from "@/components/ui/Input";
   import { DatePager } from "@/components/chrome/DatePager";
   import { useToast } from "@/components/ui/Toaster";
   import type {
     TimesheetEmployee,
     TimesheetEntry,
     TimesheetWeekData,
   } from "@/lib/timesheet-data";
   import styles from "./TimesheetsView.module.css";

   export type TimesheetsViewProps = {
     locationId: string;
     weekStart: string;
     weekLabel: string;
     prevHref: string;
     nextHref: string;
     todayHref: string;
     data: TimesheetWeekData;
   };

   export function formatCost(cost: number | null): string {
     if (cost === null) return "—";
     return `$${Math.round(cost).toLocaleString("en-US")}`;
   }

   /** ISO instant → local "1:00 PM" (browser timezone; wall-clock detail is in shiftLabel). */
   function clockLabel(iso: string): string {
     return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
   }

   /** "2026-07-06T13:00:00.000Z" → "2026-07-06T13:00" for a datetime-local input. */
   function toLocalInput(iso: string): string {
     const d = new Date(iso);
     const pad = (n: number) => String(n).padStart(2, "0");
     return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
   }

   /** A "2026-07-06T13:00" datetime-local value → ISO instant, or null if empty/invalid. */
   function fromLocalInput(value: string): string | null {
     if (!value.trim()) return null;
     const d = new Date(value);
     return Number.isNaN(d.getTime()) ? null : d.toISOString();
   }

   type EditState =
     | { mode: "add"; employeeProfileId: string; entry?: undefined }
     | { mode: "edit"; employeeProfileId: string; entry: TimesheetEntry }
     | null;

   export function TimesheetsView({
     locationId,
     weekStart,
     weekLabel,
     prevHref,
     nextHref,
     todayHref,
     data,
   }: TimesheetsViewProps) {
     const router = useRouter();
     const { toast } = useToast();
     const [expanded, setExpanded] = useState<Set<string>>(new Set());
     const [edit, setEdit] = useState<EditState>(null);
     const [confirmDelete, setConfirmDelete] = useState<TimesheetEntry | null>(null);
     const [clockIn, setClockIn] = useState("");
     const [clockOut, setClockOut] = useState("");
     const [busy, setBusy] = useState(false);

     const exportHref = `/api/locations/${locationId}/timesheets/export?weekStart=${weekStart}`;

     function toggle(profileId: string) {
       setExpanded((prev) => {
         const next = new Set(prev);
         if (next.has(profileId)) next.delete(profileId);
         else next.add(profileId);
         return next;
       });
     }

     function openAdd(employeeProfileId: string) {
       setClockIn("");
       setClockOut("");
       setEdit({ mode: "add", employeeProfileId });
     }
     function openEdit(employeeProfileId: string, entry: TimesheetEntry) {
       setClockIn(toLocalInput(entry.clockInAt));
       setClockOut(entry.clockOutAt ? toLocalInput(entry.clockOutAt) : "");
       setEdit({ mode: "edit", employeeProfileId, entry });
     }

     async function saveEdit() {
       if (!edit) return;
       const clockInAt = fromLocalInput(clockIn);
       if (!clockInAt) {
         toast({ tone: "danger", title: "Enter a clock-in time" });
         return;
       }
       const clockOutAt = fromLocalInput(clockOut);
       setBusy(true);
       try {
         const url =
           edit.mode === "add"
             ? "/api/time-clock-entries"
             : `/api/time-clock-entries/${edit.entry.id}`;
         const method = edit.mode === "add" ? "POST" : "PATCH";
         const body =
           edit.mode === "add"
             ? { employeeProfileId: edit.employeeProfileId, clockInAt, clockOutAt }
             : { clockInAt, clockOutAt };
         const res = await fetch(url, {
           method,
           headers: { "content-type": "application/json" },
           body: JSON.stringify(body),
         });
         const json = await res.json();
         if (!json.ok) throw new Error(json.error.message);
         toast({ tone: "success", title: edit.mode === "add" ? "Punch added" : "Punch updated" });
         setEdit(null);
         router.refresh();
       } catch (err) {
         toast({
           tone: "danger",
           title: "Couldn't save the punch",
           description: err instanceof Error ? err.message : "Something went wrong. Try again.",
         });
       } finally {
         setBusy(false);
       }
     }

     async function doDelete() {
       if (!confirmDelete) return;
       setBusy(true);
       try {
         const res = await fetch(`/api/time-clock-entries/${confirmDelete.id}`, { method: "DELETE" });
         const json = await res.json();
         if (!json.ok) throw new Error(json.error.message);
         toast({ tone: "success", title: "Punch deleted" });
         setConfirmDelete(null);
         router.refresh();
       } catch (err) {
         toast({
           tone: "danger",
           title: "Couldn't delete the punch",
           description: err instanceof Error ? err.message : "Something went wrong. Try again.",
         });
       } finally {
         setBusy(false);
       }
     }

     return (
       <div className={styles.page}>
         <div className={styles.header}>
           <div>
             <h1 className={styles.title}>Timesheets</h1>
             <div className={styles.subtitle}>
               Actual hours from the time clock. Managers can correct punches; open punches are
               excluded from totals until closed.
             </div>
           </div>
           <div className={styles.headerActions}>
             <a className={styles.exportLink} href={exportHref} download>
               <Icon name="arrow-left" size={14} style={{ transform: "rotate(-90deg)" }} />
               Export CSV
             </a>
             <DatePager
               label={weekLabel}
               prevHref={prevHref}
               nextHref={nextHref}
               todayHref={todayHref}
               prevLabel="Previous week"
               nextLabel="Next week"
             />
           </div>
         </div>

         {data.employees.length === 0 ? (
           <EmptyState
             title="No timesheets this week"
             description="Once your team clocks in and out, their hours show up here."
           />
         ) : (
           <div className={styles.list}>
             {data.employees.map((emp) => (
               <Card key={emp.profileId}>
                 <button
                   type="button"
                   className={styles.empRow}
                   onClick={() => toggle(emp.profileId)}
                   aria-expanded={expanded.has(emp.profileId)}
                 >
                   <span className={styles.empMain}>
                     <Icon
                       name={expanded.has(emp.profileId) ? "chevron-down" : "chevron-right"}
                       size={16}
                     />
                     <span>
                       <span className={styles.empName}>{emp.name}</span>
                       {emp.primaryPositionName && (
                         <span className={styles.empRole}> · {emp.primaryPositionName}</span>
                       )}
                     </span>
                   </span>
                   <span className={styles.empStats}>
                     <span className={styles.stat}>
                       <span className={styles.statValue}>{emp.hoursActual}</span> hrs
                     </span>
                     <span className={styles.stat}>
                       <span className={styles.statValue}>{formatCost(emp.laborCost)}</span>
                     </span>
                     <EmployeeBadges emp={emp} />
                   </span>
                 </button>

                 {expanded.has(emp.profileId) && (
                   <div className={styles.punches}>
                     {emp.entries.length === 0 ? (
                       <div className={styles.emptyPunch}>No punches this week.</div>
                     ) : (
                       emp.entries.map((entry) => (
                         <div key={entry.id} className={styles.punchRow}>
                           <span className={styles.punchTimes}>{entry.date}</span>
                           <span className={styles.punchMeta}>
                             {clockLabel(entry.clockInAt)} –{" "}
                             {entry.clockOutAt ? clockLabel(entry.clockOutAt) : "—"}
                             {entry.shiftLabel && <span>· shift {entry.shiftLabel}</span>}
                             {entry.incomplete && <Badge tone="warning">Open</Badge>}
                             {entry.late && <Badge tone="danger">Late</Badge>}
                             {entry.edited && <Badge tone="neutral">Edited</Badge>}
                           </span>
                           <span className={styles.punchActions}>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => openEdit(emp.profileId, entry)}
                             >
                               Edit
                             </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               aria-label="Delete punch"
                               onClick={() => setConfirmDelete(entry)}
                             >
                               Delete
                             </Button>
                           </span>
                         </div>
                       ))
                     )}
                     <div className={styles.addRow}>
                       <Button
                         variant="secondary"
                         size="sm"
                         icon={<Icon name="plus" size={14} />}
                         onClick={() => openAdd(emp.profileId)}
                       >
                         Add punch
                       </Button>
                     </div>
                   </div>
                 )}
               </Card>
             ))}
           </div>
         )}

         <Dialog
           open={edit !== null}
           onClose={() => setEdit(null)}
           title={edit?.mode === "add" ? "Add punch" : "Edit punch"}
         >
           <div className={styles.dialogFields}>
             <Input
               label="Clock in"
               type="datetime-local"
               value={clockIn}
               onChange={(e) => setClockIn(e.target.value)}
             />
             <Input
               label="Clock out (leave blank if still open)"
               type="datetime-local"
               value={clockOut}
               onChange={(e) => setClockOut(e.target.value)}
             />
             <div className={styles.dialogActions}>
               <Button variant="ghost" onClick={() => setEdit(null)} disabled={busy}>
                 Cancel
               </Button>
               <Button onClick={saveEdit} disabled={busy}>
                 Save
               </Button>
             </div>
           </div>
         </Dialog>

         <Dialog
           open={confirmDelete !== null}
           onClose={() => setConfirmDelete(null)}
           title="Delete this punch?"
         >
           <div className={styles.dialogFields}>
             <p className={styles.subtitle}>This can&apos;t be undone.</p>
             <div className={styles.dialogActions}>
               <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={busy}>
                 Cancel
               </Button>
               <Button variant="danger" onClick={doDelete} disabled={busy}>
                 Delete
               </Button>
             </div>
           </div>
         </Dialog>
       </div>
     );
   }

   function EmployeeBadges({ emp }: { emp: TimesheetEmployee }) {
     return (
       <span className={styles.badges}>
         {emp.lateCount > 0 && <Badge tone="danger">{emp.lateCount} late</Badge>}
         {emp.noShowCount > 0 && <Badge tone="warning">{emp.noShowCount} no-show</Badge>}
         {emp.overtime && <Badge tone="info">Overtime</Badge>}
       </span>
     );
   }
   ```

5. - [ ] Run the test and expect PASS:
   `npm test -- src/components/manager/TimesheetsView.test.tsx`

6. - [ ] Commit:
   `git add src/components/manager/TimesheetsView.tsx src/components/manager/TimesheetsView.module.css src/components/manager/TimesheetsView.test.tsx && git commit -m "feat: TimesheetsView client component with punch corrections + CSV export"`

---

## Task 8 — `/manager/timesheets` server page

Wires the data layer to the view with weekly URL-state nav (mirrors the schedule/availability pager). Server component; validates the `week` param and snaps to its Monday.

**Files:**
- Create: `src/app/manager/timesheets/page.tsx`
- Create: `src/app/manager/timesheets/loading.tsx`
- Create: `src/app/manager/timesheets/error.tsx`

**Interfaces:**
- Consumes: `requireManager` (`@/lib/auth`); `getManagerLocation` (`@/lib/authz`); `getTimesheetWeekData` (`@/lib/timesheet-data`); `localISODate`, `weekStartOfISO`, `addDaysISO` (`@/lib/time`); `formatWeekOf` (`@/lib/time-format`); `TimesheetsView` (`@/components/manager/TimesheetsView`); `Spinner`, `Button`, `EmptyState` (`@/components/ui/*`).
- Produces: the `/manager/timesheets` route (also linked from the sidebar in Task 9).

**Steps:**

1. - [ ] Implement `src/app/manager/timesheets/page.tsx`:
   ```tsx
   import type { Metadata } from "next";
   import { requireManager } from "@/lib/auth";
   import { getManagerLocation } from "@/lib/authz";
   import { getTimesheetWeekData } from "@/lib/timesheet-data";
   import { addDaysISO, localISODate, weekStartOfISO } from "@/lib/time";
   import { formatWeekOf } from "@/lib/time-format";
   import { TimesheetsView } from "@/components/manager/TimesheetsView";

   export const metadata: Metadata = { title: "Timesheets — RosterHouse" };

   const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

   export default async function TimesheetsPage({
     searchParams,
   }: {
     searchParams: Promise<{ week?: string }>;
   }) {
     const { week } = await searchParams;
     const user = await requireManager();
     const location = await getManagerLocation(user.id);

     const todayISO = localISODate(new Date(), location.timezone);
     const currentWeek = weekStartOfISO(todayISO);
     const rawWeek = week && ISO_DATE.test(week) ? week : currentWeek;
     const weekStart = weekStartOfISO(rawWeek);

     const data = await getTimesheetWeekData(location.id, weekStart);

     return (
       <TimesheetsView
         locationId={location.id}
         weekStart={weekStart}
         weekLabel={formatWeekOf(weekStart)}
         prevHref={`/manager/timesheets?week=${addDaysISO(weekStart, -7)}`}
         nextHref={`/manager/timesheets?week=${addDaysISO(weekStart, 7)}`}
         todayHref="/manager/timesheets"
         data={data}
       />
     );
   }
   ```

2. - [ ] Implement `src/app/manager/timesheets/loading.tsx`:
   ```tsx
   import { Spinner } from "@/components/ui/Spinner";
   import styles from "@/components/schedule/schedule.module.css";

   export default function TimesheetsLoading() {
     return (
       <div className={styles.loadingWrap} role="status" aria-label="Loading timesheets">
         <Spinner />
         <span>Loading timesheets…</span>
       </div>
     );
   }
   ```

3. - [ ] Implement `src/app/manager/timesheets/error.tsx`:
   ```tsx
   "use client";

   import { Button } from "@/components/ui/Button";
   import { EmptyState } from "@/components/ui/EmptyState";
   import styles from "@/components/schedule/schedule.module.css";

   export default function TimesheetsError({ reset }: { error: Error; reset: () => void }) {
     return (
       <div className={styles.errorWrap}>
         <EmptyState
           title="Something went wrong loading timesheets"
           description="Check your connection and try again."
           action={
             <Button variant="secondary" onClick={reset}>
               Try again
             </Button>
           }
         />
       </div>
     );
   }
   ```

4. - [ ] Verify the app type-checks and builds (the page has no dedicated test; it is exercised by the view test + a manual smoke). Run the full check:
   `npm run build`
   Expect a successful compile with no type errors in the new files. (If `npm run build` is heavy in your environment, `npx tsc --noEmit` is an acceptable substitute — expect no errors.)

5. - [ ] Commit:
   `git add src/app/manager/timesheets && git commit -m "feat: /manager/timesheets server page with weekly nav"`

---

## Task 9 — Add the Timesheets nav item to `ManagerSidebar`

Adds the sidebar entry. The `timer` glyph already exists in `Icon.tsx`, so only the NAV array changes.

**Files:**
- Modify: `src/components/chrome/ManagerSidebar.tsx`
- Test: `src/components/chrome/ManagerSidebar.test.tsx` (Create)

**Interfaces:**
- Consumes: existing `NAV` array + `ManagerSidebar` component.
- Produces: a `{ href: "/manager/timesheets", label: "Timesheets", icon: "timer" }` NAV entry.

**Steps:**

1. - [ ] Write the failing test at `src/components/chrome/ManagerSidebar.test.tsx`:
   ```tsx
   // @vitest-environment jsdom
   import { cleanup, render, screen } from "@testing-library/react";
   import { afterEach, describe, expect, it, vi } from "vitest";

   vi.mock("next/navigation", () => ({ usePathname: () => "/manager/timesheets" }));

   import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";

   afterEach(cleanup);

   describe("ManagerSidebar", () => {
     it("shows a Timesheets link that is active on the timesheets route", () => {
       render(<ManagerSidebar locationName="Test location" userName="Test Manager" />);
       const link = screen.getByRole("link", { name: /timesheets/i });
       expect(link.getAttribute("href")).toBe("/manager/timesheets");
       expect(link.getAttribute("aria-current")).toBe("page");
     });
   });
   ```

2. - [ ] Run it and expect FAIL (no Timesheets link yet):
   `npm test -- src/components/chrome/ManagerSidebar.test.tsx`

3. - [ ] Add the entry to the `NAV` array in `src/components/chrome/ManagerSidebar.tsx`. Change the line
   ```ts
     { href: "/manager/swaps", label: "Swaps & open shifts", icon: "repeat" },
   ```
   to
   ```ts
     { href: "/manager/swaps", label: "Swaps & open shifts", icon: "repeat" },
     { href: "/manager/timesheets", label: "Timesheets", icon: "timer" },
   ```

4. - [ ] Run the test and expect PASS:
   `npm test -- src/components/chrome/ManagerSidebar.test.tsx`

5. - [ ] Commit:
   `git add src/components/chrome/ManagerSidebar.tsx src/components/chrome/ManagerSidebar.test.tsx && git commit -m "feat: add Timesheets nav item to ManagerSidebar"`

---

## Task 10 — Dashboard actual labor cost

Adds a week-to-date **actual** labor cost figure (actual hours × rate) beside the existing projected one. Computed from this week's completed clock entries joined to each employee's rate; render an em dash when any completed entry belongs to an employee without a rate (mirrors the projected-cost honesty rule).

**Files:**
- Modify: `src/lib/dashboard-data.ts` (add `actualLaborCost` to `DashboardData` + compute it)
- Modify: `src/app/manager/page.tsx` (render the new StatCard)
- Test: `src/tests/dashboard-actual-cost.test.ts` (Create)

**Interfaces:**
- Produces: `DashboardData.actualLaborCost: string` (e.g. `"$160"`, `"$0"`, or `"—"`).
- Consumes: existing `getDashboardData`, `prisma`, `weekStartOf`, `addDaysISO`; `entryHours` (`@/lib/timesheet-data`).

**Steps:**

1. - [ ] Write the failing test at `src/tests/dashboard-actual-cost.test.ts`:
   ```ts
   // @vitest-environment node
   import { afterAll, beforeAll, describe, expect, it } from "vitest";
   import { prisma } from "@/lib/db";
   import { getDashboardData } from "@/lib/dashboard-data";
   import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";
   import { weekStartOf, localToUtc } from "@/lib/time";

   describe("getDashboardData actual labor cost", () => {
     let f: Fixture;
     let weekMonday: string;
     beforeAll(async () => {
       f = await createFixture();
       weekMonday = weekStartOf(new Date(), f.timezone);
       // A completed 4-hour entry this week for Ana at $20/h → $80 actual.
       await prisma.employeeProfile.update({
         where: { id: f.ana.profileId },
         data: { hourlyRate: 20 },
       });
       const inAt = localToUtc(weekMonday, { hour: 9, minute: 0 }, f.timezone);
       const outAt = localToUtc(weekMonday, { hour: 13, minute: 0 }, f.timezone);
       await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: f.ana.profileId,
           locationId: f.locationId,
           clockInAt: inAt,
           clockOutAt: outAt,
         },
       });
       // An OPEN entry must not contribute to actual cost.
       await prisma.timeClockEntry.create({
         data: {
           employeeProfileId: f.ana.profileId,
           locationId: f.locationId,
           clockInAt: localToUtc(weekMonday, { hour: 14, minute: 0 }, f.timezone),
           clockOutAt: null,
         },
       });
     });
     afterAll(async () => {
       await destroyFixture(f);
     });

     it("sums completed entries × rate, ignoring open ones", async () => {
       const data = await getDashboardData(f.locationId, f.timezone);
       expect(data.actualLaborCost).toBe("$80");
     });
   });
   ```

2. - [ ] Run it and expect FAIL (`actualLaborCost` is undefined):
   `npm test -- src/tests/dashboard-actual-cost.test.ts`

3. - [ ] Modify `src/lib/dashboard-data.ts`. Add the import (extend the existing `@/lib/timesheet-data` import — none exists yet, so add a new line under the `@/lib/schedule-data` import):
   ```ts
   import { entryHours } from "@/lib/timesheet-data";
   ```
   Add the field to the `DashboardData` type, immediately after `projectedLaborCost: string;`:
   ```ts
     actualLaborCost: string;
   ```
   Add a completed-clock-entries query to the `Promise.all` array (append it as a new element after `getScheduleWeekData(...)`), and capture it in the destructure. Change the destructure line
   ```ts
     const [shifts, pendingTimeOff, pendingSwaps, pendingClaims, pendingRequests, clockEntries, weekData] =
       await Promise.all([
   ```
   to
   ```ts
     const [shifts, pendingTimeOff, pendingSwaps, pendingClaims, pendingRequests, clockEntries, weekData, weekClockEntries] =
       await Promise.all([
   ```
   and add this element to the array right after the `getScheduleWeekData(locationId, weekStart),` line:
   ```ts
         prisma.timeClockEntry.findMany({
           where: {
             locationId,
             clockInAt: {
               gte: new Date(`${weekStart}T00:00:00.000Z`),
               lt: new Date(`${addDaysISO(weekStart, 7)}T00:00:00.000Z`),
             },
           },
           include: { employeeProfile: true },
         }),
   ```
   Compute `actualLaborCost` just before the `return {` block (after the existing `projectedLaborCost` computation):
   ```ts
     // Actual week-to-date cost: only completed entries; any completed entry
     // whose employee has no rate makes the figure dishonest → em dash.
     const completed = weekClockEntries.filter((e) => e.clockOutAt !== null);
     let actualLaborCost = "—";
     if (completed.length === 0) {
       actualLaborCost = "$0";
     } else if (completed.every((e) => e.employeeProfile.hourlyRate != null)) {
       const total = completed.reduce(
         (sum, e) => sum + entryHours(e.clockInAt, e.clockOutAt) * Number(e.employeeProfile.hourlyRate),
         0,
       );
       actualLaborCost = `$${Math.round(total).toLocaleString("en-US")}`;
     }
   ```
   Add `actualLaborCost,` to the returned object, immediately after `projectedLaborCost,`:
   ```ts
       projectedLaborCost,
       actualLaborCost,
   ```

4. - [ ] Run the test and expect PASS:
   `npm test -- src/tests/dashboard-actual-cost.test.ts`

5. - [ ] Render the new figure in `src/app/manager/page.tsx`. After the existing "Projected labor cost" StatCard
   ```tsx
           <StatCard label="Projected labor cost" value={data.projectedLaborCost} />
   ```
   add:
   ```tsx
           <StatCard label="Actual labor cost" value={data.actualLaborCost} />
   ```

6. - [ ] Run the full test suite for the touched areas and expect PASS:
   `npm test -- src/tests/dashboard-actual-cost.test.ts src/tests/dashboard-counts.test.ts`

7. - [ ] Commit:
   `git add src/lib/dashboard-data.ts src/app/manager/page.tsx src/tests/dashboard-actual-cost.test.ts && git commit -m "feat: actual labor cost on the manager dashboard"`

---

## Final verification

- [ ] Run the whole Phase 4 test set and expect all PASS:
  `npm test -- src/tests/timeclock-audit-fields.test.ts src/tests/timesheet-data.test.ts src/tests/timesheet-schemas.test.ts src/tests/time-clock-entries.api.test.ts src/tests/timesheet-export.api.test.ts src/components/manager/TimesheetsView.test.tsx src/components/chrome/ManagerSidebar.test.tsx src/tests/dashboard-actual-cost.test.ts`
- [ ] Confirm the sidebar shows **Timesheets** (icon `timer`) and `/manager/timesheets` renders with the weekly pager, per-employee sections, flag badges, punch add/edit/delete dialogs, and the **Export CSV** button.
