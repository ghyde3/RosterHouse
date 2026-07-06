# RosterHouse Phase 3 — Manager Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the manager scheduling loop end-to-end: time/conflict libraries, schedule CRUD API with computed conflicts, the week/day/month schedule builder with a live-warning assign dialog, a transactional publish with real notification fan-out, and a dashboard with real aggregates.

**Architecture:** Pure domain logic lives in `src/lib` (time math, conflict detection) and is unit-tested first; a prisma-backed context builder and a `schedule-data` assembly layer feed both the route handlers under `/api` and the `/manager` server components; all mutations go through route handlers that zod-validate, authenticate, tenancy-check, then return the typed `{ ok }` envelope. Conflicts are computed at read/validate time, never stored. Publish is a transaction followed by notification fan-out through a driver interface.

**Tech Stack:** Next.js 16.2 App Router / React 19 / TypeScript strict · Prisma 7 + `@prisma/adapter-pg` (client generated at `src/generated/prisma`, import from `"@/generated/prisma/client"`) · PostgreSQL 17 (docker-compose) · `zod@4` · `date-fns@4` + `@date-fns/tz` (installed in Task 1) · vitest (+ @testing-library/react, set up in Phase 1) · design-token CSS Modules, no Tailwind.

## Global Constraints

Copied from the roadmap (`docs/superpowers/plans/2026-07-05-rosterhouse-wiring-roadmap.md`); every task below implicitly includes these.

- Copy rules: sentence case everywhere; 12-hour times ("7:00 AM – 3:00 PM", en dash `–` with spaces, never military); durations as "8 hrs"; no emoji in UI chrome; calm confirmations (no exclamation points); errors specific and actionable ("This shift overlaps with Maria's 2:00 PM – 6:00 PM shift"), never blaming.
- Styling: design tokens only — no raw hex colors, no font-family other than Figtree (`var(--font-sans)`). Hover/press via CSS `:hover`/`:active` classes (CSS Modules), not JS state. Focus states use `--shadow-focus` + brand ring.
- All interactive elements are real `<button>`/`<a>`/`<input>` elements with keyboard focus — never onClick divs (the export's dominant defect).
- Weeks start Monday. `Location.timezone` (IANA) drives all wall-clock rendering; shifts store UTC instants + location-local service `date`.
- Every screen ships loading, empty, and error states.
- Every API handler: zod-validate input → authenticate → tenancy check → act → typed JSON (`{ ok: true, data }` / `{ ok: false, error }`).
- Test-first (vitest) for `src/lib` logic; route handlers get integration tests against the docker Postgres; commit at the end of every task.
- Server code imports prisma from `"@/lib/db"` (`import { prisma } from "@/lib/db"`).
- Design reference (visual only — do NOT carry over its bugs): `"RosterHouse Design System/ui_kits/manager-web/"` (`ScheduleView.jsx`, `WeekGrid.jsx`, `AssignShiftDialog.jsx`, `DashboardScreen.jsx`, `ManagerApp.jsx`). Known bugs you must FIX, not reproduce: dead header "Add shift" button, publish flipping all weeks globally, hardcoded dashboard stats, the "5 vs 10 vs 12 employees notified" copy inconsistency, free-text time entry with no validation, `ANCHOR = new Date(2026, 6, 6)` demo-date model, onClick divs.

## Phase-wide interfaces

**Consumed from Phase 1 (component library, `src/components/ui/<Name>.tsx`, all accept `className?`, spread rest props, forward refs):**

- `Button({ variant?: "primary"|"secondary"|"ghost"|"accent"|"danger"; size?: "sm"|"md"|"lg"; disabled?; icon?; fullWidth?; children?; onClick?; type? })`
- `Badge({ tone?: "success"|"warning"|"danger"|"info"|"neutral"; children? })`
- `Card({ children?; padding?; hoverable?; style? })`
- `Dialog({ open: boolean; onClose?; title?; children?; footer? })` (focus-trapped, closes on Escape)
- `Tabs({ tabs?: {value,label}[]; value?; defaultValue?; onChange?: (value: string) => void })`
- `Select({ label?; value?; onChange?: (value: string) => void; options?: {value,label}[]; placeholder? })`
- `Input({ label?; placeholder?; value?; onChange?: (e) => void; type?; error?; disabled?; icon? })`
- `ShiftBlock({ role: string; time: string; employeeName?: string; status?: "confirmed"|"open"|"conflict"|"draft"; compact?: boolean; conflictReason?: string; onClick? })`
- `WeekGridCell({ children?; empty?: boolean; hasConflict?: boolean; onClick?: () => void; addLabel?: string })` — when `empty` is true the cell renders ITS OWN `<button aria-label={addLabel ?? "Add shift"}>` and ignores `children` (pass `onClick` + `addLabel` to the cell); occupied cells render a plain `<div>` wrapping `children`
- `ConflictChip({ children? })`
- `TimeField({ label: string; value: string; onChange: (value: string) => void; placeholder?: string; error?: string })` — 12-hour text field; renders `error` text below when set
- `Textarea({ label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; rows?: number })`
- `useToast()` from `@/components/ui/Toaster` returning `{ toast(opts: { title: string; description?: string; tone?: "success"|"warning"|"danger"|"info" }): void }`; `ToasterProvider` (same module) already wraps the `/manager` and `(employee)` group layouts (Phase 2 Task 5), so `useToast()` works anywhere in this phase
- `StatCard({ label: string; value: React.ReactNode; tone?: string })` — `tone` is a CSS color token string (e.g. `"var(--status-warning)"`) applied as inline `style={{ color: tone }}`; omit it for the default neutral text color (keywords like `"warning"` are NOT valid values)
- `EmptyState({ title: string; description?: string; action?: React.ReactNode })`
- `Spinner({ size?: number })`
- `DatePager({ label: string; prevHref: string; nextHref: string; todayHref?: string; prevLabel?: string; nextLabel?: string })` from `@/components/chrome/DatePager` — link-based: all three controls are `next/link` anchors (paging is URL state per the roadmap; there are NO `onPrev`/`onNext`/`onToday` callbacks). `prevLabel`/`nextLabel` default to "Previous"/"Next" — pass view-specific labels like "Previous week"

If a Phase 1 primitive's props differ from the above, adapt the **call site** in this phase to the primitive's actual props — do not fork or modify the primitive.

**Consumed from Phase 2:**

- `requireManager(): Promise<SessionUser>` and `auth` from `@/lib/auth` (`SessionUser = { id: string; name: string; role: "manager"|"employee"; organizationId: string }`; session shape is `{ user: SessionUser }`)
- `getManagerLocation(userId: string): Promise<Location>` from `@/lib/authz`
- `jsonOk(data)` / `jsonErr(code, message, status)` from `@/lib/api` (the `{ ok: true, data }` / `{ ok: false, error: { code, message } }` envelope)
- `src/app/manager/layout.tsx` (left-rail chrome + manager guard) already wraps everything under `/manager`
- Seed data (`prisma/seed.ts`, applied via `npx prisma db seed`): org "Harbor & Vine"; location "Downtown" (`America/New_York`, `overtimeHoursPerWeek` 40); positions Line cook / Server / Dishwasher / Host; manager Jamie Park `jamie@harborvine.test` / `rosterhouse1`; 10 active employees incl. Maria Garcia `maria@harborvine.test`; multi-position qualifications; availability rules; current week published + next week draft schedules containing one open shift and one deliberate double-booking; one pending time-off request, one pending swap, one pending claim.

**Test environment facts:** `docker compose up -d` runs Postgres; `.env` has `DATABASE_URL`; Phase 1's vitest config resolves the `@/*` alias and supports `// @vitest-environment jsdom` for component tests, and Phase 1's `vitest.setup.ts` loads `.env` into `process.env` via `import "dotenv/config"` (Vitest does NOT load `.env` by itself). Every DB-backed test file in this phase still starts with a defensive `import "dotenv/config";` because importing `@/lib/db` constructs the Prisma client from `DATABASE_URL` at module load. Run a single file with `npx vitest run <file>`. If integration tests fail because seed state drifted (you clicked around the app), reset with `npx prisma migrate reset --force` (re-applies migrations and seed).

---

### Task 1: Time library (`src/lib/time.ts`)

**Files:**
- Create: `src/lib/time.ts`
- Test: `src/lib/time.test.ts`
- Modify: `src/components/ui/time-field-parse.ts` (Phase 1 handoff — file becomes a re-export of `@/lib/time`)
- Modify: `package.json` (via npm install)

**Interfaces:**
- Consumes: nothing from other tasks (pure library; `date-fns@4`, `@date-fns/tz`). Phase 1 handoff (pinned in Phase 1 Task 9): `parseTime12h` shipped as a local copy at `src/components/ui/time-field-parse.ts`; this task MOVES that exact implementation (same regex — dotted `a.m./p.m.` and no-space `7am` accepted) into `src/lib/time.ts` and replaces the old file's body with a re-export, so exactly one parser ships and Phase 1's tests keep passing against the old path.
- Produces (Tasks 2–10 and Phases 4/5 consume; roadmap contract plus helpers marked NEW):
  ```ts
  export type ISODate = string;                             // "2026-07-06"
  export type TimeOfDay = { hour: number; minute: number }; // 24-hour clock (NEW, named type)
  export type ParsedTime = TimeOfDay;                       // alias so Phase 1's @/components/ui/time-field-parse re-export type-checks
  export const DAY_NAMES_MON0: string[];                    // ["Monday", ... "Sunday"] (NEW)
  weekStartOf(d: Date, timezone: string): ISODate           // Monday of d's week in that tz
  addDaysISO(d: ISODate, n: number): ISODate
  weekDatesOf(weekStart: ISODate): ISODate[]                // 7 entries Mon..Sun
  dayOfWeekMon0(d: ISODate): number                         // 0=Mon..6=Sun (NEW)
  weekStartOfISO(d: ISODate): ISODate                       // Monday of the date's week (NEW)
  parseTime12h(input: string): TimeOfDay | null             // "7:00 AM"/"9:00 a.m."/"7am" → 24h values; null = invalid (Phase 1's exact implementation, moved here)
  localToUtc(date: ISODate, time: TimeOfDay, timezone: string): Date
  shiftInstants(date: ISODate, start: TimeOfDay, end: TimeOfDay, timezone: string): { startsAt: Date; endsAt: Date } // end<=start ⇒ ends next day (NEW)
  localTimeOfDay(instant: Date, timezone: string): TimeOfDay // (NEW)
  localISODate(instant: Date, timezone: string): ISODate     // (NEW)
  toISODate(d: Date): ISODate                                // for Prisma @db.Date values (UTC midnight) (NEW)
  formatTime(instant: Date, timezone: string): string        // "7:00 AM"
  formatTimeHM(hm: string): string                           // "09:00" → "9:00 AM" (NEW; availability windows)
  formatShiftRange(startsAt: Date, endsAt: Date, timezone: string): string // "7:00 AM – 3:00 PM"
  shiftDurationHours(startsAt: Date, endsAt: Date): number   // 8, 7.5
  formatDurationHrs(hours: number): string                   // "8 hrs", "7.5 hrs"
  formatDayLabel(d: ISODate): string                         // "Mon 6"
  formatDateShort(d: ISODate): string                        // "Jul 6" (NEW)
  formatFullDate(d: ISODate): string                         // "Monday, July 6" (NEW)
  ```

- [ ] **Step 1: Install date libraries**

```bash
cd /Users/gary/dev/RosterHouse && npm install date-fns@^4 @date-fns/tz@^1
```

Expected: both appear under `dependencies` in `package.json` (date-fns 4.x, @date-fns/tz 1.x).

- [ ] **Step 2: Write the failing tests**

Create `src/lib/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  DAY_NAMES_MON0,
  dayOfWeekMon0,
  formatDateShort,
  formatDayLabel,
  formatDurationHrs,
  formatFullDate,
  formatShiftRange,
  formatTime,
  formatTimeHM,
  localISODate,
  localTimeOfDay,
  localToUtc,
  parseTime12h,
  shiftDurationHours,
  shiftInstants,
  toISODate,
  weekDatesOf,
  weekStartOf,
  weekStartOfISO,
} from "@/lib/time";

const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";

describe("weekStartOf", () => {
  it("returns the same day for a Monday instant in the location timezone", () => {
    // 2026-07-06T16:00:00Z = Monday July 6, 12:00 PM in New York
    expect(weekStartOf(new Date("2026-07-06T16:00:00Z"), NY)).toBe("2026-07-06");
  });

  it("depends on timezone: one instant, two different weeks", () => {
    // 2026-07-06T02:00:00Z = Sunday July 5, 10:00 PM in New York
    //                      = Monday July 6, 11:00 AM in Tokyo
    const instant = new Date("2026-07-06T02:00:00Z");
    expect(weekStartOf(instant, NY)).toBe("2026-06-29");
    expect(weekStartOf(instant, TOKYO)).toBe("2026-07-06");
  });

  it("maps a Sunday back to the previous Monday (weeks start Monday)", () => {
    // 2026-07-12T16:00:00Z = Sunday July 12 in New York
    expect(weekStartOf(new Date("2026-07-12T16:00:00Z"), NY)).toBe("2026-07-06");
  });
});

describe("ISO date helpers", () => {
  it("addDaysISO crosses month and year boundaries", () => {
    expect(addDaysISO("2026-06-29", 7)).toBe("2026-07-06");
    expect(addDaysISO("2026-07-06", -7)).toBe("2026-06-29");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("weekDatesOf returns 7 consecutive dates starting at the given Monday", () => {
    expect(weekDatesOf("2026-07-06")).toEqual([
      "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09",
      "2026-07-10", "2026-07-11", "2026-07-12",
    ]);
  });

  it("dayOfWeekMon0 maps Monday to 0 and Sunday to 6", () => {
    expect(dayOfWeekMon0("2026-07-06")).toBe(0); // Monday
    expect(dayOfWeekMon0("2026-07-12")).toBe(6); // Sunday
    expect(DAY_NAMES_MON0[dayOfWeekMon0("2026-07-08")]).toBe("Wednesday");
  });

  it("weekStartOfISO finds the Monday of any date", () => {
    expect(weekStartOfISO("2026-07-09")).toBe("2026-07-06");
    expect(weekStartOfISO("2026-07-06")).toBe("2026-07-06");
    expect(weekStartOfISO("2026-07-12")).toBe("2026-07-06");
  });

  it("toISODate formats a UTC-midnight Date (Prisma @db.Date)", () => {
    expect(toISODate(new Date("2026-07-06T00:00:00.000Z"))).toBe("2026-07-06");
  });
});

describe("parseTime12h", () => {
  it("parses standard and shorthand inputs (24-hour output)", () => {
    expect(parseTime12h("7:00 AM")).toEqual({ hour: 7, minute: 0 });
    expect(parseTime12h("7 AM")).toEqual({ hour: 7, minute: 0 });
    expect(parseTime12h("7am")).toEqual({ hour: 7, minute: 0 });          // no space (Phase 1 contract)
    expect(parseTime12h("9:00 a.m.")).toEqual({ hour: 9, minute: 0 });    // dotted meridiem (Phase 1 contract)
    expect(parseTime12h("7:30 pm")).toEqual({ hour: 19, minute: 30 });
    expect(parseTime12h(" 11:15 pm ")).toEqual({ hour: 23, minute: 15 });
  });

  it("handles the 12 o'clock edge cases", () => {
    expect(parseTime12h("12:00 PM")).toEqual({ hour: 12, minute: 0 }); // noon
    expect(parseTime12h("12:00 AM")).toEqual({ hour: 0, minute: 0 });  // midnight
  });

  it("rejects invalid input", () => {
    expect(parseTime12h("13:00 PM")).toBeNull();
    expect(parseTime12h("0:30 AM")).toBeNull();
    expect(parseTime12h("7:60 AM")).toBeNull();
    expect(parseTime12h("700")).toBeNull();
    expect(parseTime12h("7:00")).toBeNull();
    expect(parseTime12h("")).toBeNull();
  });
});

describe("localToUtc / shiftInstants", () => {
  it("converts local wall time to a UTC instant (EDT is UTC-4)", () => {
    expect(localToUtc("2026-07-06", { hour: 7, minute: 0 }, NY).toISOString())
      .toBe("2026-07-06T11:00:00.000Z");
  });

  it("respects winter offsets (EST is UTC-5)", () => {
    expect(localToUtc("2026-01-05", { hour: 7, minute: 0 }, NY).toISOString())
      .toBe("2026-01-05T12:00:00.000Z");
  });

  it("a 5:00 PM – 12:00 AM shift ends the next day", () => {
    const { startsAt, endsAt } = shiftInstants(
      "2026-07-10", { hour: 17, minute: 0 }, { hour: 0, minute: 0 }, NY,
    );
    expect(startsAt.toISOString()).toBe("2026-07-10T21:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-07-11T04:00:00.000Z");
    expect(shiftDurationHours(startsAt, endsAt)).toBe(7);
    expect(formatShiftRange(startsAt, endsAt, NY)).toBe("5:00 PM – 12:00 AM");
  });

  it("spring-forward night: 11:00 PM – 7:00 AM is only 7 real hours", () => {
    // DST starts 2026-03-08 in America/New_York (2:00 AM is skipped)
    const { startsAt, endsAt } = shiftInstants(
      "2026-03-07", { hour: 23, minute: 0 }, { hour: 7, minute: 0 }, NY,
    );
    expect(shiftDurationHours(startsAt, endsAt)).toBe(7);
  });

  it("fall-back night: 11:00 PM – 7:00 AM is 9 real hours", () => {
    // DST ends 2026-11-01 in America/New_York (1:00 AM repeats)
    const { startsAt, endsAt } = shiftInstants(
      "2026-10-31", { hour: 23, minute: 0 }, { hour: 7, minute: 0 }, NY,
    );
    expect(shiftDurationHours(startsAt, endsAt)).toBe(9);
  });
});

describe("formatting", () => {
  it("formatTime renders 12-hour wall clock in the location timezone", () => {
    expect(formatTime(new Date("2026-07-06T11:00:00Z"), NY)).toBe("7:00 AM");
    expect(formatTime(new Date("2026-03-08T12:00:00Z"), NY)).toBe("8:00 AM"); // EDT after spring-forward
  });

  it("formatShiftRange uses an en dash with spaces", () => {
    expect(formatShiftRange(
      new Date("2026-07-06T11:00:00Z"), new Date("2026-07-06T19:00:00Z"), NY,
    )).toBe("7:00 AM – 3:00 PM");
  });

  it("shiftDurationHours handles fractional hours", () => {
    expect(shiftDurationHours(new Date("2026-07-06T11:00:00Z"), new Date("2026-07-06T19:00:00Z"))).toBe(8);
    expect(shiftDurationHours(new Date("2026-07-06T11:00:00Z"), new Date("2026-07-06T18:30:00Z"))).toBe(7.5);
  });

  it("formatDurationHrs", () => {
    expect(formatDurationHrs(8)).toBe("8 hrs");
    expect(formatDurationHrs(7.5)).toBe("7.5 hrs");
  });

  it("formatTimeHM converts availability window strings", () => {
    expect(formatTimeHM("09:00")).toBe("9:00 AM");
    expect(formatTimeHM("15:00")).toBe("3:00 PM");
    expect(formatTimeHM("00:30")).toBe("12:30 AM");
    expect(formatTimeHM("12:00")).toBe("12:00 PM");
  });

  it("date labels", () => {
    expect(formatDayLabel("2026-07-06")).toBe("Mon 6");
    expect(formatDateShort("2026-07-06")).toBe("Jul 6");
    expect(formatFullDate("2026-07-06")).toBe("Monday, July 6");
  });

  it("localTimeOfDay and localISODate read wall-clock values in a timezone", () => {
    const instant = new Date("2026-07-11T02:30:00Z"); // Jul 10, 10:30 PM in New York
    expect(localTimeOfDay(instant, NY)).toEqual({ hour: 22, minute: 30 });
    expect(localISODate(instant, NY)).toBe("2026-07-10");
    expect(localISODate(instant, TOKYO)).toBe("2026-07-11");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/time.test.ts`
Expected: FAIL — `Cannot find module '@/lib/time'` (or equivalent resolution error).

- [ ] **Step 4: Implement `src/lib/time.ts`**

```ts
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export type ISODate = string; // "2026-07-06" (calendar date, no timezone)
export type TimeOfDay = { hour: number; minute: number }; // 24-hour clock
/** Alias kept so Phase 1's @/components/ui/time-field-parse re-export type-checks. */
export type ParsedTime = TimeOfDay;

export const DAY_NAMES_MON0 = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function partsOf(d: ISODate): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
}

/** Monday of the week containing instant `d`, evaluated in `timezone`. */
export function weekStartOf(d: Date, timezone: string): ISODate {
  const local = new TZDate(d.getTime(), timezone);
  const mondayOffset = (local.getDay() + 6) % 7; // Date#getDay: 0=Sun..6=Sat
  const monday = new TZDate(
    local.getFullYear(), local.getMonth(), local.getDate() - mondayOffset, timezone,
  );
  return format(monday, "yyyy-MM-dd");
}

export function addDaysISO(d: ISODate, n: number): ISODate {
  const [y, m, day] = partsOf(d);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}

export function weekDatesOf(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
}

/** 0=Monday .. 6=Sunday — matches AvailabilityRule.dayOfWeek. */
export function dayOfWeekMon0(d: ISODate): number {
  const [y, m, day] = partsOf(d);
  return (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7;
}

export function weekStartOfISO(d: ISODate): ISODate {
  return addDaysISO(d, -dayOfWeekMon0(d));
}

/**
 * Parse a 12-hour time string ("7:00 AM", "7 AM", "7:30 pm", "9:00 a.m.").
 * Returns 24-hour values ({ hour: 0-23 }) or null for anything invalid
 * ("13:00 PM", "7:60 AM", missing AM/PM, empty).
 *
 * This is Phase 1's implementation from src/components/ui/time-field-parse.ts,
 * moved here verbatim per the pinned handoff (dotted a.m./p.m. accepted);
 * that file now re-exports from this module (Step 6).
 */
export function parseTime12h(input: string): TimeOfDay | null {
  const match = /^\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\s*$/i.exec(input);
  if (!match) return null;
  const rawHour = Number(match[1]);
  if (rawHour < 1 || rawHour > 12) return null;
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const isPm = match[3].toLowerCase().startsWith("p");
  let hour = rawHour % 12; // 12 AM → 0; 12 PM → 0 then +12 below
  if (isPm) hour += 12;
  return { hour, minute };
}

export function localToUtc(date: ISODate, time: TimeOfDay, timezone: string): Date {
  const [y, m, day] = partsOf(date);
  const local = new TZDate(y, m - 1, day, time.hour, time.minute, 0, 0, timezone);
  return new Date(local.getTime());
}

/**
 * UTC instants for a shift on service date `date`.
 * End at-or-before start means the shift crosses midnight and ends the next day.
 */
export function shiftInstants(
  date: ISODate, start: TimeOfDay, end: TimeOfDay, timezone: string,
): { startsAt: Date; endsAt: Date } {
  const startsAt = localToUtc(date, start, timezone);
  const crossesMidnight =
    end.hour < start.hour || (end.hour === start.hour && end.minute <= start.minute);
  const endsAt = localToUtc(crossesMidnight ? addDaysISO(date, 1) : date, end, timezone);
  return { startsAt, endsAt };
}

export function localTimeOfDay(instant: Date, timezone: string): TimeOfDay {
  const local = new TZDate(instant.getTime(), timezone);
  return { hour: local.getHours(), minute: local.getMinutes() };
}

export function localISODate(instant: Date, timezone: string): ISODate {
  return format(new TZDate(instant.getTime(), timezone), "yyyy-MM-dd");
}

/** Prisma returns @db.Date columns as UTC-midnight Date objects. */
export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function formatTime(instant: Date, timezone: string): string {
  return format(new TZDate(instant.getTime(), timezone), "h:mm a");
}

/** "09:00" (AvailabilityRule window string) → "9:00 AM". */
export function formatTimeHM(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatShiftRange(startsAt: Date, endsAt: Date, timezone: string): string {
  return `${formatTime(startsAt, timezone)} – ${formatTime(endsAt, timezone)}`;
}

export function shiftDurationHours(startsAt: Date, endsAt: Date): number {
  return Math.round(((endsAt.getTime() - startsAt.getTime()) / 3_600_000) * 100) / 100;
}

export function formatDurationHrs(hours: number): string {
  return `${hours} hrs`;
}

export function formatDayLabel(d: ISODate): string {
  const [y, m, day] = partsOf(d);
  return format(new Date(y, m - 1, day), "EEE d");
}

export function formatDateShort(d: ISODate): string {
  const [y, m, day] = partsOf(d);
  return format(new Date(y, m - 1, day), "MMM d");
}

export function formatFullDate(d: ISODate): string {
  const [y, m, day] = partsOf(d);
  return format(new Date(y, m - 1, day), "EEEE, MMMM d");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/time.test.ts`
Expected: PASS — all tests green (17 tests across 5 describe blocks).

- [ ] **Step 6: Complete the Phase 1 handoff — make `time-field-parse` a re-export**

Phase 1 Task 9 shipped `parseTime12h` as a local copy and pinned this exact move. Replace the ENTIRE contents of `src/components/ui/time-field-parse.ts` with:

```ts
export { parseTime12h, type ParsedTime } from "@/lib/time";
```

No other files change — `TimeField.tsx` and Phase 1's tests keep importing from `@/components/ui/time-field-parse`.

- [ ] **Step 7: Re-run Phase 1's parser and TimeField tests against the re-export**

Run: `npx vitest run src/components/ui/time-field-parse.test.ts src/components/ui/TimeField.test.tsx`
Expected: PASS — all 19 parser cases (including `"9:00 a.m."`) and the TimeField suite stay green, proving exactly one parser implementation ships.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/time.ts src/lib/time.test.ts src/components/ui/time-field-parse.ts
git commit -m "feat: time library with tz-aware week math; move parseTime12h from time-field-parse"
```

---

### Task 2: Conflict detection library (`src/lib/conflicts.ts`)

**Files:**
- Create: `src/lib/conflicts.ts`
- Test: `src/lib/conflicts.test.ts`

**Interfaces:**
- Consumes (Task 1): `dayOfWeekMon0`, `formatDateShort`, `formatShiftRange`, `formatTimeHM`, `localISODate`, `localTimeOfDay`, `shiftDurationHours`, `DAY_NAMES_MON0`, types `ISODate` from `@/lib/time`.
- Produces (Tasks 3/4/5 and Phase 5 consume):
  ```ts
  export type ConflictKind = 'double_booked' | 'outside_availability' | 'overtime';
  export type Conflict = { kind: ConflictKind; message: string };
  export type ProposedShift = {
    shiftId?: string;                 // exclude self when editing
    employeeProfileId: string | null; // null (open shift) → no conflicts
    date: ISODate; startsAt: Date; endsAt: Date;
  };
  export type ConflictContext = {
    timezone: string;
    employeeName: string;
    employeeShifts: { id: string; startsAt: Date; endsAt: Date; positionName: string }[]; // same week
    availability: { dayOfWeek: number; isAvailable: boolean; startTime: string|null; endTime: string|null }[];
    approvedTimeOff: { startDate: ISODate; endDate: ISODate }[];
    overtimeHoursPerWeek: number | null;  // null = OT checks off
  };
  export function detectConflicts(shift: ProposedShift, ctx: ConflictContext): Conflict[];
  ```
  This module is pure (no prisma import) so it can run in unit tests and be type-imported by client components.
- Message copy (pinned; tests assert these exactly):
  - double-booked: `Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift`
  - day off: `Sam Torres isn't available Mondays`
  - partial window: `Sam Torres is only available 9:00 AM – 3:00 PM on Tuesdays`
  - approved time off: `Maria Garcia has approved time off Jul 14 – Jul 16` (single day: `... has approved time off Jul 20`)
  - overtime: `Would put Alex Kim over 40 hrs this week`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/conflicts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectConflicts, type ConflictContext, type ProposedShift } from "@/lib/conflicts";
import { parseTime12h, shiftInstants, type ISODate } from "@/lib/time";

const NY = "America/New_York";

/** Build UTC instants for a shift from 12-hour strings, New York wall clock. */
function instants(date: ISODate, start: string, end: string) {
  return shiftInstants(date, parseTime12h(start)!, parseTime12h(end)!, NY);
}

function proposed(
  date: ISODate, start: string, end: string,
  overrides: Partial<ProposedShift> = {},
): ProposedShift {
  return { employeeProfileId: "ep-1", date, ...instants(date, start, end), ...overrides };
}

function existingShift(
  id: string, date: ISODate, start: string, end: string, positionName: string,
) {
  return { id, positionName, ...instants(date, start, end) };
}

function ctx(overrides: Partial<ConflictContext> = {}): ConflictContext {
  return {
    timezone: NY,
    employeeName: "Maria Garcia",
    employeeShifts: [],
    availability: [],
    approvedTimeOff: [],
    overtimeHoursPerWeek: null,
    ...overrides,
  };
}

describe("open shifts", () => {
  it("null employeeProfileId never conflicts, even with overlapping shifts", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "2:00 PM", "6:00 PM", "Server")] });
    expect(detectConflicts(proposed("2026-07-08", "3:00 PM", "9:00 PM", { employeeProfileId: null }), c)).toEqual([]);
  });
});

describe("double_booked", () => {
  it("flags an overlap with the pinned message copy", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "2:00 PM", "6:00 PM", "Server")] });
    const conflicts = detectConflicts(proposed("2026-07-08", "5:00 PM", "11:00 PM"), c);
    expect(conflicts).toEqual([
      { kind: "double_booked", message: "Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift" },
    ]);
  });

  it("exact-boundary shifts do NOT conflict (3:00 PM end vs 3:00 PM start)", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "7:00 AM", "3:00 PM", "Line cook")] });
    expect(detectConflicts(proposed("2026-07-08", "3:00 PM", "11:00 PM"), c)).toEqual([]);
  });

  it("editing a shift excludes itself from overlap checks", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "2:00 PM", "6:00 PM", "Server")] });
    expect(detectConflicts(proposed("2026-07-08", "2:00 PM", "6:00 PM", { shiftId: "s1" }), c)).toEqual([]);
  });

  it("catches overlaps across midnight (instants, not same-day strings)", () => {
    // Existing Friday 6:00 PM – 2:00 AM crosses into Saturday.
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-10", "6:00 PM", "2:00 AM", "Dishwasher")] });
    const conflicts = detectConflicts(proposed("2026-07-11", "1:00 AM", "9:00 AM"), c);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("double_booked");
  });
});

describe("outside_availability", () => {
  it("day off: pinned message copy", () => {
    const c = ctx({
      employeeName: "Sam Torres",
      availability: [{ dayOfWeek: 0, isAvailable: false, startTime: null, endTime: null }],
    });
    // 2026-07-06 is a Monday
    expect(detectConflicts(proposed("2026-07-06", "9:00 AM", "5:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Sam Torres isn't available Mondays" },
    ]);
  });

  it("partial window: shift ending after the window conflicts", () => {
    const c = ctx({
      employeeName: "Sam Torres",
      availability: [{ dayOfWeek: 1, isAvailable: true, startTime: "09:00", endTime: "15:00" }],
    });
    // 2026-07-07 is a Tuesday; 11:00 AM – 4:00 PM ends after 3:00 PM
    expect(detectConflicts(proposed("2026-07-07", "11:00 AM", "4:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Sam Torres is only available 9:00 AM – 3:00 PM on Tuesdays" },
    ]);
  });

  it("a shift fully inside the window does not conflict", () => {
    const c = ctx({
      availability: [{ dayOfWeek: 1, isAvailable: true, startTime: "09:00", endTime: "15:00" }],
    });
    expect(detectConflicts(proposed("2026-07-07", "9:00 AM", "3:00 PM"), c)).toEqual([]);
  });

  it("a midnight-crossing shift is outside any same-day window", () => {
    const c = ctx({
      availability: [{ dayOfWeek: 1, isAvailable: true, startTime: "09:00", endTime: "23:00" }],
    });
    const conflicts = detectConflicts(proposed("2026-07-07", "5:00 PM", "12:00 AM"), c);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("outside_availability");
  });

  it("no rule for that weekday means available all day", () => {
    const c = ctx({ availability: [{ dayOfWeek: 3, isAvailable: false, startTime: null, endTime: null }] });
    expect(detectConflicts(proposed("2026-07-06", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });
});

describe("approved time off", () => {
  it("renders as outside_availability with the date range", () => {
    const c = ctx({ approvedTimeOff: [{ startDate: "2026-07-14", endDate: "2026-07-16" }] });
    expect(detectConflicts(proposed("2026-07-15", "9:00 AM", "5:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Maria Garcia has approved time off Jul 14 – Jul 16" },
    ]);
  });

  it("single-day time off renders one date", () => {
    const c = ctx({ approvedTimeOff: [{ startDate: "2026-07-20", endDate: "2026-07-20" }] });
    expect(detectConflicts(proposed("2026-07-20", "9:00 AM", "5:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Maria Garcia has approved time off Jul 20" },
    ]);
  });

  it("shifts outside the range are unaffected", () => {
    const c = ctx({ approvedTimeOff: [{ startDate: "2026-07-14", endDate: "2026-07-16" }] });
    expect(detectConflicts(proposed("2026-07-17", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });
});

describe("overtime", () => {
  const fourEightHourShifts = [
    existingShift("s1", "2026-07-06", "7:00 AM", "3:00 PM", "Line cook"),
    existingShift("s2", "2026-07-07", "7:00 AM", "3:00 PM", "Line cook"),
    existingShift("s3", "2026-07-08", "7:00 AM", "3:00 PM", "Line cook"),
    existingShift("s4", "2026-07-09", "7:00 AM", "3:00 PM", "Line cook"),
  ]; // 32 hrs

  it("crossing the threshold mid-week flags with the pinned copy", () => {
    const c = ctx({
      employeeName: "Alex Kim",
      overtimeHoursPerWeek: 40,
      employeeShifts: [
        ...fourEightHourShifts,
        existingShift("s5", "2026-07-10", "7:00 AM", "11:00 AM", "Line cook"), // +4 = 36 hrs
      ],
    });
    // Proposing 8 more hrs → 44 total
    expect(detectConflicts(proposed("2026-07-11", "7:00 AM", "3:00 PM"), c)).toEqual([
      { kind: "overtime", message: "Would put Alex Kim over 40 hrs this week" },
    ]);
  });

  it("landing exactly on the threshold is not overtime", () => {
    const c = ctx({ overtimeHoursPerWeek: 40, employeeShifts: fourEightHourShifts }); // 32 hrs
    expect(detectConflicts(proposed("2026-07-10", "7:00 AM", "3:00 PM"), c)).toEqual([]); // = 40
  });

  it("null threshold disables overtime checks entirely", () => {
    const c = ctx({
      overtimeHoursPerWeek: null,
      employeeShifts: [
        ...fourEightHourShifts,
        existingShift("s5", "2026-07-10", "7:00 AM", "11:00 PM", "Line cook"),
      ],
    });
    expect(detectConflicts(proposed("2026-07-11", "7:00 AM", "3:00 PM"), c)).toEqual([]);
  });

  it("editing excludes the shift's own hours from the running total", () => {
    const c = ctx({
      overtimeHoursPerWeek: 40,
      employeeShifts: [
        ...fourEightHourShifts,
        existingShift("s5", "2026-07-10", "7:00 AM", "3:00 PM", "Line cook"), // 40 total incl. s5
      ],
    });
    // Re-saving s5 unchanged: 32 existing (s5 excluded) + 8 proposed = 40, not over
    expect(detectConflicts(proposed("2026-07-10", "7:00 AM", "3:00 PM", { shiftId: "s5" }), c)).toEqual([]);
  });
});

describe("stacking", () => {
  it("reports multiple kinds at once, double_booked first", () => {
    const c = ctx({
      overtimeHoursPerWeek: 40,
      employeeShifts: [
        existingShift("s1", "2026-07-06", "7:00 AM", "3:00 PM", "Line cook"),
        existingShift("s2", "2026-07-07", "7:00 AM", "11:00 PM", "Line cook"),
        existingShift("s3", "2026-07-08", "7:00 AM", "11:00 PM", "Line cook"),
      ], // 8 + 16 + 16 = 40 hrs
      approvedTimeOff: [{ startDate: "2026-07-06", endDate: "2026-07-06" }],
    });
    const conflicts = detectConflicts(proposed("2026-07-06", "2:00 PM", "6:00 PM"), c);
    expect(conflicts.map((x) => x.kind)).toEqual([
      "double_booked", "outside_availability", "overtime",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/conflicts.test.ts`
Expected: FAIL — `Cannot find module '@/lib/conflicts'`.

- [ ] **Step 3: Implement `src/lib/conflicts.ts`**

```ts
import {
  DAY_NAMES_MON0,
  dayOfWeekMon0,
  formatDateShort,
  formatShiftRange,
  formatTimeHM,
  localISODate,
  localTimeOfDay,
  shiftDurationHours,
  type ISODate,
} from "@/lib/time";

export type ConflictKind = "double_booked" | "outside_availability" | "overtime";

export type Conflict = { kind: ConflictKind; message: string };

export type ProposedShift = {
  shiftId?: string;                 // exclude self when editing
  employeeProfileId: string | null; // null (open shift) → no conflicts
  date: ISODate;
  startsAt: Date;
  endsAt: Date;
};

export type ConflictContext = {
  timezone: string;
  employeeName: string;
  /** All of this employee's shifts in the same week (any position). */
  employeeShifts: { id: string; startsAt: Date; endsAt: Date; positionName: string }[];
  availability: {
    dayOfWeek: number; // 0=Mon..6=Sun
    isAvailable: boolean;
    startTime: string | null; // "09:00" location-local; null = all day
    endTime: string | null;
  }[];
  approvedTimeOff: { startDate: ISODate; endDate: ISODate }[];
  overtimeHoursPerWeek: number | null; // null = OT checks off
};

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Compute conflicts for a proposed shift. Pure — callers assemble the
 * ConflictContext (see buildConflictContext in @/lib/conflict-context).
 * Order: double_booked, then outside_availability (weekly rule, then
 * approved time off), then overtime.
 */
export function detectConflicts(shift: ProposedShift, ctx: ConflictContext): Conflict[] {
  if (shift.employeeProfileId === null) return [];

  const conflicts: Conflict[] = [];
  const otherShifts = ctx.employeeShifts.filter((s) => s.id !== shift.shiftId);

  // 1. Double-booked. Strict inequality: back-to-back shifts
  //    (3:00 PM end vs 3:00 PM start) do not overlap.
  for (const other of otherShifts) {
    if (shift.startsAt < other.endsAt && other.startsAt < shift.endsAt) {
      conflicts.push({
        kind: "double_booked",
        message: `Overlaps ${ctx.employeeName}'s ${formatShiftRange(
          other.startsAt, other.endsAt, ctx.timezone,
        )} ${other.positionName} shift`,
      });
    }
  }

  // 2. Outside availability — weekly rule for the shift's service day.
  //    No rule for that weekday means available all day.
  const dow = dayOfWeekMon0(shift.date);
  const dayName = DAY_NAMES_MON0[dow];
  const rule = ctx.availability.find((r) => r.dayOfWeek === dow);
  if (rule && !rule.isAvailable) {
    conflicts.push({
      kind: "outside_availability",
      message: `${ctx.employeeName} isn't available ${dayName}s`,
    });
  } else if (rule && rule.isAvailable && rule.startTime && rule.endTime) {
    const windowStart = minutesOf(rule.startTime);
    const windowEnd = minutesOf(rule.endTime);
    const start = localTimeOfDay(shift.startsAt, ctx.timezone);
    const startMin = start.hour * 60 + start.minute;
    const crossesMidnight = localISODate(shift.endsAt, ctx.timezone) !== shift.date;
    const end = localTimeOfDay(shift.endsAt, ctx.timezone);
    const endMin = crossesMidnight ? 24 * 60 : end.hour * 60 + end.minute;
    if (startMin < windowStart || endMin > windowEnd) {
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} is only available ${formatTimeHM(rule.startTime)} – ${formatTimeHM(rule.endTime)} on ${dayName}s`,
      });
    }
  }

  // 3. Approved time off (ISODate strings compare lexicographically).
  for (const timeOff of ctx.approvedTimeOff) {
    if (shift.date >= timeOff.startDate && shift.date <= timeOff.endDate) {
      const range =
        timeOff.startDate === timeOff.endDate
          ? formatDateShort(timeOff.startDate)
          : `${formatDateShort(timeOff.startDate)} – ${formatDateShort(timeOff.endDate)}`;
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} has approved time off ${range}`,
      });
    }
  }

  // 4. Overtime — "over" means strictly above the threshold.
  if (ctx.overtimeHoursPerWeek !== null) {
    const existingHours = otherShifts.reduce(
      (sum, s) => sum + shiftDurationHours(s.startsAt, s.endsAt), 0,
    );
    const totalHours = existingHours + shiftDurationHours(shift.startsAt, shift.endsAt);
    if (totalHours > ctx.overtimeHoursPerWeek) {
      conflicts.push({
        kind: "overtime",
        message: `Would put ${ctx.employeeName} over ${ctx.overtimeHoursPerWeek} hrs this week`,
      });
    }
  }

  return conflicts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/conflicts.test.ts`
Expected: PASS — 17 tests green. Also re-run `npx vitest run src/lib/time.test.ts` — still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conflicts.ts src/lib/conflicts.test.ts
git commit -m "feat: pure conflict detection (double-booked, availability, time off, overtime)"
```

---

### Task 3: Prisma-backed conflict context (`src/lib/conflict-context.ts`)

**Files:**
- Create: `src/lib/conflict-context.ts`
- Test: `src/lib/conflict-context.test.ts` (integration — needs docker Postgres + seed)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `ConflictContext` type from `@/lib/conflicts` (Task 2); `addDaysISO`, `toISODate`, `ISODate` from `@/lib/time` (Task 1); seed data (Phase 2).
- Produces (Tasks 4 and Phase 5 consume):
  ```ts
  // src/lib/conflict-context.ts
  export function buildConflictContext(employeeProfileId: string, weekStart: ISODate): Promise<ConflictContext>;
  ```
  NOTE: the roadmap lists this signature under the conflicts contract; it lives in its own file (`@/lib/conflict-context`) so `@/lib/conflicts` stays prisma-free and importable from client code. Signature is unchanged. Phase 5 should import it from `@/lib/conflict-context`.

- [ ] **Step 1: Start Postgres and reseed**

```bash
docker compose up -d && npx prisma db seed
```

Expected: seed completes without error (idempotent; if it fails on unique constraints, run `npx prisma migrate reset --force` instead — it re-applies migrations and the seed).

- [ ] **Step 2: Write the failing integration test**

Create `src/lib/conflict-context.test.ts`:

```ts
import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildConflictContext } from "@/lib/conflict-context";
import { addDaysISO, weekStartOf, type ISODate } from "@/lib/time";

let mariaProfileId: string;
let locationId: string;
let timezone: string;
let farWeek: ISODate; // 3 weeks out — no seed data there, so this test owns it
let createdShiftId: string | null = null;
let createdTimeOffId: string | null = null;

beforeAll(async () => {
  const maria = await prisma.user.findUnique({ where: { email: "maria@harborvine.test" } });
  if (!maria) throw new Error("Seed data missing. Run: npx prisma db seed");
  const profile = await prisma.employeeProfile.findFirstOrThrow({
    where: { userId: maria.id },
    include: { location: true },
  });
  mariaProfileId = profile.id;
  locationId = profile.locationId;
  timezone = profile.location.timezone;
  farWeek = addDaysISO(weekStartOf(new Date(), timezone), 21);
});

afterAll(async () => {
  if (createdShiftId) await prisma.shift.delete({ where: { id: createdShiftId } });
  if (createdTimeOffId) await prisma.timeOffRequest.delete({ where: { id: createdTimeOffId } });
  await prisma.schedule.deleteMany({
    where: { locationId, weekStartDate: new Date(farWeek) },
  });
});

describe("buildConflictContext", () => {
  it("loads profile facts from the seed", async () => {
    const ctx = await buildConflictContext(mariaProfileId, farWeek);
    expect(ctx.employeeName).toBe("Maria Garcia");
    expect(ctx.timezone).toBe("America/New_York");
    expect(ctx.overtimeHoursPerWeek).toBe(40);
    expect(ctx.availability.length).toBeGreaterThan(0);
    for (const rule of ctx.availability) {
      expect(rule.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(rule.dayOfWeek).toBeLessThanOrEqual(6);
    }
  });

  it("scopes shifts and time off to the requested week", async () => {
    // Create a shift and an approved time off in the far week, then verify
    // they appear there and NOT in the current week's context.
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const schedule = await prisma.schedule.upsert({
      where: { locationId_weekStartDate: { locationId, weekStartDate: new Date(farWeek) } },
      create: { locationId, weekStartDate: new Date(farWeek) },
      update: {},
    });
    const shiftDate = addDaysISO(farWeek, 2);
    const shift = await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        locationId,
        positionId: position.id,
        employeeProfileId: mariaProfileId,
        date: new Date(shiftDate),
        startsAt: new Date(`${shiftDate}T15:00:00Z`),
        endsAt: new Date(`${shiftDate}T23:00:00Z`),
      },
    });
    createdShiftId = shift.id;
    const timeOff = await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: mariaProfileId,
        startDate: new Date(addDaysISO(farWeek, 4)),
        endDate: new Date(addDaysISO(farWeek, 5)),
        reason: "vacation",
        status: "approved",
      },
    });
    createdTimeOffId = timeOff.id;

    const farCtx = await buildConflictContext(mariaProfileId, farWeek);
    expect(farCtx.employeeShifts.map((s) => s.id)).toContain(shift.id);
    expect(farCtx.employeeShifts.find((s) => s.id === shift.id)?.positionName).toBe(position.name);
    expect(farCtx.approvedTimeOff).toContainEqual({
      startDate: addDaysISO(farWeek, 4),
      endDate: addDaysISO(farWeek, 5),
    });

    const currentCtx = await buildConflictContext(mariaProfileId, weekStartOf(new Date(), timezone));
    expect(currentCtx.employeeShifts.map((s) => s.id)).not.toContain(shift.id);
    expect(currentCtx.approvedTimeOff).not.toContainEqual({
      startDate: addDaysISO(farWeek, 4),
      endDate: addDaysISO(farWeek, 5),
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/conflict-context.test.ts`
Expected: FAIL — `Cannot find module '@/lib/conflict-context'`.

- [ ] **Step 4: Implement `src/lib/conflict-context.ts`**

```ts
import { prisma } from "@/lib/db";
import type { ConflictContext } from "@/lib/conflicts";
import { addDaysISO, toISODate, type ISODate } from "@/lib/time";

/**
 * Assemble everything detectConflicts needs for one employee and one week
 * (weekStart = Monday, ISODate). Pending time off is ignored — only
 * approved requests block scheduling.
 */
export async function buildConflictContext(
  employeeProfileId: string,
  weekStart: ISODate,
): Promise<ConflictContext> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { user: true, location: true, availability: true },
  });
  const weekEnd = addDaysISO(weekStart, 6);

  const [shifts, timeOff] = await Promise.all([
    prisma.shift.findMany({
      where: {
        employeeProfileId,
        date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
      },
      include: { position: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        employeeProfileId,
        status: "approved",
        startDate: { lte: new Date(weekEnd) },
        endDate: { gte: new Date(weekStart) },
      },
    }),
  ]);

  return {
    timezone: profile.location.timezone,
    employeeName: profile.user.name,
    employeeShifts: shifts.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      positionName: s.position.name,
    })),
    availability: profile.availability.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      isAvailable: r.isAvailable,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    approvedTimeOff: timeOff.map((t) => ({
      startDate: toISODate(t.startDate),
      endDate: toISODate(t.endDate),
    })),
    overtimeHoursPerWeek: profile.location.overtimeHoursPerWeek,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/conflict-context.test.ts`
Expected: PASS — 2 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/conflict-context.ts src/lib/conflict-context.test.ts
git commit -m "feat: prisma-backed conflict context builder"
```

---

### Task 4: Schedule data layer + shift CRUD API

**Files:**
- Create: `src/lib/manager-guard.ts`
- Create: `src/lib/shift-schemas.ts`
- Create: `src/lib/schedule-data.ts`
- Create: `src/app/api/locations/[locationId]/schedule/route.ts`
- Create: `src/app/api/locations/[locationId]/shifts/route.ts`
- Create: `src/app/api/shifts/route.ts`
- Create: `src/app/api/shifts/[shiftId]/route.ts`
- Create: `src/app/api/shifts/validate/route.ts`
- Test: `src/tests/shifts-api.test.ts` (integration — docker Postgres + seed)

**Interfaces:**
- Consumes: Task 1 time helpers; Task 2 `detectConflicts` + types; Task 3 `buildConflictContext`; Phase 2 `auth` (`@/lib/auth`), `getManagerLocation` (`@/lib/authz`), `jsonOk`/`jsonErr` (`@/lib/api`); `prisma` (`@/lib/db`); `Prisma`, `Location` types from `@/generated/prisma/client`.
- Produces (Tasks 5–10 and Phases 4/5 consume):
  ```ts
  // src/lib/manager-guard.ts
  export type ManagerGuard =
    | { ok: true; userId: string; location: Location }
    | { ok: false; status: number; code: string; message: string };
  export function requireManagerForApi(): Promise<ManagerGuard>;

  // src/lib/schedule-data.ts
  export type ScheduleShift = {
    id: string; positionId: string; positionName: string;
    employeeProfileId: string | null; employeeName: string | null;
    date: ISODate; startsAt: string; endsAt: string;  // instants as UTC ISO strings (JSON-safe)
    timeRange: string;                                 // "7:00 AM – 3:00 PM"
    status: "draft" | "published"; notes: string | null;
    uiStatus: "draft" | "confirmed" | "open" | "conflict";
    conflicts: Conflict[];
  };
  export type ScheduleWeekData = {
    schedule: { id: string; status: "draft" | "published"; publishedAt: string | null; hasUnpublishedChanges: boolean };
    weekStart: ISODate;
    positions: { id: string; name: string }[];
    shifts: ScheduleShift[];
    conflictCount: number;           // shifts with uiStatus "conflict"
    assignedEmployeeCount: number;   // distinct employees on this week's shifts
  };
  export type EmployeeOption = {
    employeeProfileId: string; name: string;
    positionIds: string[];           // qualifications (EmployeePosition join)
    availabilityByDay: string[];     // 7 entries Mon..Sun: "9:00 AM – 3:00 PM" | "All day" | "Off"
  };
  export function getOrCreateSchedule(locationId: string, weekStart: ISODate): Promise<Schedule>;
  export function getScheduleWeekData(locationId: string, weekStart: ISODate): Promise<ScheduleWeekData>;
  export function toScheduleShift(shift: ShiftWithJoins, timezone: string): Promise<ScheduleShift>; // ShiftWithJoins = Prisma.ShiftGetPayload<{ include: { position: true; employeeProfile: { include: { user: true } } } }>
  export function getMonthShiftCounts(locationId: string, from: ISODate, to: ISODate): Promise<Record<ISODate, number>>;
  export function getAssignableEmployees(locationId: string): Promise<EmployeeOption[]>;
  ```
- API endpoints produced (all return the `{ ok }` envelope; all manager-only; creating/editing NEVER blocks on conflicts — conflicts come back in the response for the UI to warn):
  - `GET /api/locations/[locationId]/schedule?weekStart=YYYY-MM-DD` → `ScheduleWeekData` (lazily creates the draft Schedule row; 400 if weekStart missing/not a Monday)
  - `POST /api/shifts` body `{ locationId, positionId, employeeProfileId: string|null, date, startTime: "h:mm AM/PM", endTime, notes? }` → `{ shift: ScheduleShift }`
  - `PATCH /api/shifts/[shiftId]` body: any subset of `{ positionId, employeeProfileId, date, startTime, endTime, notes }` → `{ shift: ScheduleShift }` (moving `date` to another week re-parents the shift to that week's schedule)
  - `DELETE /api/shifts/[shiftId]` → `{ deleted: true }`
  - `POST /api/shifts/validate` body = POST body + optional `shiftId` (exclude self when editing) → `{ conflicts: Conflict[] }`, no writes
  - `GET /api/locations/[locationId]/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD` → `{ counts: Record<ISODate, number> }` (month view; range ≤ 62 days)

- [ ] **Step 1: Write the failing integration tests**

Create `src/tests/shifts-api.test.ts`:

```ts
import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Route handlers read the session via auth() from @/lib/auth; mock the whole
// module so tests control who is signed in without running Auth.js.
const mockSession = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession.current),
}));

import { prisma } from "@/lib/db";
import { addDaysISO, formatTime, toISODate, weekStartOf, weekStartOfISO } from "@/lib/time";
import { GET as getSchedule } from "@/app/api/locations/[locationId]/schedule/route";
import { GET as getShiftCounts } from "@/app/api/locations/[locationId]/shifts/route";
import { POST as createShift } from "@/app/api/shifts/route";
import { DELETE as deleteShift, PATCH as patchShift } from "@/app/api/shifts/[shiftId]/route";
import { POST as validateShift } from "@/app/api/shifts/validate/route";

const NY = "America/New_York";
let locationId: string;
let timezone: string;
const createdShiftIds: string[] = [];
const createdWeekStarts: string[] = [];

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const jamie = await prisma.user.findUnique({ where: { email: "jamie@harborvine.test" } });
  if (!jamie) throw new Error("Seed data missing. Run: npx prisma db seed");
  mockSession.current = {
    user: { id: jamie.id, name: jamie.name, role: "manager", organizationId: jamie.organizationId },
  };
  const location = await prisma.location.findFirstOrThrow({
    where: { organizationId: jamie.organizationId },
  });
  locationId = location.id;
  timezone = location.timezone;
});

afterAll(async () => {
  await prisma.shift.deleteMany({ where: { id: { in: createdShiftIds } } });
  await prisma.schedule.deleteMany({
    where: { locationId, weekStartDate: { in: createdWeekStarts.map((w) => new Date(w)) } },
  });
});

describe("GET /api/locations/[locationId]/schedule", () => {
  it("returns 401 when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await getSchedule(
      new Request(`http://test/api/locations/${locationId}/schedule?weekStart=2026-07-06`),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(401);
    expect((await res.json()).ok).toBe(false);
    mockSession.current = saved;
  });

  it("rejects a weekStart that is not a Monday", async () => {
    const res = await getSchedule(
      new Request(`http://test/api/locations/${locationId}/schedule?weekStart=2026-07-08`),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });

  it("lazily creates a draft schedule for an untouched week", async () => {
    const farWeek = addDaysISO(weekStartOf(new Date(), NY), 7 * 40);
    createdWeekStarts.push(farWeek);
    const res = await getSchedule(
      new Request(`http://test/api/locations/${locationId}/schedule?weekStart=${farWeek}`),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.schedule.status).toBe("draft");
    expect(body.data.schedule.hasUnpublishedChanges).toBe(false);
    expect(body.data.shifts).toEqual([]);
    expect(body.data.conflictCount).toBe(0);
    expect(body.data.positions.length).toBeGreaterThan(0);
  });

  it("annotates the seeded open shift and double-booking", async () => {
    const currentWeek = weekStartOf(new Date(), NY);
    const shifts: { uiStatus: string; conflicts: { kind: string }[] }[] = [];
    for (const week of [currentWeek, addDaysISO(currentWeek, 7)]) {
      const res = await getSchedule(
        new Request(`http://test/api/locations/${locationId}/schedule?weekStart=${week}`),
        { params: Promise.resolve({ locationId }) },
      );
      const body = await res.json();
      expect(body.ok).toBe(true);
      shifts.push(...body.data.shifts);
    }
    expect(shifts.some((s) => s.uiStatus === "open")).toBe(true);
    const conflicted = shifts.filter((s) => s.uiStatus === "conflict");
    expect(conflicted.length).toBeGreaterThan(0);
    expect(
      conflicted.some((s) => s.conflicts.some((c) => c.kind === "double_booked")),
    ).toBe(true);
  });
});

describe("POST /api/shifts", () => {
  it("warns about a double-booking but still saves (warn, not block)", async () => {
    // Duplicate any seeded assigned shift exactly — guaranteed overlap.
    const existing = await prisma.shift.findFirstOrThrow({
      where: { locationId, employeeProfileId: { not: null } },
    });
    const res = await createShift(
      jsonRequest("http://test/api/shifts", "POST", {
        locationId,
        positionId: existing.positionId,
        employeeProfileId: existing.employeeProfileId,
        date: toISODate(existing.date),
        startTime: formatTime(existing.startsAt, timezone),
        endTime: formatTime(existing.endsAt, timezone),
        notes: "Bring your own knife kit.",
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    createdShiftIds.push(body.data.shift.id);
    expect(body.data.shift.uiStatus).toBe("conflict");
    expect(body.data.shift.conflicts.some((c: { kind: string }) => c.kind === "double_booked")).toBe(true);
    expect(body.data.shift.notes).toBe("Bring your own knife kit.");
    expect(body.data.shift.status).toBe("draft"); // new shifts are always drafts
  });

  it("rejects an invalid time with specific copy", async () => {
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const res = await createShift(
      jsonRequest("http://test/api/shifts", "POST", {
        locationId,
        positionId: position.id,
        employeeProfileId: null,
        date: "2026-07-06",
        startTime: "13:00 PM",
        endTime: "5:00 PM",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("Enter a time like 7:00 AM");
  });
});

describe("POST /api/shifts/validate", () => {
  it("reports conflicts without writing anything", async () => {
    const existing = await prisma.shift.findFirstOrThrow({
      where: { locationId, employeeProfileId: { not: null } },
    });
    const before = await prisma.shift.count();
    const res = await validateShift(
      jsonRequest("http://test/api/shifts/validate", "POST", {
        locationId,
        positionId: existing.positionId,
        employeeProfileId: existing.employeeProfileId,
        date: toISODate(existing.date),
        startTime: formatTime(existing.startsAt, timezone),
        endTime: formatTime(existing.endsAt, timezone),
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.conflicts.some((c: { kind: string }) => c.kind === "double_booked")).toBe(true);
    expect(await prisma.shift.count()).toBe(before);
  });

  it("returns no conflicts for an open shift", async () => {
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const res = await validateShift(
      jsonRequest("http://test/api/shifts/validate", "POST", {
        locationId,
        positionId: position.id,
        employeeProfileId: null,
        date: "2026-07-06",
        startTime: "9:00 AM",
        endTime: "5:00 PM",
      }),
    );
    expect((await res.json()).data.conflicts).toEqual([]);
  });
});

describe("PATCH + DELETE /api/shifts/[shiftId]", () => {
  it("updates times, then deletes", async () => {
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const farDate = addDaysISO(weekStartOf(new Date(), NY), 7 * 41);
    createdWeekStarts.push(weekStartOfISO(farDate));
    const createRes = await createShift(
      jsonRequest("http://test/api/shifts", "POST", {
        locationId,
        positionId: position.id,
        employeeProfileId: null,
        date: farDate,
        startTime: "9:00 AM",
        endTime: "5:00 PM",
      }),
    );
    const created = (await createRes.json()).data.shift;
    expect(created.uiStatus).toBe("open");
    expect(created.timeRange).toBe("9:00 AM – 5:00 PM");

    const patchRes = await patchShift(
      jsonRequest(`http://test/api/shifts/${created.id}`, "PATCH", {
        startTime: "10:00 AM",
        endTime: "6:00 PM",
      }),
      { params: Promise.resolve({ shiftId: created.id }) },
    );
    const patched = (await patchRes.json()).data.shift;
    expect(patched.timeRange).toBe("10:00 AM – 6:00 PM");

    const delRes = await deleteShift(
      new Request(`http://test/api/shifts/${created.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ shiftId: created.id }) },
    );
    expect((await delRes.json()).data.deleted).toBe(true);
    expect(await prisma.shift.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("404s with calm copy for a shift that does not exist", async () => {
    const res = await patchShift(
      jsonRequest("http://test/api/shifts/nope", "PATCH", { startTime: "9:00 AM" }),
      { params: Promise.resolve({ shiftId: "nope" }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("That shift no longer exists");
  });
});

describe("GET /api/locations/[locationId]/shifts (month counts)", () => {
  it("returns per-day counts for a range", async () => {
    const currentWeek = weekStartOf(new Date(), NY);
    const res = await getShiftCounts(
      new Request(
        `http://test/api/locations/${locationId}/shifts?from=${currentWeek}&to=${addDaysISO(currentWeek, 13)}`,
      ),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    const totals = Object.values(body.data.counts as Record<string, number>);
    expect(totals.length).toBeGreaterThan(0); // seed has shifts in these two weeks
    for (const n of totals) expect(n).toBeGreaterThan(0);
  });

  it("rejects a range longer than 62 days", async () => {
    const res = await getShiftCounts(
      new Request(`http://test/api/locations/${locationId}/shifts?from=2026-01-01&to=2026-06-01`),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/shifts-api.test.ts`
Expected: FAIL — cannot resolve `@/lib/manager-guard` / route modules.

- [ ] **Step 3: Implement `src/lib/manager-guard.ts`**

```ts
import type { Location } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";

export type ManagerGuard =
  | { ok: true; userId: string; location: Location }
  | { ok: false; status: number; code: string; message: string };

/**
 * API-side manager check. Unlike requireManager() (which redirects, for
 * pages), this returns a result the route handler turns into jsonErr.
 */
export async function requireManagerForApi(): Promise<ManagerGuard> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, code: "unauthorized", message: "Sign in to continue" };
  }
  if (session.user.role !== "manager") {
    return { ok: false, status: 403, code: "forbidden", message: "Only managers can manage schedules" };
  }
  const location = await getManagerLocation(session.user.id);
  return { ok: true, userId: session.user.id, location };
}
```

- [ ] **Step 4: Implement `src/lib/shift-schemas.ts`**

```ts
import { z } from "zod";
import { parseTime12h } from "@/lib/time";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use a date like 2026-07-06" });

export const time12hSchema = z
  .string()
  .refine((value) => parseTime12h(value) !== null, { message: "Enter a time like 7:00 AM" });

export const createShiftSchema = z.object({
  locationId: z.string().min(1),
  positionId: z.string().min(1),
  employeeProfileId: z.string().min(1).nullable(),
  date: isoDateSchema,
  startTime: time12hSchema,
  endTime: time12hSchema,
  notes: z.string().max(500).optional(),
});

export const updateShiftSchema = z.object({
  positionId: z.string().min(1).optional(),
  employeeProfileId: z.string().min(1).nullable().optional(),
  date: isoDateSchema.optional(),
  startTime: time12hSchema.optional(),
  endTime: time12hSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const validateShiftSchema = createShiftSchema.extend({
  shiftId: z.string().min(1).optional(),
});
```

- [ ] **Step 5: Implement `src/lib/schedule-data.ts`**

```ts
import { Prisma } from "@/generated/prisma/client";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import {
  formatShiftRange,
  formatTimeHM,
  toISODate,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";

export type ShiftWithJoins = Prisma.ShiftGetPayload<{
  include: { position: true; employeeProfile: { include: { user: true } } };
}>;

export type ScheduleShift = {
  id: string;
  positionId: string;
  positionName: string;
  employeeProfileId: string | null;
  employeeName: string | null;
  date: ISODate;
  startsAt: string; // UTC ISO instant (JSON-safe)
  endsAt: string;
  timeRange: string; // "7:00 AM – 3:00 PM"
  status: "draft" | "published";
  notes: string | null;
  uiStatus: "draft" | "confirmed" | "open" | "conflict";
  conflicts: Conflict[];
};

export type ScheduleWeekData = {
  schedule: {
    id: string;
    status: "draft" | "published";
    publishedAt: string | null;
    hasUnpublishedChanges: boolean;
  };
  weekStart: ISODate;
  positions: { id: string; name: string }[];
  shifts: ScheduleShift[];
  conflictCount: number;
  assignedEmployeeCount: number;
};

export type EmployeeOption = {
  employeeProfileId: string;
  name: string;
  positionIds: string[];
  availabilityByDay: string[]; // 7 entries Mon..Sun
};

export function getOrCreateSchedule(locationId: string, weekStart: ISODate) {
  return prisma.schedule.upsert({
    where: { locationId_weekStartDate: { locationId, weekStartDate: new Date(weekStart) } },
    create: { locationId, weekStartDate: new Date(weekStart) },
    update: {},
  });
}

function shapeShift(shift: ShiftWithJoins, conflicts: Conflict[], timezone: string): ScheduleShift {
  const uiStatus: ScheduleShift["uiStatus"] =
    shift.employeeProfileId === null
      ? "open"
      : conflicts.length > 0
        ? "conflict"
        : shift.status === "published"
          ? "confirmed"
          : "draft";
  return {
    id: shift.id,
    positionId: shift.positionId,
    positionName: shift.position.name,
    employeeProfileId: shift.employeeProfileId,
    employeeName: shift.employeeProfile?.user.name ?? null,
    date: toISODate(shift.date),
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    timeRange: formatShiftRange(shift.startsAt, shift.endsAt, timezone),
    status: shift.status,
    notes: shift.notes,
    uiStatus,
    conflicts,
  };
}

/** Annotate a single shift (used by the POST/PATCH responses). */
export async function toScheduleShift(shift: ShiftWithJoins, timezone: string): Promise<ScheduleShift> {
  let conflicts: Conflict[] = [];
  if (shift.employeeProfileId !== null) {
    const date = toISODate(shift.date);
    const ctx = await buildConflictContext(shift.employeeProfileId, weekStartOfISO(date));
    conflicts = detectConflicts(
      {
        shiftId: shift.id,
        employeeProfileId: shift.employeeProfileId,
        date,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      },
      ctx,
    );
  }
  return shapeShift(shift, conflicts, timezone);
}

export async function getScheduleWeekData(
  locationId: string,
  weekStart: ISODate,
): Promise<ScheduleWeekData> {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const schedule = await getOrCreateSchedule(locationId, weekStart);
  const [positions, shifts] = await Promise.all([
    prisma.position.findMany({ where: { locationId }, orderBy: { sortOrder: "asc" } }),
    prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      include: { position: true, employeeProfile: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  // One conflict context per distinct employee, reused across their shifts.
  const employeeIds = [
    ...new Set(
      shifts.map((s) => s.employeeProfileId).filter((id): id is string => id !== null),
    ),
  ];
  const contexts = new Map(
    await Promise.all(
      employeeIds.map(async (id) => [id, await buildConflictContext(id, weekStart)] as const),
    ),
  );

  const annotated = shifts.map((s) => {
    const conflicts = s.employeeProfileId
      ? detectConflicts(
          {
            shiftId: s.id,
            employeeProfileId: s.employeeProfileId,
            date: toISODate(s.date),
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          },
          contexts.get(s.employeeProfileId)!,
        )
      : [];
    return shapeShift(s, conflicts, location.timezone);
  });

  // Republish detection: a published schedule has unpublished changes when a
  // shift is still draft (added after publish) or edited after publishedAt.
  const hasUnpublishedChanges =
    schedule.status === "published" &&
    shifts.some(
      (s) =>
        s.status === "draft" ||
        (schedule.publishedAt !== null && s.updatedAt > schedule.publishedAt),
    );

  return {
    schedule: {
      id: schedule.id,
      status: schedule.status,
      publishedAt: schedule.publishedAt?.toISOString() ?? null,
      hasUnpublishedChanges,
    },
    weekStart,
    positions: positions.map((p) => ({ id: p.id, name: p.name })),
    shifts: annotated,
    conflictCount: annotated.filter((s) => s.uiStatus === "conflict").length,
    assignedEmployeeCount: employeeIds.length,
  };
}

export async function getMonthShiftCounts(
  locationId: string,
  from: ISODate,
  to: ISODate,
): Promise<Record<ISODate, number>> {
  const shifts = await prisma.shift.findMany({
    where: { locationId, date: { gte: new Date(from), lte: new Date(to) } },
    select: { date: true },
  });
  const counts: Record<ISODate, number> = {};
  for (const s of shifts) {
    const key = toISODate(s.date);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function getAssignableEmployees(locationId: string): Promise<EmployeeOption[]> {
  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId, status: "active" },
    include: { user: true, positions: true, availability: true },
    orderBy: { user: { name: "asc" } },
  });
  return profiles.map((p) => ({
    employeeProfileId: p.id,
    name: p.user.name,
    positionIds: p.positions.map((ep) => ep.positionId),
    availabilityByDay: Array.from({ length: 7 }, (_, dow) => {
      const rule = p.availability.find((r) => r.dayOfWeek === dow);
      if (!rule) return "All day";
      if (!rule.isAvailable) return "Off";
      if (rule.startTime && rule.endTime) {
        return `${formatTimeHM(rule.startTime)} – ${formatTimeHM(rule.endTime)}`;
      }
      return "All day";
    }),
  }));
}
```

- [ ] **Step 6: Implement `src/app/api/locations/[locationId]/schedule/route.ts`**

```ts
import { jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getScheduleWeekData } from "@/lib/schedule-data";
import { isoDateSchema } from "@/lib/shift-schemas";
import { dayOfWeekMon0 } from "@/lib/time";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
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
  return jsonOk(await getScheduleWeekData(locationId, parsed.data));
}
```

- [ ] **Step 7: Implement `src/app/api/shifts/route.ts`**

```ts
import { jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getOrCreateSchedule, toScheduleShift } from "@/lib/schedule-data";
import { createShiftSchema } from "@/lib/shift-schemas";
import { parseTime12h, shiftInstants, weekStartOfISO } from "@/lib/time";

export async function POST(req: Request) {
  const guard = await requireManagerForApi();
  if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr("invalid_input", "Request body must be JSON", 400);
  }
  const parsed = createShiftSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const input = parsed.data;

  if (guard.location.id !== input.locationId) {
    return jsonErr("forbidden", "You don't have access to this location", 403);
  }
  const position = await prisma.position.findFirst({
    where: { id: input.positionId, locationId: input.locationId },
  });
  if (!position) {
    return jsonErr("not_found", "That position doesn't exist at this location", 404);
  }
  if (input.employeeProfileId !== null) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: input.employeeProfileId, locationId: input.locationId },
    });
    if (!profile) {
      return jsonErr("not_found", "That employee isn't on this location's team", 404);
    }
  }

  const { startsAt, endsAt } = shiftInstants(
    input.date,
    parseTime12h(input.startTime)!, // schema already validated both times
    parseTime12h(input.endTime)!,
    guard.location.timezone,
  );
  const schedule = await getOrCreateSchedule(input.locationId, weekStartOfISO(input.date));
  const created = await prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      locationId: input.locationId,
      positionId: input.positionId,
      employeeProfileId: input.employeeProfileId,
      date: new Date(input.date),
      startsAt,
      endsAt,
      notes: input.notes ?? null,
      // status defaults to draft — on a published week this marks
      // "unpublished changes" until the manager republishes.
    },
    include: { position: true, employeeProfile: { include: { user: true } } },
  });
  // Conflicts are returned for the UI to warn — creation is never blocked.
  return jsonOk({ shift: await toScheduleShift(created, guard.location.timezone) });
}
```

- [ ] **Step 8: Implement `src/app/api/shifts/[shiftId]/route.ts`**

```ts
import { jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getOrCreateSchedule, toScheduleShift } from "@/lib/schedule-data";
import { updateShiftSchema } from "@/lib/shift-schemas";
import {
  localTimeOfDay,
  parseTime12h,
  shiftInstants,
  toISODate,
  weekStartOfISO,
} from "@/lib/time";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  const guard = await requireManagerForApi();
  if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
  const { shiftId } = await params;
  const existing = await prisma.shift.findFirst({
    where: { id: shiftId, locationId: guard.location.id },
  });
  if (!existing) return jsonErr("not_found", "That shift no longer exists", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr("invalid_input", "Request body must be JSON", 400);
  }
  const parsed = updateShiftSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const input = parsed.data;
  const timezone = guard.location.timezone;

  if (input.positionId !== undefined) {
    const position = await prisma.position.findFirst({
      where: { id: input.positionId, locationId: existing.locationId },
    });
    if (!position) {
      return jsonErr("not_found", "That position doesn't exist at this location", 404);
    }
  }
  if (input.employeeProfileId !== undefined && input.employeeProfileId !== null) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: input.employeeProfileId, locationId: existing.locationId },
    });
    if (!profile) {
      return jsonErr("not_found", "That employee isn't on this location's team", 404);
    }
  }

  const date = input.date ?? toISODate(existing.date);
  let { startsAt, endsAt } = existing;
  if (input.date !== undefined || input.startTime !== undefined || input.endTime !== undefined) {
    const start = input.startTime
      ? parseTime12h(input.startTime)!
      : localTimeOfDay(existing.startsAt, timezone);
    const end = input.endTime
      ? parseTime12h(input.endTime)!
      : localTimeOfDay(existing.endsAt, timezone);
    ({ startsAt, endsAt } = shiftInstants(date, start, end, timezone));
  }

  // Moving the date across weeks re-parents the shift to that week's schedule.
  const schedule = await getOrCreateSchedule(existing.locationId, weekStartOfISO(date));

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      scheduleId: schedule.id,
      positionId: input.positionId ?? existing.positionId,
      employeeProfileId:
        input.employeeProfileId === undefined ? existing.employeeProfileId : input.employeeProfileId,
      date: new Date(date),
      startsAt,
      endsAt,
      notes: input.notes === undefined ? existing.notes : input.notes,
    },
    include: { position: true, employeeProfile: { include: { user: true } } },
  });
  return jsonOk({ shift: await toScheduleShift(updated, timezone) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  const guard = await requireManagerForApi();
  if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
  const { shiftId } = await params;
  const existing = await prisma.shift.findFirst({
    where: { id: shiftId, locationId: guard.location.id },
  });
  if (!existing) return jsonErr("not_found", "That shift no longer exists", 404);
  await prisma.shift.delete({ where: { id: shiftId } });
  return jsonOk({ deleted: true });
}
```

- [ ] **Step 9: Implement `src/app/api/shifts/validate/route.ts`**

```ts
import { jsonErr, jsonOk } from "@/lib/api";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts } from "@/lib/conflicts";
import { requireManagerForApi } from "@/lib/manager-guard";
import { validateShiftSchema } from "@/lib/shift-schemas";
import { parseTime12h, shiftInstants, weekStartOfISO } from "@/lib/time";

/** Dry run for the assign dialog's live warnings. Never writes. */
export async function POST(req: Request) {
  const guard = await requireManagerForApi();
  if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr("invalid_input", "Request body must be JSON", 400);
  }
  const parsed = validateShiftSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const input = parsed.data;
  if (guard.location.id !== input.locationId) {
    return jsonErr("forbidden", "You don't have access to this location", 403);
  }
  if (input.employeeProfileId === null) return jsonOk({ conflicts: [] });

  const { startsAt, endsAt } = shiftInstants(
    input.date,
    parseTime12h(input.startTime)!,
    parseTime12h(input.endTime)!,
    guard.location.timezone,
  );
  const ctx = await buildConflictContext(input.employeeProfileId, weekStartOfISO(input.date));
  const conflicts = detectConflicts(
    {
      shiftId: input.shiftId,
      employeeProfileId: input.employeeProfileId,
      date: input.date,
      startsAt,
      endsAt,
    },
    ctx,
  );
  return jsonOk({ conflicts });
}
```

- [ ] **Step 10: Implement `src/app/api/locations/[locationId]/shifts/route.ts`**

```ts
import { jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getMonthShiftCounts } from "@/lib/schedule-data";
import { isoDateSchema } from "@/lib/shift-schemas";
import { addDaysISO } from "@/lib/time";

/** Per-day shift counts for the month view. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const guard = await requireManagerForApi();
  if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
  const { locationId } = await params;
  if (guard.location.id !== locationId) {
    return jsonErr("forbidden", "You don't have access to this location", 403);
  }
  const url = new URL(req.url);
  const from = isoDateSchema.safeParse(url.searchParams.get("from"));
  const to = isoDateSchema.safeParse(url.searchParams.get("to"));
  if (!from.success || !to.success) {
    return jsonErr("invalid_input", "from and to must be dates like 2026-07-06", 400);
  }
  if (to.data < from.data || addDaysISO(from.data, 62) < to.data) {
    return jsonErr("invalid_input", "Date range must be between 0 and 62 days", 400);
  }
  return jsonOk({ counts: await getMonthShiftCounts(locationId, from.data, to.data) });
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npx vitest run src/tests/shifts-api.test.ts`
Expected: PASS — 11 tests green.

- [ ] **Step 12: Verify the whole suite and the build**

Run: `npx vitest run && npm run build`
Expected: all tests green; build completes with the new API routes listed.

- [ ] **Step 13: Commit**

```bash
git add src/lib/manager-guard.ts src/lib/shift-schemas.ts src/lib/schedule-data.ts src/app/api/locations src/app/api/shifts src/tests/shifts-api.test.ts
git commit -m "feat: schedule week data + shift CRUD/validate API with computed conflicts"
```

---

### Task 5: AssignShiftDialog with live conflict warnings

**Files:**
- Create: `src/components/schedule/AssignShiftDialog.tsx`
- Create: `src/components/schedule/AssignShiftDialog.module.css`
- Test: `src/components/schedule/AssignShiftDialog.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `Dialog`, `Select`, `Button`, `TimeField`, `Textarea`, `ConflictChip` primitives (Phase 1); `useToast` from `@/components/ui/Toaster`; `parseTime12h`, `dayOfWeekMon0`, `formatDayLabel`, `ISODate` from `@/lib/time` (Task 1); `Conflict` type from `@/lib/conflicts` (Task 2, `import type` only); `EmployeeOption` type from `@/lib/schedule-data` (Task 4, `import type` only); API endpoints `POST /api/shifts`, `PATCH /api/shifts/[shiftId]`, `DELETE /api/shifts/[shiftId]`, `POST /api/shifts/validate` (Task 4).
- Produces (Task 7 consumes):
  ```ts
  // src/components/schedule/AssignShiftDialog.tsx ("use client")
  export type AssignShiftDialogInitial = {
    shiftId?: string;                 // present = edit mode (shows Remove)
    positionId: string | null;        // null = user picks in the dialog (header "Add shift")
    date: ISODate | null;
    employeeProfileId: string | null; // null/"" = open shift
    startTime: string;                // "7:00 AM" or ""
    endTime: string;
    notes: string;
  };
  export default function AssignShiftDialog(props: {
    open: boolean;
    locationId: string;
    positions: { id: string; name: string }[];
    weekDates: ISODate[];             // the 7 days offered in the Day select
    employees: EmployeeOption[];
    initial: AssignShiftDialogInitial | null;
    onClose: () => void;
  }): React.ReactElement;
  // Exported pure helpers (unit-tested):
  export function qualifiedEmployees(employees: EmployeeOption[], positionId: string): EmployeeOption[];
  export function employeeOptionLabel(employee: EmployeeOption, date: ISODate | null): string;
  ```
- Behavior contract: position + day are always real Selects (this fixes the export's dead header "Add shift" button — the same dialog serves cell clicks, block clicks, and the header button); employee Select lists only employees qualified for the selected position, each option labeled with that day's availability (e.g. "Maria Garcia · 9:00 AM – 3:00 PM", "Sam Torres · off"); times use TimeField with `parseTime12h` validation ("Enter a time like 7:00 AM" under the field — never free-text saves); notes Textarea (fixes the export's missing notes input); while all of employee/position/day/times are valid, a 350 ms-debounced `POST /api/shifts/validate` renders ConflictChip(s) above the footer BEFORE save; Save closes optimistically, then toasts "Shift added"/"Shift updated" (tone success) or "Couldn't save shift" + the API's specific message (tone danger), then `router.refresh()`; Remove does the same with "Shift removed"/"Couldn't remove shift". Conflicts warn — they never disable Save.

- [ ] **Step 1: Write the failing tests**

Create `src/components/schedule/AssignShiftDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/ui/Toaster", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import AssignShiftDialog, {
  employeeOptionLabel,
  qualifiedEmployees,
} from "@/components/schedule/AssignShiftDialog";
import type { EmployeeOption } from "@/lib/schedule-data";

const employees: EmployeeOption[] = [
  {
    employeeProfileId: "ep-maria",
    name: "Maria Garcia",
    positionIds: ["pos-server", "pos-cook"],
    availabilityByDay: ["9:00 AM – 3:00 PM", "All day", "All day", "All day", "All day", "All day", "Off"],
  },
  {
    employeeProfileId: "ep-sam",
    name: "Sam Torres",
    positionIds: ["pos-host"],
    availabilityByDay: ["Off", "All day", "All day", "All day", "All day", "All day", "All day"],
  },
];

const baseProps = {
  open: true,
  locationId: "loc-1",
  positions: [
    { id: "pos-server", name: "Server" },
    { id: "pos-cook", name: "Line cook" },
    { id: "pos-host", name: "Host" },
  ],
  weekDates: ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"],
  employees,
  onClose: () => {},
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        ok: true,
        data: {
          conflicts: [
            { kind: "double_booked", message: "Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift" },
          ],
        },
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("qualifiedEmployees", () => {
  it("filters by the EmployeePosition qualification join", () => {
    expect(qualifiedEmployees(employees, "pos-server").map((e) => e.name)).toEqual(["Maria Garcia"]);
    expect(qualifiedEmployees(employees, "pos-host").map((e) => e.name)).toEqual(["Sam Torres"]);
  });
});

describe("employeeOptionLabel", () => {
  it("appends the selected day's availability", () => {
    // 2026-07-06 is a Monday (index 0)
    expect(employeeOptionLabel(employees[0], "2026-07-06")).toBe("Maria Garcia · 9:00 AM – 3:00 PM");
    expect(employeeOptionLabel(employees[1], "2026-07-06")).toBe("Sam Torres · off");
    expect(employeeOptionLabel(employees[0], "2026-07-07")).toBe("Maria Garcia · available all day");
    expect(employeeOptionLabel(employees[0], null)).toBe("Maria Garcia");
  });
});

describe("live validation", () => {
  it("debounces a validate call and renders the conflict chip before save", async () => {
    render(
      <AssignShiftDialog
        {...baseProps}
        initial={{
          positionId: "pos-server",
          date: "2026-07-06",
          employeeProfileId: "ep-maria",
          startTime: "5:00 PM",
          endTime: "11:00 PM",
          notes: "",
        }}
      />,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/shifts/validate");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      locationId: "loc-1",
      positionId: "pos-server",
      employeeProfileId: "ep-maria",
      date: "2026-07-06",
      startTime: "5:00 PM",
      endTime: "11:00 PM",
    });
    await waitFor(() => {
      expect(screen.getByText("Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift")).toBeTruthy();
    });
  });

  it("does not call the API while times are invalid, and save is a no-op", async () => {
    render(
      <AssignShiftDialog
        {...baseProps}
        initial={{
          positionId: "pos-server",
          date: "2026-07-06",
          employeeProfileId: "ep-maria",
          startTime: "13:00 PM",
          endTime: "5:00 PM",
          notes: "",
        }}
      />,
    );
    fireEvent.click(screen.getByText("Save"));
    // Give the 350 ms debounce time to fire if it (wrongly) would.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/schedule/AssignShiftDialog.test.tsx`
Expected: FAIL — `Cannot find module '@/components/schedule/AssignShiftDialog'`.

- [ ] **Step 3: Create `src/components/schedule/AssignShiftDialog.module.css`**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-family: var(--font-sans);
}

.timeRow {
  display: flex;
  gap: 10px;
}

.timeRow > * {
  flex: 1;
}

.conflicts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
```

- [ ] **Step 4: Implement `src/components/schedule/AssignShiftDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TimeField } from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toaster";
import type { Conflict } from "@/lib/conflicts";
import type { EmployeeOption } from "@/lib/schedule-data";
import { dayOfWeekMon0, formatDayLabel, parseTime12h, type ISODate } from "@/lib/time";
import styles from "./AssignShiftDialog.module.css";

export type AssignShiftDialogInitial = {
  shiftId?: string;
  positionId: string | null;
  date: ISODate | null;
  employeeProfileId: string | null;
  startTime: string;
  endTime: string;
  notes: string;
};

type AssignShiftDialogProps = {
  open: boolean;
  locationId: string;
  positions: { id: string; name: string }[];
  weekDates: ISODate[];
  employees: EmployeeOption[];
  initial: AssignShiftDialogInitial | null;
  onClose: () => void;
};

export function qualifiedEmployees(
  employees: EmployeeOption[],
  positionId: string,
): EmployeeOption[] {
  return employees.filter((e) => e.positionIds.includes(positionId));
}

export function employeeOptionLabel(employee: EmployeeOption, date: ISODate | null): string {
  if (!date) return employee.name;
  const window = employee.availabilityByDay[dayOfWeekMon0(date)];
  if (window === "Off") return `${employee.name} · off`;
  if (window === "All day") return `${employee.name} · available all day`;
  return `${employee.name} · ${window}`;
}

type FieldErrors = { start?: string; end?: string; position?: string; date?: string };

export default function AssignShiftDialog({
  open,
  locationId,
  positions,
  weekDates,
  employees,
  initial,
  onClose,
}: AssignShiftDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(initial?.shiftId);

  const [positionId, setPositionId] = useState("");
  const [date, setDate] = useState("");
  const [employeeProfileId, setEmployeeProfileId] = useState(""); // "" = open shift
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // Re-seed local state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPositionId(initial?.positionId ?? "");
    setDate(initial?.date ?? "");
    setEmployeeProfileId(initial?.employeeProfileId ?? "");
    setStartTime(initial?.startTime ?? "");
    setEndTime(initial?.endTime ?? "");
    setNotes(initial?.notes ?? "");
    setErrors({});
    setConflicts([]);
  }, [open, initial]);

  // Live conflict check: debounce 350 ms, only when the form is complete and
  // valid. Advisory only — the server re-checks on save.
  useEffect(() => {
    if (!open) return;
    if (
      !employeeProfileId ||
      !positionId ||
      !date ||
      !parseTime12h(startTime) ||
      !parseTime12h(endTime)
    ) {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/shifts/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shiftId: initial?.shiftId,
            locationId,
            positionId,
            employeeProfileId,
            date,
            startTime,
            endTime,
          }),
        });
        const body = await res.json();
        if (body.ok) setConflicts(body.data.conflicts);
      } catch {
        // Network hiccup: skip the live warning; save still re-validates.
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [open, locationId, positionId, employeeProfileId, date, startTime, endTime, initial?.shiftId]);

  const eligible = positionId ? qualifiedEmployees(employees, positionId) : employees;

  async function handleSave() {
    const nextErrors: FieldErrors = {};
    if (!positionId) nextErrors.position = "Choose a position";
    if (!date) nextErrors.date = "Choose a day";
    if (!parseTime12h(startTime)) nextErrors.start = "Enter a time like 7:00 AM";
    if (!parseTime12h(endTime)) nextErrors.end = "Enter a time like 3:00 PM";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onClose(); // optimistic close; a toast reports the outcome
    try {
      const res = await fetch(isEdit ? `/api/shifts/${initial!.shiftId}` : "/api/shifts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? {} : { locationId }),
          positionId,
          employeeProfileId: employeeProfileId || null,
          date,
          startTime,
          endTime,
          notes: notes || (isEdit ? null : undefined),
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: isEdit ? "Shift updated" : "Shift added" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save shift",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  async function handleRemove() {
    if (!initial?.shiftId) return;
    onClose();
    try {
      const res = await fetch(`/api/shifts/${initial.shiftId}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Shift removed" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't remove shift",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit shift" : "Assign shift"}
      footer={
        <>
          {isEdit && (
            <Button variant="ghost" onClick={handleRemove}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Select
          label="Position"
          value={positionId}
          onChange={setPositionId}
          placeholder="Choose a position"
          options={positions.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          label="Day"
          value={date}
          onChange={setDate}
          placeholder="Choose a day"
          options={weekDates.map((d) => ({ value: d, label: formatDayLabel(d) }))}
        />
        <Select
          label="Employee"
          value={employeeProfileId}
          onChange={setEmployeeProfileId}
          placeholder="Open shift (unassigned)"
          options={eligible.map((e) => ({
            value: e.employeeProfileId,
            label: employeeOptionLabel(e, date || null),
          }))}
        />
        <div className={styles.timeRow}>
          <TimeField
            label="Start"
            placeholder="7:00 AM"
            value={startTime}
            onChange={setStartTime}
            error={errors.start}
          />
          <TimeField
            label="End"
            placeholder="3:00 PM"
            value={endTime}
            onChange={setEndTime}
            error={errors.end}
          />
        </div>
        <Textarea
          label="Notes"
          placeholder="Anything the employee should know, like &quot;Bring your own knife kit.&quot;"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        {conflicts.length > 0 && (
          <div className={styles.conflicts}>
            {conflicts.map((c) => (
              <ConflictChip key={c.message}>{c.message}</ConflictChip>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
```

Note: position/date validation errors surface via the Save guard (`errors.position`/`errors.date` set but Select has no error prop in the pinned API — if Phase 1's Select DOES have an `error` prop, pass them through; otherwise the empty-select placeholder plus the no-op Save is acceptable because Save cannot proceed).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/schedule/AssignShiftDialog.test.tsx`
Expected: PASS — 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/components/schedule/AssignShiftDialog.tsx src/components/schedule/AssignShiftDialog.module.css src/components/schedule/AssignShiftDialog.test.tsx
git commit -m "feat: assign-shift dialog with qualification filter, TimeField validation, notes, live conflict warnings"
```

---

### Task 6: Week / day / month view components

**Files:**
- Create: `src/components/schedule/WeekGrid.tsx`
- Create: `src/components/schedule/DayList.tsx`
- Create: `src/components/schedule/MonthGrid.tsx`
- Create: `src/components/schedule/grids.module.css`
- Test: `src/components/schedule/grids.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `ShiftBlock`, `WeekGridCell`, `Badge`, `EmptyState` primitives (Phase 1); `formatDayLabel`, `formatFullDate`, `weekStartOfISO`, `addDaysISO`, `ISODate` from `@/lib/time` (Task 1); `ScheduleShift` type from `@/lib/schedule-data` (Task 4, `import type`). Per Phase 1's `WeekGridCell` contract: an `empty` cell renders ITS OWN `<button aria-label={addLabel}>` and ignores children — so WeekGrid passes `empty` + `onClick` + `addLabel` (and NO children) for empty cells, and renders the custom in-cell "+ Add" button only inside occupied cells.
- Produces (Task 7 consumes):
  ```tsx
  // WeekGrid.tsx ("use client")
  export default function WeekGrid(props: {
    positions: { id: string; name: string }[];
    weekDates: ISODate[]; // 7 Monday-first days
    shifts: ScheduleShift[];
    onCellClick: (positionId: string, date: ISODate) => void; // open dialog prefilled
    onShiftClick: (shift: ScheduleShift) => void;             // edit dialog
  }): React.ReactElement;

  // DayList.tsx ("use client")
  export default function DayList(props: {
    positions: { id: string; name: string }[];
    date: ISODate;
    shifts: ScheduleShift[]; // pre-filtered to `date`
    onAddClick: (positionId: string) => void;
    onShiftClick: (shift: ScheduleShift) => void;
  }): React.ReactElement;

  // MonthGrid.tsx ("use client")
  export default function MonthGrid(props: {
    month: string; // "2026-07"
    counts: Record<ISODate, number>;
    onSelectDay: (date: ISODate) => void;
  }): React.ReactElement;
  ```
- Layout reference: `"RosterHouse Design System/ui_kits/manager-web/WeekGrid.jsx"` and `ScheduleView.jsx` (110px label column + 7 equal columns, sticky day header, dashed "+ Add" affordance, month = 42 cells Monday-first). Fixes over the export: every add affordance is a real `<button>` with an aria-label and focus ring (not an onClick div); month cell keys are full ISO dates (the export's day-number keys collide across months); positions come from the DB, not a hardcoded ROLES array.

- [ ] **Step 1: Write the failing tests**

Create `src/components/schedule/grids.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DayList from "@/components/schedule/DayList";
import MonthGrid from "@/components/schedule/MonthGrid";
import WeekGrid from "@/components/schedule/WeekGrid";
import type { ScheduleShift } from "@/lib/schedule-data";

afterEach(cleanup);

const positions = [
  { id: "pos-cook", name: "Line cook" },
  { id: "pos-server", name: "Server" },
];
const weekDates = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"];

function shift(overrides: Partial<ScheduleShift>): ScheduleShift {
  return {
    id: "s1",
    positionId: "pos-server",
    positionName: "Server",
    employeeProfileId: "ep-maria",
    employeeName: "Maria Garcia",
    date: "2026-07-06",
    startsAt: "2026-07-06T15:00:00.000Z",
    endsAt: "2026-07-06T23:00:00.000Z",
    timeRange: "11:00 AM – 7:00 PM",
    status: "draft",
    notes: null,
    uiStatus: "draft",
    conflicts: [],
    ...overrides,
  };
}

describe("WeekGrid", () => {
  it("renders positions as rows and shifts in their cells", () => {
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[shift({})]}
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Line cook")).toBeTruthy();
    expect(screen.getByText("Server")).toBeTruthy();
    expect(screen.getByText("Mon 6")).toBeTruthy();
    expect(screen.getByText("Maria Garcia")).toBeTruthy();
  });

  it("empty cells are WeekGridCell's own labeled add buttons that report position and date", () => {
    const onCellClick = vi.fn();
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[]}
        onCellClick={onCellClick}
        onShiftClick={vi.fn()}
      />,
    );
    // Phase 1's WeekGridCell renders the <button aria-label={addLabel}> itself
    // when empty — WeekGrid supplies onClick + addLabel and no children.
    const button = screen.getByLabelText("Add Server shift on Mon 6");
    expect(button.tagName).toBe("BUTTON");
    fireEvent.click(button);
    expect(onCellClick).toHaveBeenCalledWith("pos-server", "2026-07-06");
  });

  it("occupied cells keep an in-cell add button below their shifts", () => {
    const onCellClick = vi.fn();
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[shift({})]}
        onCellClick={onCellClick}
        onShiftClick={vi.fn()}
      />,
    );
    // The Server / Mon 6 cell is occupied, so this is WeekGrid's custom
    // "+ Add" button rendered as a child — not the WeekGridCell empty button.
    const button = screen.getByLabelText("Add Server shift on Mon 6");
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toContain("+ Add");
    fireEvent.click(button);
    expect(onCellClick).toHaveBeenCalledWith("pos-server", "2026-07-06");
  });

  it("clicking a shift block opens edit", () => {
    const onShiftClick = vi.fn();
    const s = shift({});
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[s]}
        onCellClick={vi.fn()}
        onShiftClick={onShiftClick}
      />,
    );
    fireEvent.click(screen.getByText("Maria Garcia"));
    expect(onShiftClick).toHaveBeenCalledWith(s);
  });

  it("shows an empty state banner when the week has no shifts", () => {
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[]}
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />,
    );
    expect(screen.getByText("No shifts scheduled this week yet")).toBeTruthy();
  });
});

describe("DayList", () => {
  it("groups by position with an empty message when the day is blank", () => {
    render(
      <DayList
        positions={positions}
        date="2026-07-07"
        shifts={[]}
        onAddClick={vi.fn()}
        onShiftClick={vi.fn()}
      />,
    );
    expect(screen.getByText("No shifts scheduled for this day yet.")).toBeTruthy();
    const button = screen.getByLabelText("Add Line cook shift");
    expect(button.tagName).toBe("BUTTON");
  });

  it("add button reports the position", () => {
    const onAddClick = vi.fn();
    render(
      <DayList
        positions={positions}
        date="2026-07-06"
        shifts={[shift({})]}
        onAddClick={onAddClick}
        onShiftClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Add Server shift"));
    expect(onAddClick).toHaveBeenCalledWith("pos-server");
  });
});

describe("MonthGrid", () => {
  it("renders 42 day buttons keyed by full date — no cross-month collisions", () => {
    render(
      <MonthGrid month="2026-07" counts={{ "2026-07-10": 3, "2026-07-11": 1 }} onSelectDay={vi.fn()} />,
    );
    // Grid runs Mon Jun 29 – Sun Aug 9: the day number "1" appears for both
    // Jul 1 and Aug 1 (the export's key collision bug would drop one).
    expect(screen.getAllByText("1")).toHaveLength(2);
    expect(screen.getByText("3 shifts")).toBeTruthy();
    expect(screen.getByText("1 shift")).toBeTruthy();
  });

  it("clicking a day reports its ISO date", () => {
    const onSelectDay = vi.fn();
    render(<MonthGrid month="2026-07" counts={{}} onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByLabelText("View Friday, July 10"));
    expect(onSelectDay).toHaveBeenCalledWith("2026-07-10");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/schedule/grids.test.tsx`
Expected: FAIL — cannot resolve the three components.

- [ ] **Step 3: Create `src/components/schedule/grids.module.css`**

```css
.weekGrid {
  font-family: var(--font-sans);
}

.headerRow {
  display: grid;
  grid-template-columns: 110px repeat(7, minmax(128px, 1fr));
  gap: 8px;
  position: sticky;
  top: 0;
  background: var(--surface-page);
  z-index: 2;
  padding-bottom: 8px;
}

.dayLabel {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.positionRow {
  display: grid;
  grid-template-columns: 110px repeat(7, minmax(128px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.positionLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  padding-top: 6px;
}

.cellStack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.addButton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 0;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
}

.addButton:hover {
  color: var(--text-secondary);
  border-color: var(--text-tertiary);
}

.addButton:active {
  color: var(--text-primary);
}

.addButton:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.emptyBanner {
  margin-bottom: 12px;
}

/* Day view */
.dayList {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-family: var(--font-sans);
}

.dayEmpty {
  font-size: 14px;
  color: var(--text-tertiary);
}

.dayGroupTitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.dayGroupStack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 460px;
}

.dayAddButton {
  composes: addButton;
  padding: 7px 0;
  font-size: 12px;
}

/* Month view */
.monthGrid {
  font-family: var(--font-sans);
}

.monthHeaderRow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.monthHeaderCell {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
}

.monthCells {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.monthCell {
  min-height: 78px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  padding: 8px;
  cursor: pointer;
  background: var(--surface-card);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  font-family: var(--font-sans);
  text-align: left;
}

.monthCell:hover {
  border-color: var(--border-strong);
}

.monthCell:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.monthCellOutside {
  background: var(--surface-sunken);
  opacity: 0.5;
}

.monthDayNumber {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
```

- [ ] **Step 4: Implement `src/components/schedule/WeekGrid.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import type { ScheduleShift } from "@/lib/schedule-data";
import { formatDayLabel, type ISODate } from "@/lib/time";
import styles from "./grids.module.css";

type WeekGridProps = {
  positions: { id: string; name: string }[];
  weekDates: ISODate[];
  shifts: ScheduleShift[];
  onCellClick: (positionId: string, date: ISODate) => void;
  onShiftClick: (shift: ScheduleShift) => void;
};

export default function WeekGrid({
  positions,
  weekDates,
  shifts,
  onCellClick,
  onShiftClick,
}: WeekGridProps) {
  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleShift[]>();
    for (const s of shifts) {
      const key = `${s.positionId}|${s.date}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  return (
    <div className={styles.weekGrid}>
      {shifts.length === 0 && (
        <div className={styles.emptyBanner}>
          <EmptyState
            title="No shifts scheduled this week yet"
            description="Use any add button below, or the add shift button above, to place the first shift."
          />
        </div>
      )}
      <div className={styles.headerRow}>
        <div />
        {weekDates.map((d) => (
          <div key={d} className={styles.dayLabel}>
            {formatDayLabel(d)}
          </div>
        ))}
      </div>
      {positions.map((position) => (
        <div key={position.id} className={styles.positionRow}>
          <div className={styles.positionLabel}>{position.name}</div>
          {weekDates.map((date) => {
            const cellShifts = byCell.get(`${position.id}|${date}`) ?? [];
            const hasConflict = cellShifts.some((s) => s.uiStatus === "conflict");
            if (cellShifts.length === 0) {
              // Phase 1's WeekGridCell renders its own <button aria-label={addLabel}>
              // when empty (children are ignored) — pass onClick + addLabel, no children.
              return (
                <WeekGridCell
                  key={`${position.id}|${date}`}
                  empty
                  hasConflict={hasConflict}
                  onClick={() => onCellClick(position.id, date)}
                  addLabel={`Add ${position.name} shift on ${formatDayLabel(date)}`}
                />
              );
            }
            return (
              <WeekGridCell key={`${position.id}|${date}`} hasConflict={hasConflict}>
                <div className={styles.cellStack}>
                  {cellShifts.map((s) => (
                    <ShiftBlock
                      key={s.id}
                      compact
                      role={s.positionName}
                      time={s.timeRange}
                      employeeName={s.employeeName ?? undefined}
                      status={s.uiStatus}
                      conflictReason={s.conflicts[0]?.message}
                      onClick={() => onShiftClick(s)}
                    />
                  ))}
                  <button
                    type="button"
                    className={styles.addButton}
                    aria-label={`Add ${position.name} shift on ${formatDayLabel(date)}`}
                    onClick={() => onCellClick(position.id, date)}
                  >
                    + Add
                  </button>
                </div>
              </WeekGridCell>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/components/schedule/DayList.tsx`**

```tsx
"use client";

import { ShiftBlock } from "@/components/ui/ShiftBlock";
import type { ScheduleShift } from "@/lib/schedule-data";
import type { ISODate } from "@/lib/time";
import styles from "./grids.module.css";

type DayListProps = {
  positions: { id: string; name: string }[];
  date: ISODate;
  shifts: ScheduleShift[]; // pre-filtered to `date`
  onAddClick: (positionId: string) => void;
  onShiftClick: (shift: ScheduleShift) => void;
};

export default function DayList({
  positions,
  shifts,
  onAddClick,
  onShiftClick,
}: DayListProps) {
  return (
    <div className={styles.dayList}>
      {shifts.length === 0 && (
        <div className={styles.dayEmpty}>No shifts scheduled for this day yet.</div>
      )}
      {positions.map((position) => {
        const positionShifts = shifts.filter((s) => s.positionId === position.id);
        return (
          <div key={position.id}>
            <div className={styles.dayGroupTitle}>
              {position.name}
              {positionShifts.length > 0 && ` · ${positionShifts.length}`}
            </div>
            <div className={styles.dayGroupStack}>
              {positionShifts.map((s) => (
                <ShiftBlock
                  key={s.id}
                  role={s.positionName}
                  time={s.timeRange}
                  employeeName={s.employeeName ?? undefined}
                  status={s.uiStatus}
                  conflictReason={s.conflicts[0]?.message}
                  onClick={() => onShiftClick(s)}
                />
              ))}
              <button
                type="button"
                className={styles.dayAddButton}
                aria-label={`Add ${position.name} shift`}
                onClick={() => onAddClick(position.id)}
              >
                + Add {position.name} shift
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Implement `src/components/schedule/MonthGrid.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/Badge";
import { addDaysISO, formatFullDate, weekStartOfISO, type ISODate } from "@/lib/time";
import styles from "./grids.module.css";

type MonthGridProps = {
  month: string; // "2026-07"
  counts: Record<ISODate, number>;
  onSelectDay: (date: ISODate) => void;
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MonthGrid({ month, counts, onSelectDay }: MonthGridProps) {
  // 42 cells starting the Monday of the week containing the 1st.
  const gridStart = weekStartOfISO(`${month}-01`);
  const cells: ISODate[] = Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));

  return (
    <div className={styles.monthGrid}>
      <div className={styles.monthHeaderRow}>
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className={styles.monthHeaderCell}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.monthCells}>
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === month;
          const count = counts[date] ?? 0;
          return (
            <button
              key={date}
              type="button"
              className={`${styles.monthCell}${inMonth ? "" : ` ${styles.monthCellOutside}`}`}
              aria-label={`View ${formatFullDate(date)}`}
              onClick={() => onSelectDay(date)}
            >
              <span className={styles.monthDayNumber}>{Number(date.slice(8, 10))}</span>
              {count > 0 && <Badge tone="success">{count === 1 ? "1 shift" : `${count} shifts`}</Badge>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/components/schedule/grids.test.tsx`
Expected: PASS — 9 tests green.

- [ ] **Step 8: Commit**

```bash
git add src/components/schedule/WeekGrid.tsx src/components/schedule/DayList.tsx src/components/schedule/MonthGrid.tsx src/components/schedule/grids.module.css src/components/schedule/grids.test.tsx
git commit -m "feat: week/day/month schedule view components with real button affordances"
```

---

### Task 7: `/manager/schedule` page + view orchestrator

**Files:**
- Create: `src/app/manager/schedule/page.tsx`
- Create: `src/app/manager/schedule/loading.tsx`
- Create: `src/app/manager/schedule/error.tsx`
- Create: `src/components/schedule/ScheduleView.tsx`
- Create: `src/components/schedule/schedule.module.css`
- Test: `src/components/schedule/ScheduleView.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `requireManager` (`@/lib/auth`), `getManagerLocation` (`@/lib/authz`) from Phase 2; `getScheduleWeekData`, `getAssignableEmployees`, `getMonthShiftCounts` + types (Task 4); `WeekGrid`, `DayList`, `MonthGrid` (Task 6); `AssignShiftDialog` (Task 5); `Badge`, `Button`, `ConflictChip`, `Tabs`, `Spinner`, `EmptyState` primitives and `DatePager` chrome (Phase 1); time helpers (Task 1).
- Produces:
  - Route `/manager/schedule?view=week|day|month&week=YYYY-MM-DD` (roadmap contract) with two extra params this plan defines: `day=YYYY-MM-DD` (day view; defaults to today when the selected week is the current one, else the week's Monday) and `month=YYYY-MM` (month view; defaults to the selected week's month). Invalid params fall back to defaults — no crashes.
  - `ScheduleView` client component (Task 9 modifies it to add publish):
    ```tsx
    // src/components/schedule/ScheduleView.tsx ("use client")
    export default function ScheduleView(props: {
      locationId: string;
      currentWeek: ISODate;   // real "today" week in the location's timezone
      view: "week" | "day" | "month";
      week: ISODate;
      day: ISODate;
      month: string;          // "2026-07"
      monthCounts: Record<ISODate, number> | null; // only fetched for month view
      data: ScheduleWeekData;
      employees: EmployeeOption[];
    }): React.ReactElement;
    ```
- Fixes over the export: "Today" goes to the REAL current week in the location timezone (the `ANCHOR = new Date(2026, 6, 6)` demo-date model is dead); the header "Add shift" button opens the assign dialog (position + day chosen inside it); Draft/Published badge and conflict-count chip reflect the selected week only.

- [ ] **Step 1: Write the failing test**

Create `src/components/schedule/ScheduleView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("@/components/ui/Toaster", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import ScheduleView from "@/components/schedule/ScheduleView";
import type { ScheduleWeekData } from "@/lib/schedule-data";

function weekData(overrides: Partial<ScheduleWeekData> = {}): ScheduleWeekData {
  return {
    schedule: { id: "sched-1", status: "draft", publishedAt: null, hasUnpublishedChanges: false },
    weekStart: "2026-07-06",
    positions: [{ id: "pos-server", name: "Server" }],
    shifts: [],
    conflictCount: 0,
    assignedEmployeeCount: 0,
    ...overrides,
  };
}

const baseProps = {
  locationId: "loc-1",
  currentWeek: "2026-07-06",
  view: "week" as const,
  week: "2026-07-06",
  day: "2026-07-06",
  month: "2026-07",
  monthCounts: null,
  employees: [],
};

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("ScheduleView header", () => {
  it("shows the Draft badge and no conflict chip on a clean draft week", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    expect(screen.getByText("Schedule")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.queryByText(/conflict/)).toBeNull();
  });

  it("shows a singular/plural conflict chip", () => {
    render(<ScheduleView {...baseProps} data={weekData({ conflictCount: 2 })} />);
    expect(screen.getByText("2 conflicts to resolve")).toBeTruthy();
  });

  it("header add shift button opens the dialog with position and day selects", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    fireEvent.click(screen.getByText("Add shift"));
    expect(screen.getByText("Assign shift")).toBeTruthy(); // dialog title
  });
});

describe("ScheduleView navigation", () => {
  it("switching tabs pushes the view param", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    fireEvent.click(screen.getByText("Month"));
    expect(push).toHaveBeenCalledWith("/manager/schedule?view=month&week=2026-07-06&month=2026-07");
  });

  it("pager renders prev/next/today as links built from URL state", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    // DatePager is link-based (Phase 1) — no callbacks, real anchors.
    expect(screen.getByRole("link", { name: "Previous week" }).getAttribute("href")).toBe(
      "/manager/schedule?view=week&week=2026-06-29",
    );
    expect(screen.getByRole("link", { name: "Next week" }).getAttribute("href")).toBe(
      "/manager/schedule?view=week&week=2026-07-13",
    );
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("href")).toBe(
      "/manager/schedule?view=week&week=2026-07-06",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/schedule/ScheduleView.test.tsx`
Expected: FAIL — cannot resolve `@/components/schedule/ScheduleView`.

- [ ] **Step 3: Create `src/components/schedule/schedule.module.css`**

```css
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
  font-family: var(--font-sans);
}

.title {
  font-size: var(--text-h1-size);
  font-weight: var(--text-h1-weight);
  color: var(--text-primary);
}

.badgeRow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.actions {
  display: flex;
  gap: 10px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.loadingWrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 0;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
}

.errorWrap {
  padding: 48px 0;
}
```

- [ ] **Step 4: Implement `src/components/schedule/ScheduleView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePager } from "@/components/chrome/DatePager";
import AssignShiftDialog, {
  type AssignShiftDialogInitial,
} from "@/components/schedule/AssignShiftDialog";
import DayList from "@/components/schedule/DayList";
import MonthGrid from "@/components/schedule/MonthGrid";
import WeekGrid from "@/components/schedule/WeekGrid";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Tabs } from "@/components/ui/Tabs";
import type { EmployeeOption, ScheduleShift, ScheduleWeekData } from "@/lib/schedule-data";
import {
  addDaysISO,
  formatDateShort,
  formatFullDate,
  weekDatesOf,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";
import styles from "./schedule.module.css";

type ScheduleViewProps = {
  locationId: string;
  currentWeek: ISODate;
  view: "week" | "day" | "month";
  week: ISODate;
  day: ISODate;
  month: string; // "2026-07"
  monthCounts: Record<ISODate, number> | null;
  data: ScheduleWeekData;
  employees: EmployeeOption[];
};

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function ScheduleView({
  locationId,
  currentWeek,
  view,
  week,
  day,
  month,
  monthCounts,
  data,
  employees,
}: ScheduleViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<AssignShiftDialogInitial | null>(null);

  function buildUrl(next: Partial<{ view: string; week: ISODate; day: ISODate; month: string }>): string {
    const nextView = next.view ?? view;
    const params = new URLSearchParams();
    params.set("view", nextView);
    params.set("week", next.week ?? week);
    if (nextView === "day") params.set("day", next.day ?? day);
    if (nextView === "month") params.set("month", next.month ?? month);
    return `/manager/schedule?${params.toString()}`;
  }

  function go(next: Partial<{ view: string; week: ISODate; day: ISODate; month: string }>) {
    router.push(buildUrl(next));
  }

  function openAdd(positionId: string | null, date: ISODate | null) {
    setDialogInitial({
      positionId,
      date,
      employeeProfileId: null,
      startTime: "",
      endTime: "",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(shift: ScheduleShift) {
    const [startTime, endTime] = shift.timeRange.split(" – ");
    setDialogInitial({
      shiftId: shift.id,
      positionId: shift.positionId,
      date: shift.date,
      employeeProfileId: shift.employeeProfileId,
      startTime,
      endTime,
      notes: shift.notes ?? "",
    });
    setDialogOpen(true);
  }

  const isRepublish = data.schedule.status === "published" && data.schedule.hasUnpublishedChanges;

  // Pager wiring per view — DatePager is link-based (next/link anchors), so
  // compute prev/next/today HREFS with the same URL logic as go(). "Today"
  // always returns to the real current week/day/month in the location's
  // timezone (no demo anchor date).
  let pagerLabel: string;
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;
  let prevLabel: string;
  let nextLabel: string;
  if (view === "day") {
    pagerLabel = formatFullDate(day);
    const prevDay = addDaysISO(day, -1);
    const nextDay = addDaysISO(day, 1);
    prevHref = buildUrl({ day: prevDay, week: weekStartOfISO(prevDay) });
    nextHref = buildUrl({ day: nextDay, week: weekStartOfISO(nextDay) });
    todayHref = buildUrl({ day: currentWeek, week: currentWeek });
    prevLabel = "Previous day";
    nextLabel = "Next day";
  } else if (view === "month") {
    pagerLabel = monthLabel(month);
    prevHref = buildUrl({ month: addMonths(month, -1) });
    nextHref = buildUrl({ month: addMonths(month, 1) });
    todayHref = buildUrl({ month: currentWeek.slice(0, 7), week: currentWeek });
    prevLabel = "Previous month";
    nextLabel = "Next month";
  } else {
    pagerLabel = `${formatDateShort(week)} – ${formatDateShort(addDaysISO(week, 6))}`;
    prevHref = buildUrl({ week: addDaysISO(week, -7) });
    nextHref = buildUrl({ week: addDaysISO(week, 7) });
    todayHref = buildUrl({ week: currentWeek });
    prevLabel = "Previous week";
    nextLabel = "Next week";
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Schedule</h1>
          <div className={styles.badgeRow}>
            {data.schedule.status === "draft" && <Badge tone="warning">Draft</Badge>}
            {data.schedule.status === "published" && !isRepublish && (
              <Badge tone="success">Published</Badge>
            )}
            {isRepublish && <Badge tone="warning">Unpublished changes</Badge>}
            {data.conflictCount > 0 && (
              <ConflictChip>
                {data.conflictCount === 1
                  ? "1 conflict to resolve"
                  : `${data.conflictCount} conflicts to resolve`}
              </ConflictChip>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => openAdd(null, null)}>
            Add shift
          </Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <DatePager
          label={pagerLabel}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        />
        <Tabs
          value={view}
          tabs={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          onChange={(v) => go({ view: v })}
        />
      </div>

      {view === "week" && (
        <WeekGrid
          positions={data.positions}
          weekDates={weekDatesOf(week)}
          shifts={data.shifts}
          onCellClick={(positionId, date) => openAdd(positionId, date)}
          onShiftClick={openEdit}
        />
      )}
      {view === "day" && (
        <DayList
          positions={data.positions}
          date={day}
          shifts={data.shifts.filter((s) => s.date === day)}
          onAddClick={(positionId) => openAdd(positionId, day)}
          onShiftClick={openEdit}
        />
      )}
      {view === "month" && (
        <MonthGrid
          month={month}
          counts={monthCounts ?? {}}
          onSelectDay={(date) => go({ view: "day", day: date, week: weekStartOfISO(date) })}
        />
      )}

      <AssignShiftDialog
        open={dialogOpen}
        locationId={locationId}
        positions={data.positions}
        weekDates={weekDatesOf(week)}
        employees={employees}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/app/manager/schedule/page.tsx`**

```tsx
import ScheduleView from "@/components/schedule/ScheduleView";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import {
  getAssignableEmployees,
  getMonthShiftCounts,
  getScheduleWeekData,
} from "@/lib/schedule-data";
import {
  addDaysISO,
  localISODate,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const params = await searchParams;

  const todayISO = localISODate(new Date(), location.timezone);
  const currentWeek = weekStartOfISO(todayISO);

  const rawView = typeof params.view === "string" ? params.view : "week";
  const view = rawView === "day" || rawView === "month" ? rawView : "week";

  // Any non-Monday week param snaps to its Monday; invalid params fall back
  // to the real current week (no demo anchor dates).
  const rawWeek =
    typeof params.week === "string" && ISO_DATE.test(params.week) ? params.week : currentWeek;
  const week = weekStartOfISO(rawWeek);

  const rawDay = typeof params.day === "string" && ISO_DATE.test(params.day) ? params.day : null;
  let day: ISODate = rawDay ?? (week === currentWeek ? todayISO : week);
  if (weekStartOfISO(day) !== week) day = week;

  const month =
    typeof params.month === "string" && ISO_MONTH.test(params.month)
      ? params.month
      : week.slice(0, 7);

  const [data, employees] = await Promise.all([
    getScheduleWeekData(location.id, week),
    getAssignableEmployees(location.id),
  ]);

  let monthCounts: Record<ISODate, number> | null = null;
  if (view === "month") {
    const gridStart = weekStartOfISO(`${month}-01`);
    monthCounts = await getMonthShiftCounts(location.id, gridStart, addDaysISO(gridStart, 41));
  }

  return (
    <ScheduleView
      locationId={location.id}
      currentWeek={currentWeek}
      view={view}
      week={week}
      day={day}
      month={month}
      monthCounts={monthCounts}
      data={data}
      employees={employees}
    />
  );
}
```

- [ ] **Step 6: Implement `src/app/manager/schedule/loading.tsx`**

```tsx
import { Spinner } from "@/components/ui/Spinner";
import styles from "@/components/schedule/schedule.module.css";

export default function ScheduleLoading() {
  return (
    <div className={styles.loadingWrap} role="status" aria-label="Loading schedule">
      <Spinner />
      <span>Loading schedule…</span>
    </div>
  );
}
```

- [ ] **Step 7: Implement `src/app/manager/schedule/error.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/schedule/schedule.module.css";

export default function ScheduleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.errorWrap}>
      <EmptyState
        title="Something went wrong loading the schedule"
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

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/schedule/ScheduleView.test.tsx`
Expected: PASS — 5 tests green.

- [ ] **Step 9: Verify the page in the browser**

Run: `npm run build` (expect success, `/manager/schedule` listed), then `npm run dev` and sign in as `jamie@harborvine.test` / `rosterhouse1`; open `http://localhost:3000/manager/schedule`.

Expected: the CURRENT week renders with seeded shifts in position rows; prev/next/Today move weeks; the Day and Month tabs work; clicking an empty cell opens the dialog prefilled with that position and day; clicking a shift opens edit with its times; the header "Add shift" opens the dialog with empty position/day selects; the seeded double-booking shows the conflict chip in the header ("1 conflict to resolve" or more) when you view its week.

- [ ] **Step 10: Commit**

```bash
git add src/app/manager/schedule src/components/schedule/ScheduleView.tsx src/components/schedule/ScheduleView.test.tsx src/components/schedule/schedule.module.css
git commit -m "feat: /manager/schedule page with week/day/month views wired to real data"
```

---

### Task 8: Notification plumbing (`src/lib/notify/`)

**Files:**
- Create: `src/lib/notify/index.ts`
- Create: `src/lib/notify/console-driver.ts`
- Test: `src/lib/notify/notify.test.ts` (integration — writes Notification rows against docker Postgres, drivers faked)

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`); `NotificationType` enum type from `@/generated/prisma/client`.
- Produces (Task 9 and Phase 5 consume — roadmap contract):
  ```ts
  // src/lib/notify/index.ts
  export type NotifyInput = { userId: string; type: NotificationType; title: string; body: string };
  export interface ChannelDriver {
    sendSms(phone: string, body: string): Promise<void>;
    sendPush(deviceToken: string, payload: { title: string; body: string }): Promise<void>;
  }
  export function notifyUsers(inputs: NotifyInput[], driver?: ChannelDriver): Promise<{ count: number }>;
  // driver defaults to consoleDriver; Twilio/web-push drop in later via this interface.

  // src/lib/notify/console-driver.ts
  export const consoleDriver: ChannelDriver;
  ```
- Behavior: every input writes a `Notification` row (in-app feed is the source of truth); SMS goes out when the user's `EmployeeProfile.notifySms` is true AND `User.phone` is set; push goes to every `PushDevice` when `notifyPush` is true; `channelsSent` records what actually went out (`["sms","push"]`, `["sms"]`, `[]`, …); unknown userIds are skipped; `count` = number of users who got a Notification row.

- [ ] **Step 1: Write the failing test**

Create `src/lib/notify/notify.test.ts`:

```ts
import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { notifyUsers, type ChannelDriver } from "@/lib/notify";

// The test owns its fixtures — a throwaway org so seed data stays untouched.
let orgId: string;
let smsUserId: string;   // sms + push on, phone + device present
let quietUserId: string; // all channels off

function fakeDriver() {
  const sms: { phone: string; body: string }[] = [];
  const push: { token: string; title: string }[] = [];
  const driver: ChannelDriver = {
    async sendSms(phone, body) {
      sms.push({ phone, body });
    },
    async sendPush(token, payload) {
      push.push({ token, title: payload.title });
    },
  };
  return { driver, sms, push };
}

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: "Notify test org",
      locations: { create: { name: "Test location", timezone: "America/New_York" } },
    },
    include: { locations: true },
  });
  orgId = org.id;
  const locationId = org.locations[0].id;

  const smsUser = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Notified Nancy",
      email: "nancy@notify.test",
      phone: "+15550001111",
      passwordHash: "irrelevant",
      role: "employee",
      pushDevices: { create: { token: "device-token-1", platform: "web" } },
      profiles: {
        create: { locationId, status: "active", notifySms: true, notifyPush: true },
      },
    },
  });
  smsUserId = smsUser.id;

  const quietUser = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Quiet Quentin",
      email: "quentin@notify.test",
      passwordHash: "irrelevant",
      role: "employee",
      profiles: {
        create: { locationId, status: "active", notifySms: false, notifyPush: false },
      },
    },
  });
  quietUserId = quietUser.id;
});

afterAll(async () => {
  // Cascades: users → profiles/devices/notifications.
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("notifyUsers", () => {
  it("writes rows, respects channel prefs, and returns the real count", async () => {
    const { driver, sms, push } = fakeDriver();
    const result = await notifyUsers(
      [
        {
          userId: smsUserId,
          type: "schedule_published",
          title: "New schedule published",
          body: "Your schedule for the week of Jul 6 is ready.",
        },
        {
          userId: quietUserId,
          type: "schedule_published",
          title: "New schedule published",
          body: "Your schedule for the week of Jul 6 is ready.",
        },
      ],
      driver,
    );
    expect(result).toEqual({ count: 2 });

    const rows = await prisma.notification.findMany({
      where: { userId: { in: [smsUserId, quietUserId] } },
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === smsUserId)?.channelsSent.sort()).toEqual(["push", "sms"]);
    expect(rows.find((r) => r.userId === quietUserId)?.channelsSent).toEqual([]);

    expect(sms).toEqual([
      { phone: "+15550001111", body: "New schedule published — Your schedule for the week of Jul 6 is ready." },
    ]);
    expect(push).toEqual([{ token: "device-token-1", title: "New schedule published" }]);
  });

  it("skips unknown users and still counts the rest", async () => {
    const { driver } = fakeDriver();
    const result = await notifyUsers(
      [
        { userId: "no-such-user", type: "shift_reminder", title: "Shift soon", body: "Starts at 3:00 PM." },
        { userId: smsUserId, type: "shift_reminder", title: "Shift soon", body: "Starts at 3:00 PM." },
      ],
      driver,
    );
    expect(result).toEqual({ count: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notify/notify.test.ts`
Expected: FAIL — `Cannot find module '@/lib/notify'`.

- [ ] **Step 3: Implement `src/lib/notify/console-driver.ts`**

```ts
import type { ChannelDriver } from "./index";

/** v1 driver: logs delivery intents. Twilio/web-push replace this later. */
export const consoleDriver: ChannelDriver = {
  async sendSms(phone, body) {
    console.log(`[notify] sms → ${phone}: ${body}`);
  },
  async sendPush(deviceToken, payload) {
    console.log(`[notify] push → ${deviceToken}: ${payload.title} — ${payload.body}`);
  },
};
```

- [ ] **Step 4: Implement `src/lib/notify/index.ts`**

```ts
import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { consoleDriver } from "./console-driver";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
};

export interface ChannelDriver {
  sendSms(phone: string, body: string): Promise<void>;
  sendPush(deviceToken: string, payload: { title: string; body: string }): Promise<void>;
}

/**
 * Write Notification rows (the in-app feed), then fan out through the
 * user's channel prefs via the driver. Returns how many users got a row —
 * this is the number surfaced in publish confirmations, so it must be real.
 */
export async function notifyUsers(
  inputs: NotifyInput[],
  driver: ChannelDriver = consoleDriver,
): Promise<{ count: number }> {
  let count = 0;
  for (const input of inputs) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { profiles: true, pushDevices: true },
    });
    if (!user) continue;

    // v1: one location per user, so one profile carries the prefs.
    const prefs = user.profiles[0] ?? null;
    const channels: string[] = [];

    if (prefs?.notifySms && user.phone) {
      await driver.sendSms(user.phone, `${input.title} — ${input.body}`);
      channels.push("sms");
    }
    if (prefs?.notifyPush && user.pushDevices.length > 0) {
      for (const device of user.pushDevices) {
        await driver.sendPush(device.token, { title: input.title, body: input.body });
      }
      channels.push("push");
    }

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channelsSent: channels,
      },
    });
    count += 1;
  }
  return { count };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/notify/notify.test.ts`
Expected: PASS — 2 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notify
git commit -m "feat: notification rows + channel driver interface with console v1 driver"
```

---

### Task 9: Publish transaction + confirm dialog + republish detection

**Files:**
- Create: `src/app/api/schedules/[scheduleId]/publish/route.ts`
- Create: `src/components/schedule/PublishDialog.tsx`
- Modify: `src/components/schedule/ScheduleView.tsx` (add the publish button + dialog)
- Test: `src/tests/publish-api.test.ts` (integration)

**Interfaces:**
- Consumes: `requireManagerForApi` (Task 4), `jsonOk`/`jsonErr` (Phase 2), `notifyUsers` (Task 8), `getScheduleWeekData` (Task 4, for republish-detection assertions), `formatDateShort`/`toISODate` (Task 1), `Dialog`/`Button`/`useToast` (Phase 1), `ScheduleView` (Task 7).
- Produces:
  - `POST /api/schedules/[scheduleId]/publish` → `{ count: number }` (real distinct-employee count). Transaction scope: THIS schedule only (the export's publish flipped every week globally — that bug dies here). Draft shifts flip to published; already-published shifts stay; `publishedAt`/`publishedByUserId` set; then `notifyUsers` fans out `schedule_published` ("New schedule published" / "Your schedule for the week of Jul 6 is ready.") to distinct assigned employees.
  - `PublishDialog` component:
    ```tsx
    // src/components/schedule/PublishDialog.tsx ("use client")
    export default function PublishDialog(props: {
      open: boolean;
      scheduleId: string;
      employeeCount: number;  // assignedEmployeeCount from ScheduleWeekData
      isRepublish: boolean;
      onClose: () => void;
    }): React.ReactElement;
    ```
  - Republish UX: on a published schedule with `hasUnpublishedChanges` (Task 4 computes it: any draft shift, or any shift with `updatedAt > publishedAt`), the header badge reads "Unpublished changes" and the publish button relabels "Publish changes".
- Copy (pinned; calm, no exclamation points, real numbers — the export said 5, 10, and 12 in three places):
  - Confirm title: `Publish this week's schedule?` (republish: `Publish changes?`)
  - Confirm body: `3 employees will be notified.` / `1 employee will be notified.` / `No employees are assigned yet, so no one will be notified.`
  - Success toast: title `Schedule published` (republish: `Changes published`), description `3 employees notified.` using the count the API RETURNED.
  - Failure toast: title `Couldn't publish schedule`, description = API error message.

- [ ] **Step 1: Write the failing integration test**

Create `src/tests/publish-api.test.ts`:

```ts
import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession.current),
}));

import { prisma } from "@/lib/db";
import { getScheduleWeekData } from "@/lib/schedule-data";
import { addDaysISO, weekStartOf, type ISODate } from "@/lib/time";
import { POST as publishSchedule } from "@/app/api/schedules/[scheduleId]/publish/route";

const NY = "America/New_York";
let locationId: string;
let scheduleId: string;
let farWeek: ISODate;
let userIds: string[] = [];
const startedAt = new Date();

beforeAll(async () => {
  const jamie = await prisma.user.findUnique({ where: { email: "jamie@harborvine.test" } });
  if (!jamie) throw new Error("Seed data missing. Run: npx prisma db seed");
  mockSession.current = {
    user: { id: jamie.id, name: jamie.name, role: "manager", organizationId: jamie.organizationId },
  };
  const location = await prisma.location.findFirstOrThrow({
    where: { organizationId: jamie.organizationId },
  });
  locationId = location.id;

  // Build an isolated week 50 weeks out: 2 assigned draft shifts for 2
  // different seeded employees + 1 open shift.
  farWeek = addDaysISO(weekStartOf(new Date(), NY), 7 * 50);
  const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId, status: "active" },
    take: 2,
  });
  expect(profiles).toHaveLength(2);
  userIds = profiles.map((p) => p.userId);

  const schedule = await prisma.schedule.create({
    data: { locationId, weekStartDate: new Date(farWeek) },
  });
  scheduleId = schedule.id;
  const day = (n: number) => addDaysISO(farWeek, n);
  await prisma.shift.createMany({
    data: [
      {
        scheduleId, locationId, positionId: position.id,
        employeeProfileId: profiles[0].id, date: new Date(day(0)),
        startsAt: new Date(`${day(0)}T11:00:00Z`), endsAt: new Date(`${day(0)}T19:00:00Z`),
      },
      {
        scheduleId, locationId, positionId: position.id,
        employeeProfileId: profiles[1].id, date: new Date(day(1)),
        startsAt: new Date(`${day(1)}T11:00:00Z`), endsAt: new Date(`${day(1)}T19:00:00Z`),
      },
      {
        scheduleId, locationId, positionId: position.id,
        employeeProfileId: null, date: new Date(day(2)),
        startsAt: new Date(`${day(2)}T11:00:00Z`), endsAt: new Date(`${day(2)}T19:00:00Z`),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.schedule.delete({ where: { id: scheduleId } }); // cascades shifts
  await prisma.notification.deleteMany({
    where: { userId: { in: userIds }, type: "schedule_published", createdAt: { gte: startedAt } },
  });
});

describe("POST /api/schedules/[scheduleId]/publish", () => {
  it("flips this schedule only, notifies distinct assignees, returns the real count", async () => {
    const res = await publishSchedule(
      new Request(`http://test/api/schedules/${scheduleId}/publish`, { method: "POST" }),
      { params: Promise.resolve({ scheduleId }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.count).toBe(2); // 2 distinct employees; the open shift notifies no one

    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(schedule.status).toBe("published");
    expect(schedule.publishedAt).not.toBeNull();

    const shifts = await prisma.shift.findMany({ where: { scheduleId } });
    expect(shifts.every((s) => s.status === "published")).toBe(true);

    const rows = await prisma.notification.findMany({
      where: { userId: { in: userIds }, type: "schedule_published", createdAt: { gte: startedAt } },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("New schedule published");
  });

  it("immediately after publish there are no unpublished changes", async () => {
    const data = await getScheduleWeekData(locationId, farWeek);
    expect(data.schedule.status).toBe("published");
    expect(data.schedule.hasUnpublishedChanges).toBe(false);
  });

  it("editing a published shift flags unpublished changes", async () => {
    const shift = await prisma.shift.findFirstOrThrow({
      where: { scheduleId, employeeProfileId: { not: null } },
    });
    await prisma.shift.update({
      where: { id: shift.id },
      data: { notes: "Edited after publish" },
    });
    const data = await getScheduleWeekData(locationId, farWeek);
    expect(data.schedule.hasUnpublishedChanges).toBe(true);
  });

  it("404s for a schedule outside the manager's location", async () => {
    const res = await publishSchedule(
      new Request("http://test/api/schedules/nope/publish", { method: "POST" }),
      { params: Promise.resolve({ scheduleId: "nope" }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("That schedule no longer exists");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/publish-api.test.ts`
Expected: FAIL — cannot resolve the publish route module.

- [ ] **Step 3: Implement `src/app/api/schedules/[scheduleId]/publish/route.ts`**

```ts
import { jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { notifyUsers } from "@/lib/notify";
import { formatDateShort, toISODate } from "@/lib/time";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const guard = await requireManagerForApi();
  if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
  const { scheduleId } = await params;
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, locationId: guard.location.id },
  });
  if (!schedule) return jsonErr("not_found", "That schedule no longer exists", 404);

  // Transaction flips THIS schedule and its draft shifts only — never other
  // weeks. publishedAt is set AFTER the shift updates so freshly published
  // shifts don't read as "edited after publish".
  const employeeUserIds = await prisma.$transaction(async (tx) => {
    await tx.shift.updateMany({
      where: { scheduleId, status: "draft" },
      data: { status: "published" },
    });
    await tx.schedule.update({
      where: { id: scheduleId },
      data: {
        status: "published",
        publishedAt: new Date(),
        publishedByUserId: guard.userId,
      },
    });
    const assigned = await tx.shift.findMany({
      where: { scheduleId, employeeProfileId: { not: null } },
      select: { employeeProfile: { select: { userId: true } } },
    });
    return [...new Set(assigned.map((s) => s.employeeProfile!.userId))];
  });

  const weekLabel = formatDateShort(toISODate(schedule.weekStartDate));
  const { count } = await notifyUsers(
    employeeUserIds.map((userId) => ({
      userId,
      type: "schedule_published" as const,
      title: "New schedule published",
      body: `Your schedule for the week of ${weekLabel} is ready.`,
    })),
  );
  return jsonOk({ count });
}
```

- [ ] **Step 4: Run the API tests to verify they pass**

Run: `npx vitest run src/tests/publish-api.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Implement `src/components/schedule/PublishDialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toaster";

type PublishDialogProps = {
  open: boolean;
  scheduleId: string;
  employeeCount: number;
  isRepublish: boolean;
  onClose: () => void;
};

function employeesPhrase(n: number): string {
  if (n === 0) return "No employees are assigned yet, so no one will be notified.";
  if (n === 1) return "1 employee will be notified.";
  return `${n} employees will be notified.`;
}

export default function PublishDialog({
  open,
  scheduleId,
  employeeCount,
  isRepublish,
  onClose,
}: PublishDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/publish`, { method: "POST" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      onClose();
      const n: number = body.data.count; // the REAL count from the server
      toast({
        tone: "success",
        title: isRepublish ? "Changes published" : "Schedule published",
        description: n === 1 ? "1 employee notified." : `${n} employees notified.`,
      });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't publish schedule",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isRepublish ? "Publish changes?" : "Publish this week's schedule?"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={publishing} onClick={handlePublish}>
            Publish
          </Button>
        </>
      }
    >
      {employeesPhrase(employeeCount)}
    </Dialog>
  );
}
```

- [ ] **Step 6: Wire publish into `ScheduleView.tsx`**

Four exact edits to `src/components/schedule/ScheduleView.tsx`:

1. Add the import (after the `AssignShiftDialog` import):

```tsx
import PublishDialog from "@/components/schedule/PublishDialog";
```

2. Add publish state next to the existing dialog state:

```tsx
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<AssignShiftDialogInitial | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
```

3. Replace the header actions block

```tsx
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => openAdd(null, null)}>
            Add shift
          </Button>
        </div>
```

with (draft → "Publish schedule"; published + changes → "Publish changes"; published + clean → no button):

```tsx
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => openAdd(null, null)}>
            Add shift
          </Button>
          {(data.schedule.status === "draft" || isRepublish) && (
            <Button variant="primary" onClick={() => setPublishOpen(true)}>
              {isRepublish ? "Publish changes" : "Publish schedule"}
            </Button>
          )}
        </div>
```

4. Render the dialog after `<AssignShiftDialog … />` (before the closing `</div>`):

```tsx
      <PublishDialog
        open={publishOpen}
        scheduleId={data.schedule.id}
        employeeCount={data.assignedEmployeeCount}
        isRepublish={isRepublish}
        onClose={() => setPublishOpen(false)}
      />
```

- [ ] **Step 7: Extend the ScheduleView test**

Append to the `ScheduleView header` describe block in `src/components/schedule/ScheduleView.test.tsx`:

```tsx
  it("draft week shows the publish button with the assigned count in the dialog", () => {
    render(<ScheduleView {...baseProps} data={weekData({ assignedEmployeeCount: 3 })} />);
    fireEvent.click(screen.getByText("Publish schedule"));
    expect(screen.getByText("Publish this week's schedule?")).toBeTruthy();
    expect(screen.getByText("3 employees will be notified.")).toBeTruthy();
  });

  it("published week with unpublished changes relabels the button", () => {
    render(
      <ScheduleView
        {...baseProps}
        data={weekData({
          schedule: {
            id: "sched-1",
            status: "published",
            publishedAt: "2026-07-01T12:00:00.000Z",
            hasUnpublishedChanges: true,
          },
        })}
      />,
    );
    expect(screen.getByText("Unpublished changes")).toBeTruthy();
    expect(screen.getByText("Publish changes")).toBeTruthy();
  });

  it("published week with no changes shows no publish button", () => {
    render(
      <ScheduleView
        {...baseProps}
        data={weekData({
          schedule: {
            id: "sched-1",
            status: "published",
            publishedAt: "2026-07-01T12:00:00.000Z",
            hasUnpublishedChanges: false,
          },
        })}
      />,
    );
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.queryByText("Publish schedule")).toBeNull();
    expect(screen.queryByText("Publish changes")).toBeNull();
  });
```

- [ ] **Step 8: Run the component tests to verify they pass**

Run: `npx vitest run src/components/schedule/ScheduleView.test.tsx`
Expected: PASS — 7 tests green.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/schedules src/components/schedule/PublishDialog.tsx src/components/schedule/ScheduleView.tsx src/components/schedule/ScheduleView.test.tsx src/tests/publish-api.test.ts
git commit -m "feat: per-week publish transaction with real notified counts and republish detection"
```

---

### Task 10: Real manager dashboard (`/manager`)

**Files:**
- Create: `src/lib/dashboard-data.ts`
- Create: `src/app/manager/page.tsx` (if Phase 2 left a placeholder page here, replace its contents entirely)
- Create: `src/app/manager/dashboard.module.css`
- Create: `src/app/manager/loading.tsx`
- Create: `src/app/manager/error.tsx`
- Test: `src/lib/dashboard-data.test.ts` (integration)

**Interfaces:**
- Consumes: `requireManager` (`@/lib/auth`), `getManagerLocation` (`@/lib/authz`); `getScheduleWeekData` (Task 4); time helpers (Task 1); `StatCard`, `Card`, `Badge`, `ConflictChip`, `Button`, `EmptyState` primitives (Phase 1); `prisma` (`@/lib/db`); routes `/manager/schedule` (Task 7), `/manager/time-off` and `/manager/swaps` (roadmap route map — Phase 5 builds the pages; the links are pinned now).
- Produces (Phase 5 may reuse):
  ```ts
  // src/lib/dashboard-data.ts
  export type DashboardData = {
    weekStart: ISODate;
    openShiftsThisWeek: number;      // v1 "coverage gaps" = open (unassigned) shifts this week (spec decision #7)
    pendingTimeOff: number;
    pendingSwaps: number;
    pendingClaims: number;
    pendingRequests: number;         // sum of the three
    projectedLaborCost: string;      // "$4,120" | "$0" (no assigned shifts) | "—" (any assignee missing hourlyRate)
    conflictCountThisWeek: number;
    clockedInNow: { name: string; positionName: string | null }[]; // TimeClockEntry clockOutAt = null
  };
  export function getDashboardData(locationId: string, timezone: string): Promise<DashboardData>;
  ```
- Every stat is computed from the DB — the export's hardcoded "2 / 3 / $4,120 / 2" numbers and hardcoded clocked-in list must not survive. Loading via `Suspense` + skeletons; every card has an empty state; action cards are real `<Link>` elements to the pinned routes.

- [ ] **Step 1: Write the failing integration test**

Create `src/lib/dashboard-data.test.ts`:

```ts
import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard-data";

let locationId: string;
let timezone: string;

beforeAll(async () => {
  const jamie = await prisma.user.findUnique({ where: { email: "jamie@harborvine.test" } });
  if (!jamie) throw new Error("Seed data missing. Run: npx prisma db seed");
  const location = await prisma.location.findFirstOrThrow({
    where: { organizationId: jamie.organizationId },
  });
  locationId = location.id;
  timezone = location.timezone;
});

describe("getDashboardData", () => {
  // Seed guarantees exactly one pending time-off, one pending swap, one
  // pending claim. If these fail after manual app use, reset with
  // `npx prisma migrate reset --force`.
  it("counts pending requests from the seed", async () => {
    const data = await getDashboardData(locationId, timezone);
    expect(data.pendingTimeOff).toBe(1);
    expect(data.pendingSwaps).toBe(1);
    expect(data.pendingClaims).toBe(1);
    expect(data.pendingRequests).toBe(3);
  });

  it("computes week-scoped aggregates with valid shapes", async () => {
    const data = await getDashboardData(locationId, timezone);
    expect(data.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.openShiftsThisWeek).toBeGreaterThanOrEqual(0);
    expect(data.conflictCountThisWeek).toBeGreaterThanOrEqual(0);
    // "$4,120"-style, "$0", or an em dash when any rate is missing
    expect(data.projectedLaborCost).toMatch(/^(\$[\d,]+|—)$/);
    expect(Array.isArray(data.clockedInNow)).toBe(true); // seed has no open clock entries
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboard-data.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dashboard-data'`.

- [ ] **Step 3: Implement `src/lib/dashboard-data.ts`**

```ts
import { prisma } from "@/lib/db";
import { getScheduleWeekData } from "@/lib/schedule-data";
import {
  addDaysISO,
  shiftDurationHours,
  weekStartOf,
  type ISODate,
} from "@/lib/time";

export type DashboardData = {
  weekStart: ISODate;
  openShiftsThisWeek: number;
  pendingTimeOff: number;
  pendingSwaps: number;
  pendingClaims: number;
  pendingRequests: number;
  projectedLaborCost: string;
  conflictCountThisWeek: number;
  clockedInNow: { name: string; positionName: string | null }[];
};

export async function getDashboardData(
  locationId: string,
  timezone: string,
): Promise<DashboardData> {
  const weekStart = weekStartOf(new Date(), timezone);
  const weekEnd = addDaysISO(weekStart, 6);

  const [shifts, pendingTimeOff, pendingSwaps, pendingClaims, clockEntries, weekData] =
    await Promise.all([
      prisma.shift.findMany({
        where: { locationId, date: { gte: new Date(weekStart), lte: new Date(weekEnd) } },
        include: { employeeProfile: true },
      }),
      prisma.timeOffRequest.count({
        where: { status: "pending", employeeProfile: { locationId } },
      }),
      prisma.swapRequest.count({ where: { status: "pending", shift: { locationId } } }),
      prisma.openShiftClaim.count({ where: { status: "pending", shift: { locationId } } }),
      prisma.timeClockEntry.findMany({
        where: { locationId, clockOutAt: null },
        include: { employeeProfile: { include: { user: true, primaryPosition: true } } },
        orderBy: { clockInAt: "asc" },
      }),
      getScheduleWeekData(locationId, weekStart), // reuses conflict annotation
    ]);

  const assigned = shifts.filter((s) => s.employeeProfileId !== null);

  // "$4,120"-style. Any assigned shift without a rate makes the projection
  // dishonest, so render an em dash instead of a wrong number.
  let projectedLaborCost = "—";
  if (assigned.length === 0) {
    projectedLaborCost = "$0";
  } else if (assigned.every((s) => s.employeeProfile?.hourlyRate != null)) {
    const total = assigned.reduce(
      (sum, s) =>
        sum + shiftDurationHours(s.startsAt, s.endsAt) * Number(s.employeeProfile!.hourlyRate),
      0,
    );
    projectedLaborCost = `$${Math.round(total).toLocaleString("en-US")}`;
  }

  return {
    weekStart,
    openShiftsThisWeek: shifts.filter((s) => s.employeeProfileId === null).length,
    pendingTimeOff,
    pendingSwaps,
    pendingClaims,
    pendingRequests: pendingTimeOff + pendingSwaps + pendingClaims,
    projectedLaborCost,
    conflictCountThisWeek: weekData.conflictCount,
    clockedInNow: clockEntries.map((e) => ({
      name: e.employeeProfile.user.name,
      positionName: e.employeeProfile.primaryPosition?.name ?? null,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboard-data.test.ts`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Create `src/app/manager/dashboard.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  font-family: var(--font-sans);
}

.heading {
  font-size: var(--text-h1-size);
  font-weight: var(--text-h1-weight);
  color: var(--text-primary);
}

.statRow {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.statRow > * {
  flex: 1;
  min-width: 180px;
}

.cardRow {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.cardLink {
  flex: 1;
  min-width: 240px;
  text-decoration: none;
  color: inherit;
  border-radius: var(--radius-md);
}

.cardLink:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.cardTitle {
  font-weight: 700;
  color: var(--text-primary);
}

.cardBody {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.cardMeta {
  margin-top: 10px;
}

.sectionHeading {
  font-size: var(--text-h3-size);
  font-weight: 700;
  color: var(--text-primary);
}

.clockRow {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.emptyText {
  font-size: 14px;
  color: var(--text-tertiary);
}

.skeleton {
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
  animation: dashboardPulse 1.5s ease-in-out infinite;
}

.skeletonStat {
  composes: skeleton;
  height: 88px;
  flex: 1;
  min-width: 180px;
}

.skeletonCard {
  composes: skeleton;
  height: 120px;
  flex: 1;
  min-width: 240px;
}

@keyframes dashboardPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
```

- [ ] **Step 6: Implement `src/app/manager/page.tsx`**

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { StatCard } from "@/components/ui/StatCard";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getDashboardData } from "@/lib/dashboard-data";
import { localTimeOfDay } from "@/lib/time";
import styles from "./dashboard.module.css";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function ManagerDashboardPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const { hour } = localTimeOfDay(new Date(), location.timezone);
  const firstName = user.name.split(" ")[0];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>
        {greetingFor(hour)}, {firstName}
      </h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent locationId={location.id} timezone={location.timezone} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className={styles.statRow}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonStat} />
        ))}
      </div>
      <div className={styles.cardRow}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    </>
  );
}

async function DashboardContent({
  locationId,
  timezone,
}: {
  locationId: string;
  timezone: string;
}) {
  const data = await getDashboardData(locationId, timezone);

  return (
    <>
      <div className={styles.statRow}>
        {/* StatCard tone is a CSS color token string (inline color) — omit for neutral. */}
        <StatCard
          label="Open shifts this week"
          value={String(data.openShiftsThisWeek)}
          tone={data.openShiftsThisWeek > 0 ? "var(--status-warning)" : undefined}
        />
        <StatCard label="Pending requests" value={String(data.pendingRequests)} />
        <StatCard label="Projected labor cost" value={data.projectedLaborCost} />
        <StatCard
          label="Clocked in now"
          value={String(data.clockedInNow.length)}
          tone={data.clockedInNow.length > 0 ? "var(--status-success)" : undefined}
        />
      </div>

      <div className={styles.cardRow}>
        <Link href="/manager/schedule" className={styles.cardLink}>
          <Card hoverable>
            {data.conflictCountThisWeek > 0 ? (
              <>
                <div className={styles.cardTitle}>
                  {data.conflictCountThisWeek === 1
                    ? "1 shift has a conflict"
                    : `${data.conflictCountThisWeek} shifts have conflicts`}
                </div>
                <div className={styles.cardBody}>
                  Resolve before you publish this week's schedule.
                </div>
                <div className={styles.cardMeta}>
                  <ConflictChip>View in the schedule builder</ConflictChip>
                </div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>No conflicts this week</div>
                <div className={styles.cardBody}>Open the schedule builder to plan ahead.</div>
              </>
            )}
          </Card>
        </Link>

        <Link href="/manager/time-off" className={styles.cardLink}>
          <Card hoverable>
            {data.pendingTimeOff > 0 ? (
              <>
                <div className={styles.cardTitle}>
                  {data.pendingTimeOff === 1
                    ? "1 time-off request waiting"
                    : `${data.pendingTimeOff} time-off requests waiting`}
                </div>
                <div className={styles.cardBody}>Employees are waiting on a decision.</div>
                <div className={styles.cardMeta}>
                  <Badge tone="warning">Needs review</Badge>
                </div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>No time-off requests waiting</div>
                <div className={styles.cardBody}>New requests will show up here.</div>
              </>
            )}
          </Card>
        </Link>

        <Link href="/manager/swaps" className={styles.cardLink}>
          <Card hoverable>
            {data.pendingSwaps + data.pendingClaims > 0 ? (
              <>
                <div className={styles.cardTitle}>
                  {data.pendingSwaps + data.pendingClaims === 1
                    ? "1 swap or claim to review"
                    : `${data.pendingSwaps + data.pendingClaims} swaps and claims to review`}
                </div>
                <div className={styles.cardBody}>Shift swaps and open-shift claims need approval.</div>
                <div className={styles.cardMeta}>
                  <Badge tone="info">Needs review</Badge>
                </div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>No swaps or claims waiting</div>
                <div className={styles.cardBody}>Swap requests and claims will show up here.</div>
              </>
            )}
          </Card>
        </Link>
      </div>

      <h2 className={styles.sectionHeading}>Clocked in now</h2>
      {data.clockedInNow.length === 0 ? (
        <p className={styles.emptyText}>No one is clocked in right now.</p>
      ) : (
        <div className={styles.clockRow}>
          {data.clockedInNow.map((entry) => (
            <Card key={entry.name}>
              <div className={styles.cardTitle}>{entry.name}</div>
              <div className={styles.cardBody}>{entry.positionName ?? "No primary position"}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 7: Implement `src/app/manager/loading.tsx` and `src/app/manager/error.tsx`**

`src/app/manager/loading.tsx`:

```tsx
import { Spinner } from "@/components/ui/Spinner";
import styles from "./dashboard.module.css";

export default function ManagerLoading() {
  return (
    <div className={styles.page} role="status" aria-label="Loading">
      <Spinner />
    </div>
  );
}
```

`src/app/manager/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ManagerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="Something went wrong loading this page"
      description="Check your connection and try again."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
```

- [ ] **Step 8: Verify in the browser and run the suite**

Run: `npm run dev`, sign in as `jamie@harborvine.test`, open `http://localhost:3000/manager`.
Expected: greeting matches the New York time of day; stat cards show real numbers (Pending requests = 3 from seed); the conflicts card links to `/manager/schedule`; "Clocked in now" shows "No one is clocked in right now."; the labor-cost card shows a `$N,NNN` figure (seed sets rates) or `—` if any rate is missing.

Run: `npx vitest run`
Expected: entire suite green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/dashboard-data.ts src/lib/dashboard-data.test.ts src/app/manager/page.tsx src/app/manager/dashboard.module.css src/app/manager/loading.tsx src/app/manager/error.tsx
git commit -m "feat: manager dashboard with real week aggregates, suspense skeletons, empty states"
```

---

### Task 11: End-of-phase verification + manual QA

**Files:** none created — this task runs the phase gates.

**Interfaces:**
- Consumes: everything above; seed credentials `jamie@harborvine.test` / `rosterhouse1`.
- Produces: a verified Phase 3 — Phase 4 (employee app) builds on the published schedule + Notification rows this phase writes.

- [ ] **Step 1: Full automated gate**

```bash
docker compose up -d && npx prisma migrate reset --force && npx vitest run && npm run build
```

Expected: reset reseeds cleanly; every test file green (`time`, `conflicts`, `conflict-context`, `shifts-api`, `AssignShiftDialog`, `grids`, `ScheduleView`, `notify`, `publish-api`, `dashboard-data`); build succeeds listing `/manager`, `/manager/schedule`, and the five API routes.

- [ ] **Step 2: Manual QA walkthrough (`npm run dev`, or the `/qa` skill against it)**

1. Log in as `jamie@harborvine.test` / `rosterhouse1` → lands on `/manager` with a time-of-day greeting for Jamie and REAL stats (Pending requests = 3).
2. Open Schedule → the real current week loads (not July 2026 unless it is); Draft/Published badge matches the seed for this week; navigate prev/next and back with "Today".
3. Find the seeded double-booking (current or next week): its ShiftBlock renders conflict styling and the header chip counts it.
4. Click an empty cell → dialog opens prefilled with that position + day; pick an employee already working that day and overlapping times → conflict chip appears in the dialog BEFORE saving (debounced); pick boundary-adjacent times (start = other shift's end) → chip disappears.
5. Save with a note → toast "Shift added", grid refreshes with the draft shift; reopen it → times and note round-trip; header "Add shift" button opens the same dialog with position/day selects (the export's dead button now works).
6. Enter "13:00 PM" in a TimeField and save → inline "Enter a time like 7:00 AM", no request sent.
7. Day and Month tabs: day view groups by position; month view shows per-day count badges; clicking a month day jumps to that day view.
8. On the draft (next) week press "Publish schedule" → dialog says "N employees will be notified." with the real distinct count → Publish → toast "Schedule published / N employees notified." with the SAME number; badge flips to Published and the publish button disappears.
9. Verify fan-out: dev-server console shows `[notify] sms → …` / `[notify] push → …` lines, and `npx prisma studio` → `Notification` table has `schedule_published` rows for exactly those N users.
10. Edit any shift on the published week → header shows "Unpublished changes" badge and the button reads "Publish changes"; republishing clears both.
11. Check states: `/manager` and `/manager/schedule` show spinner/skeleton while loading; an empty far-future week shows the empty-state banner with working add buttons; stop Postgres (`docker compose stop db`) and reload → the error state with "Try again" renders (then `docker compose start db`).

- [ ] **Step 3: Confirm clean history**

```bash
git status && git log --oneline -12
```

Expected: working tree clean; one commit per task (11 including this phase's fixes, if any).

- [ ] **Step 4: Commit any QA fixes**

If QA surfaced fixes, commit them as `fix: <specific issue found in phase 3 QA>` before closing the phase.

---

## Self-review notes (already applied)

- **Task order vs. the roadmap task list:** notify (Task 8) lands before publish (Task 9) because publish calls `notifyUsers`; the dialog (Task 5) and grids (Task 6) land before the page (Task 7) that composes them, so every task builds green in isolation.
- **`buildConflictContext` module path:** lives in `@/lib/conflict-context` (not `@/lib/conflicts`) to keep the conflicts module prisma-free for unit tests and client type-imports. Signature is exactly the roadmap's. Phase 5 must import it from `@/lib/conflict-context`.
- **Integration tests never mutate seed weeks destructively:** they build fixture weeks 21/40/41/50 weeks out and clean up after themselves; only `dashboard-data.test.ts` asserts raw seed counts (reset instructions included in the test comment).
- **Type consistency spot-checks:** `ScheduleShift.timeRange` split on `" – "` in `openEdit` matches `formatShiftRange`'s en-dash format; `uiStatus` values match `ShiftBlock.status`'s union; `AssignShiftDialogInitial` field names match between Tasks 5/7; `assignedEmployeeCount` flows Task 4 → Task 9's PublishDialog.
