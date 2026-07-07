# Availability Grouping & Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Group the manager team-availability overview under primary-position headers and add client-side day and status filters, using data already on hand plus a stable server-side ordering.

**Architecture:** One tiny server-side query change (`src/lib/queries/availability.ts`): add a two-key `orderBy` and expose `primaryPositionId` on `OverviewEmployee`. Everything else is client-side and derives from the existing per-employee `days[]`: a pure grouping/filtering module (`src/lib/availability-view.ts`, unit-tested with no DB) and a new client component (`src/app/manager/availability/AvailabilityView.tsx`) that renders position-header sections with a day `<Select>` and a status `<Select>`. The server page fetches the location's active positions and hands them (with the availability data) to the client view.

**Tech Stack:** Next.js 16, Prisma 7 + Postgres, zod 4, React 19, Vitest 4, CSS modules.

## Global Constraints

- Ordering (exact): `orderBy: [{ primaryPosition: { sortOrder: "asc" } }, { user: { name: "asc" } }]`. This is valid — `EmployeeProfileOrderByWithRelationInput.primaryPosition` is a `PositionOrderByWithRelationInput` (confirmed in `src/generated/prisma/models/EmployeeProfile.ts`).
- `OverviewEmployee` gains `primaryPositionId: string | null` and **keeps** `primaryPositionName: string | null`.
- Grouping: sections are ordered by position `sortOrder` (headers come from the passed-in active-positions list, already sorted). A group renders **only if it has at least one employee after filtering**. Employees whose `primaryPositionId` is null — or whose primary position is not in the active-positions list (e.g. archived) — fall into a single **"Unassigned"** group rendered **last**.
- Day filter values: `"all"`, then `"0".."6"` (0 = Mon … 6 = Sun, matching `AvailabilityRule.dayOfWeek` / `weekDatesOf` index). `"all"` shows all 7 day columns; a specific day shows only that one column.
- Status filter values: `"all"`, `"available"`, `"unavailable"`, `"timeoff"`. Derived from each employee's existing `days[]` scoped to the **currently selected day filter** (all 7 days when day = `"all"`):
  - `available` = employee has ≥1 in-scope day with `isAvailable === true && timeOff === false`.
  - `unavailable` = employee has ≥1 in-scope day with `isAvailable === false` (time off does not count as unavailable).
  - `timeoff` = employee has ≥1 in-scope day with `timeOff === true`.
- No secondary/qualified-role filtering (deferred). No query change beyond the two above. This phase is independent of Phases 1–2.
- Tenancy/auth on the page is already handled by `requireManager()` + `getManagerLocation()`; no new API routes in this phase.
- No Tailwind — CSS modules + design tokens (`var(--...)`). Reuse existing `availability.module.css` classes; add new ones there.
- Commit after EVERY task with a `feat:`/`test:` message.

---

## Task 1 — Query: stable ordering + expose `primaryPositionId`

Add the two-key `orderBy` and surface `primaryPositionId` on `OverviewEmployee`. The existing query test file already builds fixtures with `createTestOrg`/`createTestEmployee` (from `@/lib/test/factories`); we extend it.

**Files:**
- Modify: `src/lib/queries/availability.ts`
- Test: `src/lib/queries/availability.test.ts` (extend existing)

**Interfaces:**
- Produces: `OverviewEmployee = { profileId: string; name: string; primaryPositionId: string | null; primaryPositionName: string | null; days: OverviewDay[] }`
- Produces: `getLocationAvailability(locationId: string, weekStart: string): Promise<LocationAvailability>` — now ordered by `[{ primaryPosition: { sortOrder: "asc" } }, { user: { name: "asc" } }]`.
- Consumes (test only, existing): `createTestOrg(): Promise<TestOrg>` where `TestOrg = { organizationId, locationId, timezone, positions: { lineCook, server }, managerUserId }`; `createTestEmployee(t, name): Promise<{ userId; profileId }>` (always sets `primaryPositionId: t.positions.lineCook`); `deleteTestOrg(organizationId)`. All from `@/lib/test/factories`.
- Consumes (query, existing): `weekDatesOf(weekStart)` from `@/lib/time`; `prisma` from `@/lib/db`.

**Steps:**

1. - [ ] Write the failing test. Append a new `it(...)` to the existing `describe("getLocationAvailability", ...)` block in `src/lib/queries/availability.test.ts`, and update the existing first assertion so it also checks the new field. First, replace the existing `mariaDays[0]` equality assertion (which will now fail because the employee object shape is unchanged but we add a new sibling field — the `days` objects are untouched, so keep that block as-is) — instead ADD a new test after the existing `it(...)` block, inside the same `describe`, immediately before the closing `});` of the describe:

     ```ts
     it("exposes primaryPositionId and orders by primary sortOrder then name", async () => {
       // Reassign primary positions so ordering is observable:
       //  - Maria → Server (sortOrder 1)
       //  - Norule → Line cook (sortOrder 0)  [default already, set explicitly]
       // Sorted result must be: Norule (Line cook, 0), then Maria (Server, 1).
       await prisma.employeeProfile.update({
         where: { id: maria.profileId },
         data: { primaryPositionId: t.positions.server },
       });
       const norule = await prisma.employeeProfile.findFirstOrThrow({
         where: { locationId: t.locationId, user: { name: "Norule Test" } },
       });
       await prisma.employeeProfile.update({
         where: { id: norule.id },
         data: { primaryPositionId: t.positions.lineCook },
       });

       const data = await getLocationAvailability(t.locationId, WEEK);
       expect(data.employees.map((e) => e.name)).toEqual(["Norule Test", "Maria Test"]);
       expect(data.employees.map((e) => e.primaryPositionId)).toEqual([
         t.positions.lineCook,
         t.positions.server,
       ]);
       // primaryPositionName still exposed alongside the id.
       expect(data.employees.map((e) => e.primaryPositionName)).toEqual([
         "Line cook",
         "Server",
       ]);
     });
     ```

2. - [ ] Run it — expect FAIL (type error: `primaryPositionId` does not exist on `OverviewEmployee`; and/or the order assertion fails because the query still sorts only by name → Maria before Norule):

     ```
     npm test -- src/lib/queries/availability.test.ts
     ```

3. - [ ] Implement. Edit `src/lib/queries/availability.ts`. (a) Add `primaryPositionId` to the `OverviewEmployee` type. (b) Change the `orderBy`. (c) Set `primaryPositionId` in the mapped result. The complete file after editing:

     ```ts
     // src/lib/queries/availability.ts — manager overview: who can work when, this week.
     import { prisma } from "@/lib/db";
     import { weekDatesOf } from "@/lib/time";

     export type OverviewDay = {
       dayOfWeek: number;
       date: string; // ISODate within the displayed week
       isAvailable: boolean;
       startTime: string | null; // "09:00" or null = all day
       endTime: string | null;
       timeOff: boolean; // approved time off covers this date
     };

     export type OverviewEmployee = {
       profileId: string;
       name: string;
       primaryPositionId: string | null;
       primaryPositionName: string | null;
       days: OverviewDay[];
     };

     export type LocationAvailability = {
       weekStart: string;
       employees: OverviewEmployee[];
     };

     export async function getLocationAvailability(
       locationId: string,
       weekStart: string
     ): Promise<LocationAvailability> {
       const dates = weekDatesOf(weekStart);
       const weekEnd = dates[6];

       const profiles = await prisma.employeeProfile.findMany({
         where: { locationId, status: "active" },
         include: {
           user: true,
           primaryPosition: true,
           availability: true,
           timeOffRequests: {
             where: {
               status: "approved",
               startDate: { lte: new Date(`${weekEnd}T00:00:00.000Z`) },
               endDate: { gte: new Date(`${weekStart}T00:00:00.000Z`) },
             },
           },
         },
         orderBy: [{ primaryPosition: { sortOrder: "asc" } }, { user: { name: "asc" } }],
       });

       const employees = profiles.map((p) => {
         const byDay = new Map(p.availability.map((r) => [r.dayOfWeek, r]));
         const days = dates.map((date, dayOfWeek) => {
           const rule = byDay.get(dayOfWeek);
           const timeOff = p.timeOffRequests.some(
             (req) =>
               req.startDate.toISOString().slice(0, 10) <= date &&
               req.endDate.toISOString().slice(0, 10) >= date
           );
           return {
             dayOfWeek,
             date,
             isAvailable: rule ? rule.isAvailable : true,
             startTime: rule?.startTime ?? null,
             endTime: rule?.endTime ?? null,
             timeOff,
           };
         });
         return {
           profileId: p.id,
           name: p.user.name,
           primaryPositionId: p.primaryPositionId,
           primaryPositionName: p.primaryPosition?.name ?? null,
           days,
         };
       });

       return { weekStart, employees };
     }
     ```

4. - [ ] Run it — expect PASS (both the existing test and the new ordering test):

     ```
     npm test -- src/lib/queries/availability.test.ts
     ```

5. - [ ] Commit:

     ```
     git add src/lib/queries/availability.ts src/lib/queries/availability.test.ts
     git commit -m "feat: order availability by primary sortOrder then name, expose primaryPositionId"
     ```

---

## Task 2 — Pure grouping + filtering module

Extract the day/status filtering and primary-position grouping into a pure, DB-free module so it is fully unit-testable. The client component (Task 3) is a thin renderer over these functions.

**Files:**
- Create: `src/lib/availability-view.ts`
- Test: `src/lib/availability-view.test.ts`

**Interfaces:**
- Consumes: `OverviewEmployee`, `OverviewDay` from `@/lib/queries/availability` (Task 1).
- Produces:
  ```ts
  export type StatusFilter = "all" | "available" | "unavailable" | "timeoff";
  // dayFilter: "all" | "0".."6" as a string; -1 sentinel means "all" internally
  export type PositionRef = { id: string; name: string };
  export type AvailabilityGroup = { key: string; label: string; employees: OverviewEmployee[] };
  export function inScopeDays(emp: OverviewEmployee, dayFilter: number): OverviewDay[];
  export function matchesStatus(emp: OverviewEmployee, status: StatusFilter, dayFilter: number): boolean;
  export function groupByPrimary(
    employees: OverviewEmployee[],
    positions: PositionRef[]
  ): AvailabilityGroup[];
  export function filterAndGroup(
    employees: OverviewEmployee[],
    positions: PositionRef[],
    status: StatusFilter,
    dayFilter: number
  ): AvailabilityGroup[];
  ```
  where `dayFilter` is `-1` for "all days" or `0..6` for a single day; the `"Unassigned"` group has `key: "__unassigned__"`.

**Steps:**

1. - [ ] Write the failing test. Create `src/lib/availability-view.test.ts`:

     ```ts
     import { describe, expect, it } from "vitest";
     import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";
     import {
       filterAndGroup,
       groupByPrimary,
       inScopeDays,
       matchesStatus,
       type PositionRef,
     } from "./availability-view";

     const POSITIONS: PositionRef[] = [
       { id: "cook", name: "Line cook" },
       { id: "server", name: "Server" },
     ];

     function day(over: Partial<OverviewDay> & { dayOfWeek: number }): OverviewDay {
       return {
         date: `2026-07-${String(6 + over.dayOfWeek).padStart(2, "0")}`,
         isAvailable: true,
         startTime: null,
         endTime: null,
         timeOff: false,
         ...over,
       };
     }

     function emp(
       over: Partial<OverviewEmployee> & { profileId: string; name: string }
     ): OverviewEmployee {
       return {
         primaryPositionId: null,
         primaryPositionName: null,
         days: Array.from({ length: 7 }, (_, dayOfWeek) => day({ dayOfWeek })),
         ...over,
       };
     }

     describe("inScopeDays", () => {
       it("returns all 7 days when dayFilter is -1", () => {
         const e = emp({ profileId: "1", name: "A" });
         expect(inScopeDays(e, -1)).toHaveLength(7);
       });
       it("returns only the matching day when dayFilter is 0..6", () => {
         const e = emp({ profileId: "1", name: "A" });
         const scoped = inScopeDays(e, 2);
         expect(scoped).toHaveLength(1);
         expect(scoped[0].dayOfWeek).toBe(2);
       });
     });

     describe("matchesStatus", () => {
       const cook = emp({
         profileId: "c",
         name: "Cook",
         days: [
           day({ dayOfWeek: 0, isAvailable: true }), // available Mon
           day({ dayOfWeek: 1, isAvailable: false }), // unavailable Tue
           day({ dayOfWeek: 2, timeOff: true }), // time off Wed
           ...Array.from({ length: 4 }, (_, i) => day({ dayOfWeek: 3 + i })),
         ],
       });

       it("all → always matches", () => {
         expect(matchesStatus(cook, "all", -1)).toBe(true);
       });
       it("available → true when any in-scope day is available and not time off", () => {
         expect(matchesStatus(cook, "available", -1)).toBe(true);
         // Scope to Wed (time off) → no available day in scope.
         expect(matchesStatus(cook, "available", 2)).toBe(false);
       });
       it("unavailable → true only when an in-scope day is isAvailable false", () => {
         expect(matchesStatus(cook, "unavailable", -1)).toBe(true);
         expect(matchesStatus(cook, "unavailable", 1)).toBe(true); // Tue
         expect(matchesStatus(cook, "unavailable", 0)).toBe(false); // Mon available
       });
       it("timeoff → true only when an in-scope day has timeOff", () => {
         expect(matchesStatus(cook, "timeoff", -1)).toBe(true);
         expect(matchesStatus(cook, "timeoff", 2)).toBe(true); // Wed
         expect(matchesStatus(cook, "timeoff", 0)).toBe(false); // Mon
       });
       it("time off day does not count as unavailable", () => {
         const timeOffOnly = emp({
           profileId: "t",
           name: "T",
           days: [day({ dayOfWeek: 0, isAvailable: true, timeOff: true })],
         });
         expect(matchesStatus(timeOffOnly, "unavailable", 0)).toBe(false);
       });
     });

     describe("groupByPrimary", () => {
       it("groups by primary position in sortOrder, unassigned last, empty groups dropped", () => {
         const a = emp({ profileId: "a", name: "Ana", primaryPositionId: "server", primaryPositionName: "Server" });
         const b = emp({ profileId: "b", name: "Ben", primaryPositionId: "cook", primaryPositionName: "Line cook" });
         const c = emp({ profileId: "c", name: "Cal", primaryPositionId: null, primaryPositionName: null });
         const groups = groupByPrimary([a, b, c], POSITIONS);
         expect(groups.map((g) => g.label)).toEqual(["Line cook", "Server", "Unassigned"]);
         expect(groups.map((g) => g.key)).toEqual(["cook", "server", "__unassigned__"]);
         expect(groups[0].employees.map((e) => e.name)).toEqual(["Ben"]);
         expect(groups[2].employees.map((e) => e.name)).toEqual(["Cal"]);
       });
       it("puts an employee whose primary position is not in the active list into Unassigned", () => {
         const archived = emp({
           profileId: "x",
           name: "Xander",
           primaryPositionId: "archived-role",
           primaryPositionName: "Barback",
         });
         const groups = groupByPrimary([archived], POSITIONS);
         expect(groups).toHaveLength(1);
         expect(groups[0].key).toBe("__unassigned__");
       });
     });

     describe("filterAndGroup", () => {
       it("applies status + day filter, then groups, dropping now-empty groups", () => {
         const cook = emp({
           profileId: "cook1",
           name: "Cook One",
           primaryPositionId: "cook",
           primaryPositionName: "Line cook",
           days: [day({ dayOfWeek: 0, isAvailable: false })].concat(
             Array.from({ length: 6 }, (_, i) => day({ dayOfWeek: 1 + i }))
           ),
         });
         const server = emp({
           profileId: "srv1",
           name: "Server One",
           primaryPositionId: "server",
           primaryPositionName: "Server",
         });
         // Status = unavailable, all days → only the cook qualifies; server group dropped.
         const groups = filterAndGroup([cook, server], POSITIONS, "unavailable", -1);
         expect(groups.map((g) => g.label)).toEqual(["Line cook"]);
         expect(groups[0].employees.map((e) => e.name)).toEqual(["Cook One"]);
       });
     });
     ```

2. - [ ] Run it — expect FAIL (module `./availability-view` does not exist):

     ```
     npm test -- src/lib/availability-view.test.ts
     ```

3. - [ ] Implement. Create `src/lib/availability-view.ts`:

     ```ts
     // src/lib/availability-view.ts — pure, DB-free grouping + filtering for the
     // manager availability overview. Unit-tested; the client view is a thin
     // renderer over these functions.
     import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";

     export type StatusFilter = "all" | "available" | "unavailable" | "timeoff";

     export type PositionRef = { id: string; name: string };

     export type AvailabilityGroup = {
       key: string;
       label: string;
       employees: OverviewEmployee[];
     };

     export const UNASSIGNED_KEY = "__unassigned__";

     /** dayFilter: -1 = all 7 days; 0..6 = that single day (Mon0). */
     export function inScopeDays(emp: OverviewEmployee, dayFilter: number): OverviewDay[] {
       if (dayFilter < 0) return emp.days;
       return emp.days.filter((d) => d.dayOfWeek === dayFilter);
     }

     export function matchesStatus(
       emp: OverviewEmployee,
       status: StatusFilter,
       dayFilter: number
     ): boolean {
       if (status === "all") return true;
       const days = inScopeDays(emp, dayFilter);
       if (status === "available") {
         return days.some((d) => d.isAvailable && !d.timeOff);
       }
       if (status === "unavailable") {
         return days.some((d) => !d.isAvailable);
       }
       // status === "timeoff"
       return days.some((d) => d.timeOff);
     }

     /**
      * Group employees under primary-position headers in the given position
      * order. Employees with a null primary — or a primary not present in
      * `positions` (e.g. archived) — fall into a single "Unassigned" group
      * rendered last. Groups with no employees are omitted.
      */
     export function groupByPrimary(
       employees: OverviewEmployee[],
       positions: PositionRef[]
     ): AvailabilityGroup[] {
       const known = new Set(positions.map((p) => p.id));
       const byPosition = new Map<string, OverviewEmployee[]>();
       const unassigned: OverviewEmployee[] = [];
       for (const emp of employees) {
         if (emp.primaryPositionId && known.has(emp.primaryPositionId)) {
           const bucket = byPosition.get(emp.primaryPositionId) ?? [];
           bucket.push(emp);
           byPosition.set(emp.primaryPositionId, bucket);
         } else {
           unassigned.push(emp);
         }
       }
       const groups: AvailabilityGroup[] = [];
       for (const p of positions) {
         const bucket = byPosition.get(p.id);
         if (bucket && bucket.length > 0) {
           groups.push({ key: p.id, label: p.name, employees: bucket });
         }
       }
       if (unassigned.length > 0) {
         groups.push({ key: UNASSIGNED_KEY, label: "Unassigned", employees: unassigned });
       }
       return groups;
     }

     export function filterAndGroup(
       employees: OverviewEmployee[],
       positions: PositionRef[],
       status: StatusFilter,
       dayFilter: number
     ): AvailabilityGroup[] {
       const filtered = employees.filter((e) => matchesStatus(e, status, dayFilter));
       return groupByPrimary(filtered, positions);
     }
     ```

4. - [ ] Run it — expect PASS:

     ```
     npm test -- src/lib/availability-view.test.ts
     ```

5. - [ ] Commit:

     ```
     git add src/lib/availability-view.ts src/lib/availability-view.test.ts
     git commit -m "feat: pure grouping and day/status filtering for availability view"
     ```

---

## Task 3 — Client view: section headers + day/status filters, wired into the page

Move the grid rendering into a new client component that owns the two `<Select>` controls and renders one grid per primary-position group, honoring the day filter (column narrowing) and status filter. Rewire `page.tsx` to fetch active positions and render the component. Add the needed CSS.

**Files:**
- Create: `src/app/manager/availability/AvailabilityView.tsx`
- Modify: `src/app/manager/availability/page.tsx`
- Modify: `src/app/manager/availability/availability.module.css`
- Test: `src/app/manager/availability/AvailabilityView.test.tsx`

**Interfaces:**
- Consumes: `filterAndGroup`, `type StatusFilter`, `type PositionRef` from `@/lib/availability-view`; `type OverviewDay`, `type OverviewEmployee` from `@/lib/queries/availability`; `Select` from `@/components/ui/Select`; `Avatar` from `@/components/ui/Avatar`; `formatDayLabel` from `@/lib/time`; `hhmmTo12h` from `@/lib/time-format`; `weekDatesOf` from `@/lib/time`.
- Produces:
  ```ts
  export type AvailabilityViewProps = {
    weekStart: string;
    employees: OverviewEmployee[];
    positions: PositionRef[]; // active positions, sortOrder-ordered
  };
  export function AvailabilityView(props: AvailabilityViewProps): JSX.Element;
  ```
- Consumes (page, existing): `requireManager`, `getManagerLocation`, `getLocationAvailability`, `prisma` from `@/lib/db`, `weekStartOf`/`addDaysISO`/`weekDatesOf` from `@/lib/time`, `formatWeekOf` from `@/lib/time-format`, `DatePager`, `EmptyState`.

**Steps:**

1. - [ ] Write the failing test. Create `src/app/manager/availability/AvailabilityView.test.tsx`:

     ```tsx
     // @vitest-environment jsdom
     import { cleanup, fireEvent, render, screen } from "@testing-library/react";
     import { afterEach, describe, expect, it } from "vitest";
     import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";
     import type { PositionRef } from "@/lib/availability-view";
     import { AvailabilityView } from "./AvailabilityView";

     const POSITIONS: PositionRef[] = [
       { id: "cook", name: "Line cook" },
       { id: "server", name: "Server" },
     ];

     function day(over: Partial<OverviewDay> & { dayOfWeek: number }): OverviewDay {
       return {
         date: `2026-07-${String(6 + over.dayOfWeek).padStart(2, "0")}`,
         isAvailable: true,
         startTime: null,
         endTime: null,
         timeOff: false,
         ...over,
       };
     }

     function emp(
       over: Partial<OverviewEmployee> & { profileId: string; name: string }
     ): OverviewEmployee {
       return {
         primaryPositionId: null,
         primaryPositionName: null,
         days: Array.from({ length: 7 }, (_, d) => day({ dayOfWeek: d })),
         ...over,
       };
     }

     const EMPLOYEES: OverviewEmployee[] = [
       emp({
         profileId: "ben",
         name: "Ben Cook",
         primaryPositionId: "cook",
         primaryPositionName: "Line cook",
         days: [
           day({ dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" }),
           day({ dayOfWeek: 1, isAvailable: false }),
           day({ dayOfWeek: 2, timeOff: true }),
           ...Array.from({ length: 4 }, (_, i) => day({ dayOfWeek: 3 + i })),
         ],
       }),
       emp({
         profileId: "ana",
         name: "Ana Server",
         primaryPositionId: "server",
         primaryPositionName: "Server",
       }),
       emp({ profileId: "cal", name: "Cal NoRole" }), // null primary → Unassigned
     ];

     afterEach(cleanup);

     describe("AvailabilityView", () => {
       it("renders one section per occupied primary position plus Unassigned", () => {
         render(<AvailabilityView weekStart="2026-07-06" employees={EMPLOYEES} positions={POSITIONS} />);
         const headers = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
         expect(headers).toEqual(["Line cook", "Server", "Unassigned"]);
         expect(screen.getByText("Ben Cook")).toBeTruthy();
         expect(screen.getByText("Cal NoRole")).toBeTruthy();
       });

       it("day filter narrows to a single day column", () => {
         render(<AvailabilityView weekStart="2026-07-06" employees={EMPLOYEES} positions={POSITIONS} />);
         // 7 day-head cells per section × 3 sections = 21 by default.
         expect(screen.getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/).length).toBeGreaterThan(3);
         const dayFilter = screen.getByLabelText("Day");
         fireEvent.change(dayFilter, { target: { value: "1" } }); // Tue
         // Ben's Tue is unavailable — its cell text renders.
         expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
         // "Available" windowed Mon cell should no longer be shown.
         expect(screen.queryByText("9:00 AM – 5:00 PM")).toBeNull();
       });

       it("status filter drops non-matching employees and empty sections", () => {
         render(<AvailabilityView weekStart="2026-07-06" employees={EMPLOYEES} positions={POSITIONS} />);
         const statusFilter = screen.getByLabelText("Status");
         fireEvent.change(statusFilter, { target: { value: "unavailable" } });
         // Only Ben has an unavailable day → only the Line cook section remains.
         const headers = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
         expect(headers).toEqual(["Line cook"]);
         expect(screen.queryByText("Ana Server")).toBeNull();
         expect(screen.queryByText("Cal NoRole")).toBeNull();
       });

       it("shows an empty state when filters exclude everyone", () => {
         const noneTimeOff = EMPLOYEES.map((e) => ({
           ...e,
           days: e.days.map((d) => ({ ...d, timeOff: false })),
         }));
         render(<AvailabilityView weekStart="2026-07-06" employees={noneTimeOff} positions={POSITIONS} />);
         const statusFilter = screen.getByLabelText("Status");
         fireEvent.change(statusFilter, { target: { value: "timeoff" } });
         expect(screen.getByText("No one matches these filters")).toBeTruthy();
       });
     });
     ```

2. - [ ] Run it — expect FAIL (module `./AvailabilityView` does not exist):

     ```
     npm test -- src/app/manager/availability/AvailabilityView.test.tsx
     ```

3. - [ ] Implement the component. Create `src/app/manager/availability/AvailabilityView.tsx`:

     ```tsx
     "use client";

     import { Fragment, useMemo, useState } from "react";
     import { Avatar } from "@/components/ui/Avatar";
     import { EmptyState } from "@/components/ui/EmptyState";
     import { Select } from "@/components/ui/Select";
     import {
       filterAndGroup,
       type PositionRef,
       type StatusFilter,
     } from "@/lib/availability-view";
     import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";
     import { formatDayLabel, weekDatesOf } from "@/lib/time";
     import { hhmmTo12h } from "@/lib/time-format";
     import styles from "./availability.module.css";

     export type AvailabilityViewProps = {
       weekStart: string;
       employees: OverviewEmployee[];
       positions: PositionRef[];
     };

     const DAY_OPTIONS = [
       { value: "-1", label: "All days" },
       { value: "0", label: "Mon" },
       { value: "1", label: "Tue" },
       { value: "2", label: "Wed" },
       { value: "3", label: "Thu" },
       { value: "4", label: "Fri" },
       { value: "5", label: "Sat" },
       { value: "6", label: "Sun" },
     ];

     const STATUS_OPTIONS = [
       { value: "all", label: "All statuses" },
       { value: "available", label: "Available" },
       { value: "unavailable", label: "Unavailable" },
       { value: "timeoff", label: "On time-off this week" },
     ];

     export function AvailabilityView({ weekStart, employees, positions }: AvailabilityViewProps) {
       const [dayFilter, setDayFilter] = useState("-1");
       const [status, setStatus] = useState<StatusFilter>("all");

       const dayNum = Number(dayFilter);
       const dates = useMemo(() => weekDatesOf(weekStart), [weekStart]);
       // Columns shown: all 7, or the single selected day.
       const shownDates = dayNum < 0 ? dates : [dates[dayNum]];

       const groups = useMemo(
         () => filterAndGroup(employees, positions, status, dayNum),
         [employees, positions, status, dayNum]
       );

       return (
         <div className={styles.viewRoot}>
           <div className={styles.controls}>
             <Select
               label="Day"
               value={dayFilter}
               onChange={setDayFilter}
               options={DAY_OPTIONS}
               className={styles.control}
             />
             <Select
               label="Status"
               value={status}
               onChange={(v) => setStatus(v as StatusFilter)}
               options={STATUS_OPTIONS}
               className={styles.control}
             />
           </div>

           {groups.length === 0 ? (
             <EmptyState
               title="No one matches these filters"
               description="Try a different day or status."
             />
           ) : (
             groups.map((group) => (
               <section key={group.key} className={styles.group}>
                 <h2 className={styles.groupHeader}>{group.label}</h2>
                 <div className={styles.gridWrap}>
                   <div
                     className={styles.grid}
                     style={{
                       gridTemplateColumns: `200px repeat(${shownDates.length}, minmax(96px, 1fr))`,
                       minWidth: shownDates.length === 1 ? 320 : 900,
                     }}
                   >
                     <div />
                     {shownDates.map((d) => (
                       <div key={d} className={styles.dayHead}>
                         {formatDayLabel(d)}
                       </div>
                     ))}
                     {group.employees.map((e) => (
                       <Fragment key={e.profileId}>
                         <div className={styles.person}>
                           <Avatar name={e.name} size={28} />
                           <div>
                             <div className={styles.personName}>{e.name}</div>
                             {e.primaryPositionName && (
                               <div className={styles.personRole}>{e.primaryPositionName}</div>
                             )}
                           </div>
                         </div>
                         {shownDaysOf(e, dayNum).map((day) => (
                           <AvailabilityCell key={day.date} day={day} />
                         ))}
                       </Fragment>
                     ))}
                   </div>
                 </div>
               </section>
             ))
           )}
         </div>
       );
     }

     function shownDaysOf(emp: OverviewEmployee, dayNum: number): OverviewDay[] {
       if (dayNum < 0) return emp.days;
       return emp.days.filter((d) => d.dayOfWeek === dayNum);
     }

     function AvailabilityCell({ day }: { day: OverviewDay }) {
       if (day.timeOff) {
         return <div className={`${styles.cell} ${styles.cellTimeOff}`}>Time off</div>;
       }
       if (!day.isAvailable) {
         return <div className={`${styles.cell} ${styles.cellOff}`}>Unavailable</div>;
       }
       if (day.startTime && day.endTime) {
         return (
           <div className={`${styles.cell} ${styles.cellOn}`}>
             {hhmmTo12h(day.startTime)} – {hhmmTo12h(day.endTime)}
           </div>
         );
       }
       return <div className={`${styles.cell} ${styles.cellOn}`}>All day</div>;
     }
     ```

4. - [ ] Add the new CSS. Append to `src/app/manager/availability/availability.module.css` (do not remove existing classes — the component reuses `.gridWrap`, `.grid`, `.dayHead`, `.person`, `.personName`, `.personRole`, `.cell`, `.cellOn`, `.cellOff`, `.cellTimeOff`):

     ```css

     .viewRoot {
       display: flex;
       flex-direction: column;
       gap: 20px;
     }

     .controls {
       display: flex;
       gap: 12px;
       flex-wrap: wrap;
       align-items: flex-end;
     }

     .control {
       min-width: 180px;
     }

     .group {
       display: flex;
       flex-direction: column;
       gap: 8px;
     }

     .groupHeader {
       font-size: 13px;
       font-weight: 700;
       text-transform: uppercase;
       letter-spacing: 0.04em;
       color: var(--text-secondary);
       margin: 0;
     }
     ```

     Note: the `.grid` rule in the existing file hard-codes `grid-template-columns` and `min-width`; the component overrides both via inline `style`, which wins over the class. Leave the existing `.grid` rule as-is.

5. - [ ] Rewire the page. Replace the contents of `src/app/manager/availability/page.tsx` with the version below. It drops the inline grid + `AvailabilityCell` (now in the client component), fetches active positions, and renders `AvailabilityView`. Note `where: { archivedAt: null }` is intentionally **omitted** here — Phase 3 is independent of Phase 2, and `Position` has no `archivedAt` column yet; filtering by primary-position id in `groupByPrimary` already routes any not-listed primary into "Unassigned". Complete file:

     ```tsx
     import { requireManager } from "@/lib/auth";
     import { getManagerLocation } from "@/lib/authz";
     import { prisma } from "@/lib/db";
     import { getLocationAvailability } from "@/lib/queries/availability";
     import { addDaysISO, weekStartOf } from "@/lib/time";
     import { formatWeekOf } from "@/lib/time-format";
     import { DatePager } from "@/components/chrome/DatePager";
     import { EmptyState } from "@/components/ui/EmptyState";
     import { AvailabilityView } from "./AvailabilityView";
     import styles from "./availability.module.css";

     const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

     export default async function ManagerAvailabilityPage({
       searchParams,
     }: {
       searchParams: Promise<{ week?: string }>;
     }) {
       const { week } = await searchParams;
       const user = await requireManager();
       const location = await getManagerLocation(user.id);
       const thisWeek = weekStartOf(new Date(), location.timezone);
       const weekStart = week && WEEK_RE.test(week) ? week : thisWeek;

       const [data, positions] = await Promise.all([
         getLocationAvailability(location.id, weekStart),
         prisma.position.findMany({
           where: { locationId: location.id },
           orderBy: { sortOrder: "asc" },
         }),
       ]);

       return (
         <div className={styles.page}>
           <div className={styles.header}>
             <div>
               <h1 className={styles.title}>Team availability</h1>
               <div className={styles.subtitle}>
                 See who&apos;s available before you build the schedule. Approved time off is shown for this week.
               </div>
             </div>
             <DatePager
               label={formatWeekOf(weekStart)}
               prevHref={`/manager/availability?week=${addDaysISO(weekStart, -7)}`}
               nextHref={`/manager/availability?week=${addDaysISO(weekStart, 7)}`}
               todayHref={`/manager/availability?week=${thisWeek}`}
             />
           </div>

           {data.employees.length === 0 ? (
             <EmptyState
               title="No team members yet"
               description="Invite your team from the Team page to see their availability here."
             />
           ) : (
             <AvailabilityView
               weekStart={weekStart}
               employees={data.employees}
               positions={positions.map((p) => ({ id: p.id, name: p.name }))}
             />
           )}
         </div>
       );
     }
     ```

6. - [ ] Run the component test — expect PASS:

     ```
     npm test -- src/app/manager/availability/AvailabilityView.test.tsx
     ```

7. - [ ] Typecheck the page + component compile with the rest of the suite (run the two Phase-3 lib tests plus the component test together; all must pass):

     ```
     npm test -- src/lib/availability-view.test.ts src/lib/queries/availability.test.ts src/app/manager/availability/AvailabilityView.test.tsx
     ```

8. - [ ] Commit:

     ```
     git add src/app/manager/availability/AvailabilityView.tsx src/app/manager/availability/AvailabilityView.test.tsx src/app/manager/availability/availability.module.css src/app/manager/availability/page.tsx
     git commit -m "feat: group availability by primary role with day and status filters"
     ```

---

## Done criteria

- `getLocationAvailability` returns employees ordered by primary `sortOrder` then name, each with `primaryPositionId` and `primaryPositionName`.
- The availability page renders one grid section per occupied primary position (in `sortOrder`), an "Unassigned" section last for null/unlisted primaries, a working Day filter (All / Mon…Sun) that narrows columns, and a Status filter (All / Available / Unavailable / On time-off this week) that drops non-matching employees and now-empty sections, with an empty state when filters exclude everyone.
- All three new/updated test files pass; no API routes were added.
