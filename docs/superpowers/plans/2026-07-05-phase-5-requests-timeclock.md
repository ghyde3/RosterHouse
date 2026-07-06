# Phase 5 — Requests & Time Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every request loop end-to-end — time-off requests, swap requests (including the net-new composer), open-shift claims, a geolocated time clock — with manager approvals, transactional decisions, and notification fan-out for every outcome.

**Architecture:** Route-handler API under `/api` (zod-validate → authenticate → tenancy check → act → typed JSON envelope); server components read via `src/lib` query helpers; client components mutate via `fetch` + toast + `router.refresh()`. Approvals are Prisma transactions with guard clauses (`updateMany where status: "pending"`); conflicts are recomputed after approval and returned as a `warnings` array, never stored. Notifications go through the Phase 3 `notifyUsers` fan-out (in-app rows + ConsoleDriver).

**Tech stack:** Next.js 16.2 App Router / React 19 / TypeScript · Prisma 7 + `@prisma/adapter-pg` (client at `@/generated/prisma/client`, singleton at `@/lib/db`) · zod@4 · date-fns@4 + `@date-fns/tz` · vitest (integration tests against the docker Postgres) · design-token CSS (no Tailwind).

## Global Constraints

- Copy rules: sentence case everywhere; 12-hour times ("7:00 AM – 3:00 PM", en dash with spaces, never military); durations as "8 hrs"; no emoji in UI chrome; calm confirmations (no exclamation points); errors specific and actionable, never blaming.
- Styling: design tokens only — no raw hex colors, no font-family other than Figtree (`var(--font-sans)`). Hover/press via CSS `:hover`/`:active` classes (CSS Modules), not JS state. Focus states use `--shadow-focus`.
- All interactive elements are real `<button>`/`<a>`/`<input>` elements with keyboard focus — never onClick divs.
- Weeks start Monday. `Location.timezone` (IANA) drives all wall-clock rendering; shifts store UTC instants (`startsAt`/`endsAt`) plus a location-local service `date`.
- Every screen ships loading, empty, and error states.
- Every API handler: zod-validate input → authenticate → tenancy check → act → typed JSON (`{ ok: true, data }` / `{ ok: false, error: { code, message } }` via `jsonOk`/`jsonErr` from `@/lib/api`).
- Server code imports prisma from `@/lib/db`. Prisma types/enums import from `@/generated/prisma/client`.
- Test-first (vitest) for `src/lib` logic; route handlers get integration tests against the docker Postgres (`docker compose up -d` first). Run a single file with `npx vitest run <file>`.
- Commit at the end of every task. Conflicts are computed, never stored.

## Prerequisites (already done — do not redo)

- Phases 1–4 are merged: UI primitives in `src/components/ui/`, auth/authz in `src/lib/auth.ts` + `src/lib/authz.ts`, `src/lib/time.ts`, `src/lib/conflicts.ts` + `src/lib/conflict-context.ts`, `src/lib/notify/` (console driver), `src/lib/api.ts`, `src/lib/flags.ts`, manager + employee route groups, seed data (`npx prisma db seed`).
- `prisma/schema.prisma` is complete and migrated. Never edit the schema in this phase.
- Local Postgres: `docker compose up -d` from the repo root.

## Pinned contracts consumed from earlier phases

These exist already; use them verbatim (signatures from the roadmap's shared contracts):

```ts
// @/lib/auth
export const { handlers, auth, signIn, signOut }: NextAuthResult; // session.user: { id, name, role: 'manager'|'employee', organizationId }
requireUser(): Promise<SessionUser>;    // pages; redirect('/login') if absent
requireManager(): Promise<SessionUser>; // pages; + redirect('/') if employee

// @/lib/authz
getManagerLocation(userId: string): Promise<Location>;
getEmployeeProfile(userId: string): Promise<EmployeeProfile & { location: Location; primaryPosition: Position | null }>;
assertLocationMember(userId: string, locationId: string): Promise<void>;

// @/lib/api
jsonOk(data): Response; jsonErr(code: string, message: string, status: number): Response;

// @/lib/time
type ISODate = string; // "2026-07-06"
weekStartOf(d: Date, timezone: string): ISODate;
addDaysISO(d: ISODate, n: number): ISODate;
localToUtc(date: ISODate, time: {hour:number;minute:number}, timezone: string): Date;
formatTime(instant: Date, timezone: string): string;
formatShiftRange(startsAt: Date, endsAt: Date, timezone: string): string; // "7:00 AM – 3:00 PM"
shiftDurationHours(startsAt: Date, endsAt: Date): number;
formatDurationHrs(hours: number): string; // "8 hrs", "7.5 hrs"

// @/lib/conflicts  (pure module — no prisma)
type ConflictKind = 'double_booked' | 'outside_availability' | 'overtime';
type Conflict = { kind: ConflictKind; message: string };
detectConflicts(shift: ProposedShift, ctx: ConflictContext): Conflict[];

// @/lib/conflict-context  (prisma-backed; Phase 3 deliberately ships this in its
// own module to keep @/lib/conflicts prisma-free — import it from HERE, not from @/lib/conflicts)
buildConflictContext(employeeProfileId: string, weekStart: ISODate): Promise<ConflictContext>;

// @/lib/notify
type NotifyInput = { userId: string; type: NotificationType; title: string; body: string };
notifyUsers(inputs: NotifyInput[]): Promise<{ count: number }>;
interface ChannelDriver { sendSms(phone, body): Promise<void>; sendPush(deviceToken, payload): Promise<void>; }

// @/lib/flags  (Phase 4)
export const SWAPS_ENABLED: boolean;    // currently false; Task 8 flips it to true
export const TIME_OFF_ENABLED: boolean; // currently false; Task 6 flips it to true

// UI primitives (@/components/ui/<Name>) — ported .d.ts props + className/rest/ref:
// Button({ variant?: 'primary'|'secondary'|'ghost'|'accent'|'danger', size?: 'sm'|'md'|'lg', disabled?, icon?, fullWidth?, children, onClick?, type? })
// Badge({ tone?: 'success'|'warning'|'danger'|'info'|'neutral', children })
// Card({ children, padding?, hoverable?, style? })
// Dialog({ open, onClose?, title?, children, footer? })
// Input({ label?, placeholder?, value?, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, type?, error?, disabled?, icon? })
// Select({ label?, value?, onChange?: (value: string) => void, options?: {value,label}[], placeholder? })
// Net-new Phase 1 primitives (assumed props — see note below):
// Sheet({ open, onClose, title?, children, footer? })   — mobile bottom sheet, Dialog-shaped API
// Textarea({ label?, placeholder?, value?, onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, rows?, error? })
// useToast(): { toast(t: { tone?: 'success'|'warning'|'danger'|'info'; title: string; description?: string }): void }  — from @/components/ui/Toaster
// EmptyState({ title, description?, icon? }); Spinner({ size? }); Icon({ name: string, size?, className? })
```

> **If a net-new primitive's props differ from the assumed shape above** (Sheet, Textarea, Toaster/useToast, EmptyState, Spinner, Icon): open `src/components/ui/<Name>.tsx`, read its props, and adapt the call site in your task. Never edit the primitive.

Seed logins for manual QA: manager `jamie@harborvine.test` / `rosterhouse1`; employee `maria@harborvine.test` / `rosterhouse1`.

---

### Task 1: Date-label helpers in `src/lib/time.ts`

The request loops render calendar-date labels the roadmap didn't pin: "Sat Jul 12" (single day) and "Jul 14 – Jul 16" (range, en dash with spaces, collapsing to "Jul 20" when start = end). Add two pure helpers to the existing time library.

**Files:**
- Modify: `src/lib/time.ts` (append two exports at the end of the file)
- Test: `src/lib/time.datelabels.test.ts` (new file — do not touch Phase 3's existing time tests)

**Interfaces:**
- Consumes: `date-fns@4` (`format`, `parseISO`); existing `src/lib/time.ts` (its `ISODate = string` convention).
- Produces (all later tasks in this phase use these):
  - `formatMediumDate(d: ISODate): string` → `"Sat Jul 12"`
  - `formatDateRange(start: ISODate, end: ISODate): string` → `"Jul 14 – Jul 16"`, or `"Jul 20"` when equal

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/time.datelabels.test.ts
import { describe, expect, it } from "vitest";
import { formatDateRange, formatMediumDate } from "@/lib/time";

describe("formatMediumDate", () => {
  it("formats an ISO date as weekday + month + day", () => {
    expect(formatMediumDate("2026-07-12")).toBe("Sun Jul 12");
    expect(formatMediumDate("2026-07-06")).toBe("Mon Jul 6");
  });
});

describe("formatDateRange", () => {
  it("formats a multi-day range with a spaced en dash", () => {
    expect(formatDateRange("2026-07-14", "2026-07-16")).toBe("Jul 14 – Jul 16");
  });
  it("collapses a single-day range to one date", () => {
    expect(formatDateRange("2026-07-20", "2026-07-20")).toBe("Jul 20");
  });
  it("spans months", () => {
    expect(formatDateRange("2026-07-30", "2026-08-02")).toBe("Jul 30 – Aug 2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/time.datelabels.test.ts`
Expected: FAIL — `formatMediumDate` / `formatDateRange` are not exported from `@/lib/time`.

- [ ] **Step 3: Write minimal implementation**

Append to the end of `src/lib/time.ts` (keep every existing export untouched):

```ts
// --- Calendar-date labels (Phase 5) ------------------------------------
// These format pure calendar dates (ISODate strings), so no timezone is
// involved — parseISO gives local midnight and format reads it back out.

export function formatMediumDate(d: ISODate): string {
  return format(parseISO(d), "EEE MMM d"); // "Sat Jul 12"
}

export function formatDateRange(start: ISODate, end: ISODate): string {
  const label = (x: ISODate) => format(parseISO(x), "MMM d");
  return start === end ? label(start) : `${label(start)} – ${label(end)}`;
}
```

If `format` / `parseISO` are not already imported at the top of `src/lib/time.ts`, extend the existing date-fns import: `import { format, parseISO } from "date-fns";` (merge with whatever is already imported from `"date-fns"` — one import statement, no duplicates).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/time.datelabels.test.ts`
Expected: PASS (5 tests). Also run `npx vitest run src/lib` to confirm Phase 3's time/conflict tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts src/lib/time.datelabels.test.ts
git commit -m "feat: add calendar-date label helpers to time lib"
```

---

### Task 2: Integration-test harness (fixture factory + auth mock)

Every API integration test in this phase needs (a) an isolated org/location/employee tree in the real docker Postgres, and (b) a mocked Auth.js session. Build both once, with a smoke test.

**Files:**
- Create: `src/tests/helpers/factory.ts`
- Create: `src/tests/helpers/auth.ts`
- Test: `src/tests/factory.smoke.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `localToUtc`, `weekStartOf` from `@/lib/time`; `TZDate` from `@date-fns/tz`; `addDays`, `format` from `date-fns`; `auth` from `@/lib/auth` (mock target); Prisma models exactly as in `prisma/schema.prisma` (`Organization`, `Location`, `Position`, `User`, `EmployeeProfile`, `EmployeePosition`, `Schedule`, `Shift`).
- Produces (every integration-test task consumes these):
  - `createFixture(): Promise<Fixture>` — `Fixture = { orgId, locationId, timezone, managerUserId, managerName, positionIds: { server, dishwasher }, ana, ben, cal }` where each employee is `{ userId, profileId, name }`. Ana + Cal are Server-qualified; Ben is Server + Dishwasher.
  - `destroyFixture(f: Fixture): Promise<void>` — cascade-deletes the whole tree.
  - `isoDateFromNow(days: number, timezone: string): ISODate`
  - `createShift(f, { positionId, employeeProfileId, daysFromNow, startHour, endHour, status?, scheduleStatus? }): Promise<Shift>` — location-local hours on a future date; defaults `status: "published"`, `scheduleStatus: "published"`.
  - `createShiftAt(f, { positionId, employeeProfileId, startsAt, endsAt, status? }): Promise<Shift>` — exact UTC instants (for time-clock "now" tests).
  - `signInAs(userId, { role, organizationId, name? })` from `src/tests/helpers/auth.ts` — points the mocked `auth()` at a user. Requires the test file to declare the `vi.mock("@/lib/auth", ...)` block shown below.

- [ ] **Step 1: Write the factory**

```ts
// src/tests/helpers/factory.ts
import { prisma } from "@/lib/db";
import { localToUtc, weekStartOf } from "@/lib/time";
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import type { Shift } from "@/generated/prisma/client";

export type TestEmployee = { userId: string; profileId: string; name: string };

export type Fixture = {
  orgId: string;
  locationId: string;
  timezone: string;
  managerUserId: string;
  managerName: string;
  positionIds: { server: string; dishwasher: string };
  ana: TestEmployee; // Server
  ben: TestEmployee; // Server + Dishwasher
  cal: TestEmployee; // Server
};

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${seq}`;
}

export async function createFixture(): Promise<Fixture> {
  const timezone = "America/New_York";
  const org = await prisma.organization.create({ data: { name: uniq("Test org") } });
  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Test location",
      timezone,
      latitude: 40.7128,
      longitude: -74.006,
      geofenceRadiusM: 150,
      overtimeHoursPerWeek: 40,
    },
  });
  const server = await prisma.position.create({
    data: { locationId: location.id, name: "Server", sortOrder: 0 },
  });
  const dishwasher = await prisma.position.create({
    data: { locationId: location.id, name: "Dishwasher", sortOrder: 1 },
  });
  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Test Manager",
      email: `${uniq("mgr")}@example.test`,
      passwordHash: "test-only-not-a-real-hash",
      role: "manager",
    },
  });

  async function employee(name: string, positionIds: string[]): Promise<TestEmployee> {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        name,
        email: `${uniq("emp")}@example.test`,
        passwordHash: "test-only-not-a-real-hash",
        role: "employee",
      },
    });
    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        locationId: location.id,
        primaryPositionId: positionIds[0],
        status: "active",
        positions: { create: positionIds.map((positionId) => ({ positionId })) },
      },
    });
    return { userId: user.id, profileId: profile.id, name };
  }

  const ana = await employee("Ana Diaz", [server.id]);
  const ben = await employee("Ben Cho", [server.id, dishwasher.id]);
  const cal = await employee("Cal Ito", [server.id]);

  return {
    orgId: org.id,
    locationId: location.id,
    timezone,
    managerUserId: manager.id,
    managerName: "Test Manager",
    positionIds: { server: server.id, dishwasher: dishwasher.id },
    ana,
    ben,
    cal,
  };
}

export async function destroyFixture(f: Fixture): Promise<void> {
  // Organization delete cascades to locations, users, profiles, schedules,
  // shifts, requests, claims, clock entries, and notifications.
  await prisma.organization.delete({ where: { id: f.orgId } });
}

export function isoDateFromNow(days: number, timezone: string): string {
  return format(addDays(TZDate.tz(timezone), days), "yyyy-MM-dd");
}

async function upsertSchedule(f: Fixture, startsAt: Date, scheduleStatus: "draft" | "published") {
  const weekStart = weekStartOf(startsAt, f.timezone);
  return prisma.schedule.upsert({
    where: { locationId_weekStartDate: { locationId: f.locationId, weekStartDate: new Date(weekStart) } },
    create: { locationId: f.locationId, weekStartDate: new Date(weekStart), status: scheduleStatus },
    update: {},
  });
}

export async function createShift(
  f: Fixture,
  opts: {
    positionId: string;
    employeeProfileId: string | null;
    daysFromNow: number;
    startHour: number; // 0-23, location-local
    endHour: number; // 0-23, location-local, same day
    status?: "draft" | "published";
    scheduleStatus?: "draft" | "published";
  },
): Promise<Shift> {
  const date = isoDateFromNow(opts.daysFromNow, f.timezone);
  const startsAt = localToUtc(date, { hour: opts.startHour, minute: 0 }, f.timezone);
  const endsAt = localToUtc(date, { hour: opts.endHour, minute: 0 }, f.timezone);
  const schedule = await upsertSchedule(f, startsAt, opts.scheduleStatus ?? "published");
  return prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      locationId: f.locationId,
      positionId: opts.positionId,
      employeeProfileId: opts.employeeProfileId,
      date: new Date(date),
      startsAt,
      endsAt,
      status: opts.status ?? "published",
    },
  });
}

export async function createShiftAt(
  f: Fixture,
  opts: {
    positionId: string;
    employeeProfileId: string | null;
    startsAt: Date;
    endsAt: Date;
    status?: "draft" | "published";
  },
): Promise<Shift> {
  const date = format(new TZDate(opts.startsAt, f.timezone), "yyyy-MM-dd");
  const schedule = await upsertSchedule(f, opts.startsAt, "published");
  return prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      locationId: f.locationId,
      positionId: opts.positionId,
      employeeProfileId: opts.employeeProfileId,
      date: new Date(date),
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      status: opts.status ?? "published",
    },
  });
}
```

- [ ] **Step 2: Write the auth mock helper**

```ts
// src/tests/helpers/auth.ts
// Usage: the TEST FILE must declare this hoisted mock BEFORE its imports run:
//
//   vi.mock("@/lib/auth", () => ({
//     auth: vi.fn(),
//     requireUser: vi.fn(),
//     requireManager: vi.fn(),
//     signIn: vi.fn(),
//     signOut: vi.fn(),
//     handlers: {},
//   }));
//
// Then call signInAs(...) inside the test to choose the session user.
import { vi } from "vitest";
import { auth } from "@/lib/auth";

export function signInAs(
  userId: string,
  opts: { role: "manager" | "employee"; organizationId: string; name?: string },
): void {
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, name: opts.name ?? "Test User", role: opts.role, organizationId: opts.organizationId },
  } as never);
}

export function signOutAll(): void {
  vi.mocked(auth).mockResolvedValue(null as never);
}
```

- [ ] **Step 3: Write the smoke test**

```ts
// src/tests/factory.smoke.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createFixture, createShift, destroyFixture } from "./helpers/factory";

describe("integration-test factory", () => {
  it("creates and destroys an isolated org tree", async () => {
    const f = await createFixture();
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 3,
      startHour: 16,
      endHour: 22,
    });
    expect(shift.status).toBe("published");
    expect(await prisma.employeeProfile.count({ where: { locationId: f.locationId } })).toBe(3);
    await destroyFixture(f);
    expect(await prisma.shift.findUnique({ where: { id: shift.id } })).toBeNull();
  });
});
```

- [ ] **Step 4: Run the smoke test**

Ensure Postgres is up first: `docker compose up -d`

Run: `npx vitest run src/tests/factory.smoke.test.ts`
Expected: PASS (1 test). Phase 1's `vitest.setup.ts` loads `.env` via `import "dotenv/config"` as its first line, so `DATABASE_URL` reaches the Prisma client in tests. If it fails with a connection error, the docker Postgres isn't running or `.env` is missing `DATABASE_URL` — fix the environment, not the code.

- [ ] **Step 5: Commit**

```bash
git add src/tests/helpers/factory.ts src/tests/helpers/auth.ts src/tests/factory.smoke.test.ts
git commit -m "test: add phase-5 integration fixture factory and auth mock"
```

---

### Task 3: Time-off API — create + list (`POST /api/time-off`, `GET /api/locations/[locationId]/time-off`)

**Files:**
- Create: `src/lib/api-session.ts`
- Create: `src/lib/requests.ts`
- Create: `src/app/api/time-off/route.ts`
- Create: `src/app/api/locations/[locationId]/time-off/route.ts`
- Test: `src/tests/time-off-create.api.test.ts`

**Interfaces:**
- Consumes: `jsonOk`/`jsonErr` (`@/lib/api`); `auth` (`@/lib/auth`); `getEmployeeProfile`, `getManagerLocation` (`@/lib/authz`); `prisma` (`@/lib/db`); `formatDateRange` (Task 1); factory + `signInAs` (Task 2).
- Produces:
  - `sessionUser(): Promise<SessionUser | null>` and `type SessionUser = { id: string; name: string; role: "manager" | "employee"; organizationId: string }` from `@/lib/api-session` — every API task in this phase uses it.
  - `isoDateOf(d: Date): ISODate` from `@/lib/requests` (Prisma `@db.Date` → "YYYY-MM-DD").
  - `REASON_LABELS: Record<'vacation'|'sick'|'personal'|'other', string>` from `@/lib/requests`.
  - `type TimeOffItem = { id; employeeName; startDate; endDate; rangeLabel; reason; reasonLabel; note; status; createdAt; decidedAt }` from `@/lib/requests`.
  - `listTimeOff(locationId: string, status: "pending"|"approved"|"denied"|"cancelled"): Promise<TimeOffItem[]>`
  - `listMyTimeOffRequests(employeeProfileId: string): Promise<TimeOffItem[]>`
  - `listDecidedTimeOff(locationId: string): Promise<TimeOffItem[]>` (approved/denied decided in the last 30 days, newest first)
  - `POST /api/time-off` — body `{ startDate: "YYYY-MM-DD", endDate, reason: 'vacation'|'sick'|'personal'|'other', note?: string }`; 200 → `{ ok: true, data: { id, status: "pending" } }`.
  - `GET /api/locations/[locationId]/time-off?status=pending` — manager-only; 200 → `{ ok: true, data: { requests: TimeOffItem[] } }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/time-off-create.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/time-off/route";
import { GET } from "@/app/api/locations/[locationId]/time-off/route";
import { createFixture, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function postReq(body: unknown): Request {
  return new Request("http://test/api/time-off", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/time-off", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("creates a pending request for the signed-in employee", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId, name: f.ana.name });
    const start = isoDateFromNow(7, f.timezone);
    const end = isoDateFromNow(9, f.timezone);
    const res = await POST(postReq({ startDate: start, endDate: end, reason: "vacation" }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("pending");
    const row = await prisma.timeOffRequest.findUnique({ where: { id: json.data.id } });
    expect(row?.employeeProfileId).toBe(f.ana.profileId);
  });

  it("rejects endDate before startDate with a specific message", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(
      postReq({ startDate: isoDateFromNow(9, f.timezone), endDate: isoDateFromNow(7, f.timezone), reason: "vacation" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe("End date must be on or after the start date.");
  });

  it("requires a note when reason is other", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const d = isoDateFromNow(7, f.timezone);
    const res = await POST(postReq({ startDate: d, endDate: d, reason: "other" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe("Tell your manager why you need this time off.");
  });

  it("rejects signed-out callers", async () => {
    const { signOutAll } = await import("./helpers/auth");
    signOutAll();
    const d = isoDateFromNow(7, f.timezone);
    const res = await POST(postReq({ startDate: d, endDate: d, reason: "sick" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/locations/[locationId]/time-off", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ben.profileId,
        startDate: new Date(isoDateFromNow(10, f.timezone)),
        endDate: new Date(isoDateFromNow(11, f.timezone)),
        reason: "personal",
      },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("returns pending requests with names and range labels to the manager", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/time-off?status=pending`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.requests).toHaveLength(1);
    expect(json.data.requests[0].employeeName).toBe("Ben Cho");
    expect(json.data.requests[0].rangeLabel).toContain("–");
    expect(json.data.requests[0].status).toBe("pending");
  });

  it("rejects employees", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/time-off`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/time-off-create.api.test.ts`
Expected: FAIL — cannot resolve `@/app/api/time-off/route` (module does not exist yet).

- [ ] **Step 3: Implement the session helper**

```ts
// src/lib/api-session.ts
// Session accessor for API route handlers. Pages use requireUser()/
// requireManager() (which redirect); API handlers must return JSON errors
// instead, so they null-check this and reply 401/403 themselves.
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  role: "manager" | "employee";
  organizationId: string;
};

export async function sessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as Partial<SessionUser> | undefined;
  if (!user?.id || !user.role || !user.organizationId) return null;
  return user as SessionUser;
}
```

- [ ] **Step 4: Implement the query helpers**

```ts
// src/lib/requests.ts
// Read-model helpers for the request loops (time off, swaps, claims).
// Server components call these directly; API routes wrap them.
import { prisma } from "@/lib/db";
import { formatDateRange } from "@/lib/time";
import { subDays } from "date-fns";
import type { RequestStatus, TimeOffReason } from "@/generated/prisma/client";

export function isoDateOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const REASON_LABELS: Record<TimeOffReason, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

export type TimeOffItem = {
  id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  reason: TimeOffReason;
  reasonLabel: string;
  note: string | null;
  status: RequestStatus;
  createdAt: string;
  decidedAt: string | null;
};

type TimeOffRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: TimeOffReason;
  note: string | null;
  status: RequestStatus;
  createdAt: Date;
  decidedAt: Date | null;
  employeeProfile: { user: { name: string } };
};

function toTimeOffItem(row: TimeOffRow): TimeOffItem {
  const startDate = isoDateOf(row.startDate);
  const endDate = isoDateOf(row.endDate);
  return {
    id: row.id,
    employeeName: row.employeeProfile.user.name,
    startDate,
    endDate,
    rangeLabel: formatDateRange(startDate, endDate),
    reason: row.reason,
    reasonLabel: REASON_LABELS[row.reason],
    note: row.note,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

const timeOffInclude = { employeeProfile: { include: { user: true } } } as const;

export async function listTimeOff(locationId: string, status: RequestStatus): Promise<TimeOffItem[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: { status, employeeProfile: { locationId } },
    include: timeOffInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTimeOffItem);
}

export async function listMyTimeOffRequests(employeeProfileId: string): Promise<TimeOffItem[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: { employeeProfileId },
    include: timeOffInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toTimeOffItem);
}

export async function listDecidedTimeOff(locationId: string): Promise<TimeOffItem[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: {
      employeeProfile: { locationId },
      status: { in: ["approved", "denied"] },
      decidedAt: { gte: subDays(new Date(), 30) },
    },
    include: timeOffInclude,
    orderBy: { decidedAt: "desc" },
  });
  return rows.map(toTimeOffItem);
}
```

- [ ] **Step 5: Implement `POST /api/time-off`**

```ts
// src/app/api/time-off/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createTimeOffSchema = z
  .object({
    startDate: z.string().regex(ISO_DATE, { message: "Start date must be a date like 2026-07-14." }),
    endDate: z.string().regex(ISO_DATE, { message: "End date must be a date like 2026-07-16." }),
    reason: z.enum(["vacation", "sick", "personal", "other"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endDate < val.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
    }
    if (val.reason === "other" && !val.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Tell your manager why you need this time off." });
    }
  });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Check the request details and try again.", 400);
  }

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profileId: string;
  try {
    profileId = (await getEmployeeProfile(user.id)).id;
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const created = await prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      reason: parsed.data.reason,
      note: parsed.data.note || null,
    },
  });
  return jsonOk({ id: created.id, status: created.status });
}
```

- [ ] **Step 6: Implement `GET /api/locations/[locationId]/time-off`**

```ts
// src/app/api/locations/[locationId]/time-off/route.ts
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { listTimeOff } from "@/lib/requests";

const statusSchema = z.enum(["pending", "approved", "denied", "cancelled"]);

export async function GET(req: Request, ctx: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await ctx.params;
  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  const status = statusSchema.safeParse(raw);
  if (!status.success) {
    return jsonErr("invalid_input", "Status must be pending, approved, denied, or cancelled.", 400);
  }

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can view time-off requests.", 403);

  const managerLocation = await getManagerLocation(user.id);
  if (managerLocation.id !== locationId) return jsonErr("forbidden", "You don't manage this location.", 403);

  return jsonOk({ requests: await listTimeOff(locationId, status.data) });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/tests/time-off-create.api.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/api-session.ts src/lib/requests.ts src/app/api/time-off/route.ts "src/app/api/locations/[locationId]/time-off/route.ts" src/tests/time-off-create.api.test.ts
git commit -m "feat: time-off request creation and manager listing API"
```

---
### Task 4: Time-off decision API (`PATCH /api/time-off/[requestId]`)

Approve/deny in a transaction with a pending-only guard, then notify the employee with calm copy. A deny may carry an optional manager note that is appended to the notification body.

**Files:**
- Create: `src/app/api/time-off/[requestId]/route.ts`
- Test: `src/tests/time-off-decision.api.test.ts`

**Interfaces:**
- Consumes: `sessionUser` (`@/lib/api-session`, Task 3); `getManagerLocation` (`@/lib/authz`); `notifyUsers` (`@/lib/notify`); `formatDateRange` (Task 1); `isoDateOf` (`@/lib/requests`, Task 3); factory + `signInAs` (Task 2); `jsonOk`/`jsonErr`.
- Produces: `PATCH /api/time-off/[requestId]` — body `{ decision: "approve" | "deny", note?: string }`; 200 → `{ ok: true, data: { status: "approved" | "denied" } }`; 409 `already_decided` when not pending. Notification types used: `timeoff_approved`, `timeoff_denied`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/time-off-decision.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { PATCH } from "@/app/api/time-off/[requestId]/route";
import { createFixture, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(body: unknown): Request {
  return new Request("http://test/api/time-off/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function makeRequest(f: Fixture, profileId: string) {
  return prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileId,
      startDate: new Date(isoDateFromNow(14, f.timezone)),
      endDate: new Date(isoDateFromNow(16, f.timezone)),
      reason: "vacation",
    },
  });
}

describe("PATCH /api/time-off/[requestId]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approves in a transaction and notifies the employee", async () => {
    const request = await makeRequest(f, f.ana.profileId);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");

    const row = await prisma.timeOffRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe("approved");
    expect(row.decidedByUserId).toBe(f.managerUserId);
    expect(row.decidedAt).not.toBeNull();

    const note = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "timeoff_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.title).toBe("Time off approved");
    expect(note?.body).toContain("–"); // contains the date range
  });

  it("denies with an optional note appended to the notification body", async () => {
    const request = await makeRequest(f, f.ben.profileId);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "deny", note: "That week is fully booked already." }), {
      params: Promise.resolve({ requestId: request.id }),
    });
    expect((await res.json()).data.status).toBe("denied");

    const note = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "timeoff_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.body).toContain("Note from your manager: That week is fully booked already.");
  });

  it("returns 409 when the request was already decided", async () => {
    const request = await makeRequest(f, f.cal.profileId);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    const res = await PATCH(patchReq({ decision: "deny" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_decided");
  });

  it("rejects employees", async () => {
    const request = await makeRequest(f, f.ana.profileId);
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/time-off-decision.api.test.ts`
Expected: FAIL — cannot resolve `@/app/api/time-off/[requestId]/route`.

- [ ] **Step 3: Implement the handler**

```ts
// src/app/api/time-off/[requestId]/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { notifyUsers } from "@/lib/notify";
import { formatDateRange } from "@/lib/time";
import { isoDateOf } from "@/lib/requests";

const decisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide time-off requests.", 403);

  const request = await prisma.timeOffRequest.findUnique({
    where: { id: requestId },
    include: { employeeProfile: { include: { user: true } } },
  });
  if (!request) return jsonErr("not_found", "This request no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (request.employeeProfile.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision, note } = parsed.data;
  const status = decision === "approve" ? "approved" : "denied";
  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.timeOffRequest.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: new Date() },
    });
    return updated.count === 1;
  });
  if (!decided) return jsonErr("already_decided", "This request was already decided.", 409);

  const rangeLabel = formatDateRange(isoDateOf(request.startDate), isoDateOf(request.endDate));
  if (decision === "approve") {
    await notifyUsers([
      {
        userId: request.employeeProfile.userId,
        type: "timeoff_approved",
        title: "Time off approved",
        body: `Your time off for ${rangeLabel} is approved.`,
      },
    ]);
  } else {
    const suffix = note ? ` Note from your manager: ${note}` : "";
    await notifyUsers([
      {
        userId: request.employeeProfile.userId,
        type: "timeoff_denied",
        title: "Time off request denied",
        body: `Your time off request for ${rangeLabel} was denied.${suffix}`,
      },
    ]);
  }

  return jsonOk({ status });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/time-off-decision.api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/time-off/[requestId]/route.ts" src/tests/time-off-decision.api.test.ts
git commit -m "feat: time-off approve/deny with notification fan-out"
```

---

### Task 5: Prove approved time off feeds conflict detection

Phase 3's `buildConflictContext` (shipped in `@/lib/conflict-context`, not `@/lib/conflicts`) already loads approved time off; this integration test pins the contract for this phase: a shift assigned during approved time off must come back as a conflict. Write the test only — if it fails, the bug is in `src/lib/conflicts.ts` or `src/lib/conflict-context.ts` (Phase 3) and must be fixed there (the expected behavior is documented in the roadmap: approved time off renders as `outside_availability` with message "…has approved time off Jul 14 – Jul 16").

**Files:**
- Test: `src/tests/timeoff-conflict.test.ts`

**Interfaces:**
- Consumes: `buildConflictContext` (`@/lib/conflict-context`); `detectConflicts`, `Conflict` (`@/lib/conflicts`); `weekStartOf`, `addDaysISO`, `localToUtc` (`@/lib/time`); factory (Task 2); `prisma` (`@/lib/db`).
- Produces: regression coverage; no new exports.

- [ ] **Step 1: Write the test**

```ts
// src/tests/timeoff-conflict.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts } from "@/lib/conflicts";
import { addDaysISO, localToUtc, weekStartOf } from "@/lib/time";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

describe("approved time off produces a conflict", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("flags a shift assigned inside an approved time-off range", async () => {
    // Next week's Tue–Thu, approved.
    const thisWeek = weekStartOf(new Date(), f.timezone);
    const nextWeekStart = addDaysISO(thisWeek, 7);
    const offStart = addDaysISO(nextWeekStart, 1); // Tue
    const offEnd = addDaysISO(nextWeekStart, 3); // Thu
    await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date(offStart),
        endDate: new Date(offEnd),
        reason: "vacation",
        status: "approved",
        decidedByUserId: f.managerUserId,
        decidedAt: new Date(),
      },
    });

    const ctx = await buildConflictContext(f.ana.profileId, nextWeekStart);
    const proposedDate = addDaysISO(nextWeekStart, 2); // Wed, inside the range
    const conflicts = detectConflicts(
      {
        employeeProfileId: f.ana.profileId,
        date: proposedDate,
        startsAt: localToUtc(proposedDate, { hour: 9, minute: 0 }, f.timezone),
        endsAt: localToUtc(proposedDate, { hour: 17, minute: 0 }, f.timezone),
      },
      ctx,
    );

    expect(
      conflicts.some((c) => c.kind === "outside_availability" && /approved time off/i.test(c.message)),
    ).toBe(true);
  });

  it("does not flag a shift outside the approved range", async () => {
    const thisWeek = weekStartOf(new Date(), f.timezone);
    const nextWeekStart = addDaysISO(thisWeek, 7);
    const ctx = await buildConflictContext(f.ana.profileId, nextWeekStart);
    const proposedDate = addDaysISO(nextWeekStart, 5); // Sat, outside Tue–Thu
    const conflicts = detectConflicts(
      {
        employeeProfileId: f.ana.profileId,
        date: proposedDate,
        startsAt: localToUtc(proposedDate, { hour: 9, minute: 0 }, f.timezone),
        endsAt: localToUtc(proposedDate, { hour: 17, minute: 0 }, f.timezone),
      },
      ctx,
    );
    expect(conflicts.some((c) => /approved time off/i.test(c.message))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tests/timeoff-conflict.test.ts`
Expected: PASS (2 tests). If the first test fails, fix `src/lib/conflicts.ts` / `src/lib/conflict-context.ts` so approved time off is honored (do not weaken the test), then re-run `npx vitest run src/lib` to keep Phase 3's suite green.

- [ ] **Step 3: Commit**

```bash
git add src/tests/timeoff-conflict.test.ts
git commit -m "test: shift during approved time off returns a conflict"
```

---

### Task 6: Employee time-off UI (request sheet + pending list on the availability screen)

Per the design's AvailabilityScreen: a "Request time off" button under the availability editor opens a form (start/end date, reason select, note textarea shown only for reason "other"); "Send request" actually POSTs; the employee's requests are listed under the form with status badges.

**Files:**
- Create: `src/components/requests/StatusBadge.tsx`
- Create: `src/components/employee/TimeOffSection.tsx`
- Modify: `src/lib/flags.ts` (Phase 4 file — flip `TIME_OFF_ENABLED` to `true`)
- Modify: `src/app/(employee)/availability/AvailabilityEditor.tsx` (Phase 4 file — remove the flag-gated "Coming soon" placeholder)
- Modify: `src/app/(employee)/availability/page.tsx` (Phase 4 file — add one fetch + one render)

**Interfaces:**
- Consumes: `Button`, `Card`, `Input`, `Select`, `Sheet`, `Textarea`, `Badge` primitives (`@/components/ui/*`); `useToast` (`@/components/ui/Toaster`); `listMyTimeOffRequests`, `TimeOffItem` (`@/lib/requests`, Task 3); `POST /api/time-off` (Task 3); `TIME_OFF_ENABLED` (`@/lib/flags`, Phase 4 — this task flips it); `requireUser` (`@/lib/auth`), `getEmployeeContext` (`@/lib/queries/employee`, Phase 4) — already used by the page being modified; the page's context variable is `ctx` and the employee-profile id is `ctx.profileId`.
- Produces:
  - `StatusBadge({ status: "pending"|"approved"|"denied"|"cancelled" })` from `@/components/requests/StatusBadge` — used by Tasks 7, 12.
  - `TimeOffSection({ requests: TimeOffItem[] })` client component.
  - The app-wide `TIME_OFF_ENABLED` flag now `true` (this task ships the real time-off request UI, so it completes the Phase 4 handoff and removes the gated placeholder).

- [ ] **Step 1: Create the shared status badge**

```tsx
// src/components/requests/StatusBadge.tsx
// Maps request lifecycle status to the design system's Badge tones.
// Server-safe (no state, no handlers).
import { Badge } from "@/components/ui/Badge";

const TONE = { pending: "warning", approved: "success", denied: "danger", cancelled: "neutral" } as const;
const LABEL = { pending: "Pending", approved: "Approved", denied: "Denied", cancelled: "Cancelled" } as const;

export type RequestStatusValue = keyof typeof TONE;

export function StatusBadge({ status }: { status: RequestStatusValue }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
```

- [ ] **Step 2: Create the time-off section**

```tsx
// src/components/employee/TimeOffSection.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { TimeOffItem } from "@/lib/requests";

const REASON_OPTIONS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

export function TimeOffSection({ requests }: { requests: TimeOffItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setStartDate("");
    setEndDate("");
    setReason("");
    setNote("");
    setError(null);
  }

  async function submit() {
    if (!startDate || !endDate) {
      setError("Pick a start and end date.");
      return;
    }
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      close();
      toast({ tone: "success", title: "Request sent", description: "Your manager will review it." });
      router.refresh();
    } catch {
      setError("Something went wrong sending your request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "var(--font-sans)" }}>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        Request time off
      </Button>

      {requests.length > 0 && (
        <>
          <h3
            style={{
              fontSize: "var(--text-h3-size)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "6px 0 0",
            }}
          >
            Time off
          </h3>
          {requests.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.rangeLabel}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {r.reasonLabel}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            </Card>
          ))}
        </>
      )}

      <Sheet
        open={open}
        onClose={close}
        title="Request time off"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={submit}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Select
            label="Reason"
            value={reason}
            onChange={setReason}
            placeholder="Select a reason"
            options={REASON_OPTIONS}
          />
          {reason === "other" && (
            <Textarea
              label="Tell your manager why"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Family emergency, moving day…"
              rows={3}
            />
          )}
          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
              {error}
            </div>
          )}
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Your manager will review this request. You'll get a notification once it's decided.
          </p>
        </div>
      </Sheet>
    </section>
  );
}
```

- [ ] **Step 3: Flip `TIME_OFF_ENABLED` and remove Phase 4's placeholder**

This task ships the real time-off request UI, so it completes Phase 4's flag handoff:

1. In `src/lib/flags.ts`, change `TIME_OFF_ENABLED` from `false` to `true` (leave `SWAPS_ENABLED` alone — Task 8 owns it), and update the file's comment so it no longer claims the time-off dialog is unshipped:

```ts
export const TIME_OFF_ENABLED = true; // Phase 5 Task 6 shipped the time-off request sheet
```

2. In `src/app/(employee)/availability/AvailabilityEditor.tsx` (Phase 4), delete the flag-gated placeholder block — it renders a disabled "Request time off" button inside a "Coming soon" tooltip and is dead code once the flag is `true`:

```tsx
{/* Phase 5 replaces this with the real time-off request dialog. */}
{!TIME_OFF_ENABLED && (
  <Tooltip label="Coming soon">
    <Button variant="secondary" fullWidth disabled>
      Request time off
    </Button>
  </Tooltip>
)}
```

Also remove the now-unused `import { TIME_OFF_ENABLED } from "@/lib/flags";` line, and the `Tooltip` import if nothing else in the file uses it. Change nothing else in the editor. (Without this step the availability screen would show Phase 4's disabled "Coming soon" button next to this task's working one.)

- [ ] **Step 4: Wire it into the availability page**

Open `src/app/(employee)/availability/page.tsx` (created in Phase 4 — it is an async server component that already calls `requireUser()` and `getEmployeeContext(user.id)` into a variable named `ctx`, then renders the availability editor; the employee-profile id is `ctx.profileId`). Make exactly these additions, keeping everything else untouched:

1. Add imports at the top:

```tsx
import { listMyTimeOffRequests } from "@/lib/requests";
import { TimeOffSection } from "@/components/employee/TimeOffSection";
```

2. After the existing `getEmployeeContext(...)` line (and its null guard), add:

```tsx
const timeOffRequests = await listMyTimeOffRequests(ctx.profileId);
```

3. Inside the returned JSX, after the availability editor block and before the closing tag of the page's outer container, add:

```tsx
<TimeOffSection requests={timeOffRequests} />
```

If the page's context variable has a different name, use that name — change nothing else. Do not add a `getEmployeeProfile` call; the page already resolves the profile id via `getEmployeeContext`.

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: build succeeds with no type errors.

Then `npm run dev`, sign in as `maria@harborvine.test` / `rosterhouse1`, open Availability: Phase 4's disabled "Coming soon" placeholder is gone; the working "Request time off" button opens the sheet; sending with end date before start date shows "End date must be on or after the start date." inline; a valid request shows the "Request sent" toast and appears below with a Pending badge (the seed already includes one pending request — it should be listed too).

- [ ] **Step 6: Commit**

```bash
git add src/lib/flags.ts "src/app/(employee)/availability/AvailabilityEditor.tsx" src/components/requests/StatusBadge.tsx src/components/employee/TimeOffSection.tsx "src/app/(employee)/availability/page.tsx"
git commit -m "feat: employee time-off request sheet, request list, and TIME_OFF_ENABLED flip"
```

---

### Task 7: Manager time-off approvals page (`/manager/time-off`)

Per the ManagerApp time-off section: a card per pending request (name, range · reason), with working, differentiated Approve/Deny buttons. Deny opens a confirm dialog with an optional reason. Below the queue, a "Decided in the last 30 days" history section.

**Files:**
- Create: `src/app/manager/time-off/page.tsx`
- Create: `src/app/manager/time-off/loading.tsx`
- Create: `src/app/manager/time-off/error.tsx`
- Create: `src/components/manager/TimeOffApprovals.tsx`

**Interfaces:**
- Consumes: `requireManager` (`@/lib/auth`); `getManagerLocation` (`@/lib/authz`); `listTimeOff`, `listDecidedTimeOff`, `TimeOffItem` (`@/lib/requests`); `PATCH /api/time-off/[requestId]` (Task 4); `Button`, `Card`, `Dialog`, `Textarea`, `Spinner` primitives; `useToast`; `StatusBadge` (Task 6).
- Produces: `TimeOffApprovals({ pending, decided }: { pending: TimeOffItem[]; decided: TimeOffItem[] })` client component; the `/manager/time-off` screen.

- [ ] **Step 1: Create the page**

```tsx
// src/app/manager/time-off/page.tsx
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { listDecidedTimeOff, listTimeOff } from "@/lib/requests";
import { TimeOffApprovals } from "@/components/manager/TimeOffApprovals";

export default async function ManagerTimeOffPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const [pending, decided] = await Promise.all([
    listTimeOff(location.id, "pending"),
    listDecidedTimeOff(location.id),
  ]);

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <h1
        style={{
          fontSize: "var(--text-h1-size)",
          fontWeight: "var(--text-h1-weight)",
          color: "var(--text-primary)",
          margin: "0 0 6px",
        }}
      >
        Time off
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 18px" }}>
        Review time-off requests before the schedule is built around them.
      </p>
      <TimeOffApprovals pending={pending} decided={decided} />
    </div>
  );
}
```

- [ ] **Step 2: Create loading and error states**

```tsx
// src/app/manager/time-off/loading.tsx
import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
      <Spinner />
    </div>
  );
}
```

```tsx
// src/app/manager/time-off/error.tsx
"use client";

import { Button } from "@/components/ui/Button";

export default function TimeOffError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "48px 0", textAlign: "center" }}>
      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 4px" }}>
        We couldn't load time-off requests.
      </p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
        Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create the approvals list**

```tsx
// src/components/manager/TimeOffApprovals.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { TimeOffItem } from "@/lib/requests";

export function TimeOffApprovals({ pending, decided }: { pending: TimeOffItem[]; decided: TimeOffItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denying, setDenying] = useState<TimeOffItem | null>(null);
  const [denyNote, setDenyNote] = useState("");

  async function decide(request: TimeOffItem, decision: "approve" | "deny", note?: string) {
    setBusyId(request.id);
    try {
      const res = await fetch(`/api/time-off/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ tone: "danger", title: "Couldn't save that decision", description: json.error.message });
        return;
      }
      toast({
        tone: "success",
        title: decision === "approve" ? "Time off approved" : "Request denied",
        description: `${request.employeeName} will be notified.`,
      });
      setDenying(null);
      setDenyNote("");
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't save that decision", description: "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "var(--font-sans)" }}>
      {pending.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>All caught up — no pending requests.</p>
      )}
      {pending.map((r) => (
        <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.employeeName}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {r.rangeLabel} · {r.reasonLabel}
              {r.note ? ` · ${r.note}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <Button variant="ghost" size="sm" disabled={busyId === r.id} onClick={() => setDenying(r)}>
              Deny
            </Button>
            <Button variant="secondary" size="sm" disabled={busyId === r.id} onClick={() => decide(r, "approve")}>
              Approve
            </Button>
          </div>
        </Card>
      ))}

      <h2
        style={{
          fontSize: "var(--text-h3-size)",
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "18px 0 0",
        }}
      >
        Decided in the last 30 days
      </h2>
      {decided.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>No decisions in the last 30 days.</p>
      )}
      {decided.map((r) => (
        <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.employeeName}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {r.rangeLabel} · {r.reasonLabel}
            </div>
          </div>
          <StatusBadge status={r.status as "approved" | "denied"} />
        </Card>
      ))}

      <Dialog
        open={denying !== null}
        onClose={() => {
          setDenying(null);
          setDenyNote("");
        }}
        title="Deny this request?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDenying(null);
                setDenyNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busyId !== null}
              onClick={() => denying && decide(denying, "deny", denyNote)}
            >
              Deny request
            </Button>
          </>
        }
      >
        {denying && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-sans)" }}>
            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0 }}>
              {denying.employeeName} asked for {denying.rangeLabel} ({denying.reasonLabel.toLowerCase()}).
            </p>
            <Textarea
              label="Add a note (optional)"
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              placeholder="e.g. That week is fully booked already."
              rows={3}
            />
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              The note is included in the notification {denying.employeeName} receives.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds.

Then `npm run dev`, sign in as `jamie@harborvine.test`, open `/manager/time-off`: the seed's pending request appears; Approve shows a calm toast and moves the row to history; Deny opens the dialog, and a denied request notifies with the note (check the employee's notifications feed as Maria).

- [ ] **Step 5: Commit**

```bash
git add src/app/manager/time-off src/components/manager/TimeOffApprovals.tsx
git commit -m "feat: manager time-off approvals with deny reason and history"
```

---
### Task 8: Flip `SWAPS_ENABLED` and add the "Request swap" entry point on shift detail

Phase 4 shipped `src/lib/flags.ts` with `SWAPS_ENABLED = false` and, on the shift-detail page, a flag-gated block whose enabled path links to `/swaps/new?shiftId=<id>` — a route this phase never builds (the composer ships at `/shifts/[shiftId]/swap`, Task 10). Flip the flag on, fix the stale route in the flags comment, and REPLACE Phase 4's gated block with the designed full-width ghost "Request swap" button — a real button that navigates to the composer (the export's button had no handler at all).

**Files:**
- Modify: `src/lib/flags.ts`
- Create: `src/components/employee/RequestSwapButton.tsx`
- Modify: `src/app/(employee)/shifts/[shiftId]/page.tsx` (Phase 4 file — replace its `SWAPS_ENABLED`-gated block)

**Interfaces:**
- Consumes: `SWAPS_ENABLED` (`@/lib/flags`, Phase 4); `Button` primitive; the shift-detail page's already-loaded `ShiftDetailDto` record (Phase 4: `id`, `isOpen: boolean`, `startsAt: string` ISO — it has no `status`/`employeeProfileId` fields, and the DTO only ever returns the viewer's own shifts or open shifts at their location).
- Produces: `RequestSwapButton({ shiftId, size?: "sm" | "md", fullWidth?: boolean })` from `@/components/employee/RequestSwapButton` (Task 12 reuses it with `size="sm"`); the app-wide flag now `true`.

- [ ] **Step 1: Flip the flag**

In `src/lib/flags.ts`, change the `SWAPS_ENABLED` value from `false` to `true`, and correct the file's comment — Phase 4 wrote that the composer would ship at `/swaps/new?shiftId=<id>`, but it actually ships at `/shifts/[shiftId]/swap` (Task 10). Leave `TIME_OFF_ENABLED` alone (Task 6 owns it):

```ts
export const SWAPS_ENABLED = true; // Phase 5 Task 10 ships the composer at /shifts/[shiftId]/swap
```

- [ ] **Step 2: Create the button**

```tsx
// src/components/employee/RequestSwapButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RequestSwapButton({
  shiftId,
  size = "md",
  fullWidth = true,
}: {
  shiftId: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}) {
  const router = useRouter();
  return (
    <Button variant="ghost" size={size} fullWidth={fullWidth} onClick={() => router.push(`/shifts/${shiftId}/swap`)}>
      Request swap
    </Button>
  );
}
```

- [ ] **Step 3: Replace Phase 4's gated block on shift detail**

Open `src/app/(employee)/shifts/[shiftId]/page.tsx` (Phase 4 — async server component that loads the viewer's shift as a `ShiftDetailDto` named `shift`; the page already imports `SWAPS_ENABLED`). Add the import:

```tsx
import { RequestSwapButton } from "@/components/employee/RequestSwapButton";
```

Then find Phase 4's existing `SWAPS_ENABLED`-gated block at the end of the returned JSX — it looks like this:

```tsx
{!shift.isOpen &&
  (SWAPS_ENABLED ? (
    <Link href={`/swaps/new?shiftId=${shift.id}`} className={styles.linkBrand}>
      Request swap
    </Link>
  ) : (
    <Tooltip label="Coming soon">
      <Button variant="ghost" fullWidth disabled>
        Request swap
      </Button>
    </Tooltip>
  ))}
```

and REPLACE the whole block (do not add a second affordance alongside it — the old link targets `/swaps/new`, which doesn't exist) with:

```tsx
{SWAPS_ENABLED && !shift.isOpen && new Date(shift.startsAt) > new Date() && (
  <RequestSwapButton shiftId={shift.id} />
)}
```

Notes on the condition: `ShiftDetailDto` only ever returns the viewer's own published shifts or published open shifts at their location, so `!shift.isOpen` implies "own shift" and no `status`/`employeeProfileId` check is needed (the DTO doesn't carry those fields); `startsAt` is an ISO string on the DTO, hence `new Date(shift.startsAt)`. Only own, future shifts are swappable — the composer page and API enforce the same rule. After the replacement, remove any imports the page no longer uses (in Phase 4's code: `Link` from `next/link`, `Button`, `Tooltip` — check each is unused elsewhere in the file before deleting). Change nothing else.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds.

Then `npm run dev` as Maria: an upcoming shift's detail now shows the working "Request swap" ghost button (the old disabled "Coming soon" affordance is gone, and there is exactly one swap affordance on the page); clicking it navigates to `/shifts/<id>/swap` (404/blank until Task 10 — that's expected for now).

- [ ] **Step 5: Commit**

```bash
git add src/lib/flags.ts src/components/employee/RequestSwapButton.tsx "src/app/(employee)/shifts/[shiftId]/page.tsx"
git commit -m "feat: enable swaps flag and add request-swap entry point"
```

---

### Task 9: Swap-request creation API (`POST /api/shifts/[shiftId]/swap-requests`)

Only the shift's own assignee can request a swap; only future, published shifts; exactly one open (pending) request per shift; a named coverer must be a qualified, active coworker at the same location.

**Files:**
- Modify: `src/lib/requests.ts` (add `listQualifiedCoworkers`)
- Create: `src/app/api/shifts/[shiftId]/swap-requests/route.ts`
- Test: `src/tests/swap-create.api.test.ts`

**Interfaces:**
- Consumes: `sessionUser` (Task 3); `getEmployeeProfile` (`@/lib/authz`); `prisma`; `jsonOk`/`jsonErr`; factory + `signInAs` (Task 2). Schema fields: `SwapRequest { shiftId, requestingEmployeeProfileId, coveringEmployeeProfileId (null = anyone qualified), note, status }`.
- Produces:
  - `listQualifiedCoworkers(locationId: string, positionId: string, excludeProfileId: string): Promise<{ profileId: string; name: string }[]>` from `@/lib/requests` (Task 10 consumes).
  - `POST /api/shifts/[shiftId]/swap-requests` — body `{ coveringEmployeeProfileId: string | null, note?: string }`; 200 → `{ ok: true, data: { id, status: "pending" } }`; 409 `duplicate_request` when a pending request exists.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/swap-create.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/shifts/[shiftId]/swap-requests/route";
import { listQualifiedCoworkers } from "@/lib/requests";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function req(shiftId: string, body: unknown) {
  return [
    new Request(`http://test/api/shifts/${shiftId}/swap-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ shiftId }) },
  ] as const;
}

describe("POST /api/shifts/[shiftId]/swap-requests", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("creates a pending open-to-anyone request for my own future published shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: null, note: "Family dinner that night." }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    const row = await prisma.swapRequest.findUniqueOrThrow({ where: { id: json.data.id } });
    expect(row.status).toBe("pending");
    expect(row.coveringEmployeeProfileId).toBeNull();
    expect(row.requestingEmployeeProfileId).toBe(f.ana.profileId);
  });

  it("enforces one open request per shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const first = await POST(...req(shift.id, { coveringEmployeeProfileId: null }));
    expect((await first.json()).ok).toBe(true);
    const second = await POST(...req(shift.id, { coveringEmployeeProfileId: f.ben.profileId }));
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("duplicate_request");
  });

  it("rejects requesting a swap for someone else's shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 6,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: null }));
    expect(res.status).toBe(403);
  });

  it("rejects an unqualified named coverer with a specific message", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 6,
      startHour: 18,
      endHour: 23,
    });
    signInAs(f.ben.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: f.cal.profileId })); // Cal is Server-only
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("Cal Ito isn't qualified for Dishwasher shifts.");
  });

  it("rejects past shifts", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: -2,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: null }));
    expect(res.status).toBe(409);
  });

  it("lists only qualified, active coworkers excluding the requester", async () => {
    const coworkers = await listQualifiedCoworkers(f.locationId, f.positionIds.dishwasher, f.ana.profileId);
    expect(coworkers.map((c) => c.name)).toEqual(["Ben Cho"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/swap-create.api.test.ts`
Expected: FAIL — cannot resolve `@/app/api/shifts/[shiftId]/swap-requests/route`, and `listQualifiedCoworkers` is not exported.

- [ ] **Step 3: Add `listQualifiedCoworkers` to `src/lib/requests.ts`**

Append:

```ts
export type Coworker = { profileId: string; name: string };

export async function listQualifiedCoworkers(
  locationId: string,
  positionId: string,
  excludeProfileId: string,
): Promise<Coworker[]> {
  const rows = await prisma.employeeProfile.findMany({
    where: {
      locationId,
      status: "active",
      id: { not: excludeProfileId },
      positions: { some: { positionId } },
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({ profileId: r.id, name: r.user.name }));
}
```

- [ ] **Step 4: Implement the handler**

```ts
// src/app/api/shifts/[shiftId]/swap-requests/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

const createSwapSchema = z.object({
  coveringEmployeeProfileId: z.string().min(1).nullable(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = createSwapSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Check the swap details and try again.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { position: true } });
  if (!shift) return jsonErr("not_found", "This shift no longer exists.", 404);
  if (shift.employeeProfileId !== profile.id) {
    return jsonErr("forbidden", "You can only request a swap for your own shifts.", 403);
  }
  if (shift.status !== "published") return jsonErr("not_published", "This shift isn't published yet.", 409);
  if (shift.startsAt <= new Date()) {
    return jsonErr("shift_started", "This shift already started, so it can't be swapped.", 409);
  }

  const existing = await prisma.swapRequest.findFirst({ where: { shiftId, status: "pending" } });
  if (existing) {
    return jsonErr("duplicate_request", "There's already a pending swap request for this shift.", 409);
  }

  const covererId = parsed.data.coveringEmployeeProfileId;
  if (covererId) {
    if (covererId === profile.id) {
      return jsonErr("invalid_coverer", "You can't cover your own shift — pick a teammate.", 400);
    }
    const coverer = await prisma.employeeProfile.findUnique({
      where: { id: covererId },
      include: { user: true, positions: true },
    });
    if (!coverer || coverer.locationId !== shift.locationId || coverer.status !== "active") {
      return jsonErr("invalid_coverer", "That teammate isn't available at your location.", 400);
    }
    if (!coverer.positions.some((p) => p.positionId === shift.positionId)) {
      return jsonErr("not_qualified", `${coverer.user.name} isn't qualified for ${shift.position.name} shifts.`, 400);
    }
  }

  const created = await prisma.swapRequest.create({
    data: {
      shiftId,
      requestingEmployeeProfileId: profile.id,
      coveringEmployeeProfileId: covererId,
      note: parsed.data.note || null,
    },
  });
  return jsonOk({ id: created.id, status: created.status });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tests/swap-create.api.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/requests.ts "src/app/api/shifts/[shiftId]/swap-requests/route.ts" src/tests/swap-create.api.test.ts
git commit -m "feat: swap-request creation with ownership and qualification rules"
```

---

### Task 10: Swap composer page (`/(employee)/shifts/[shiftId]/swap`) — net-new design

The export has no swap composer at all (findings blocker #4). Build it from primitives following the kit's conventions: shift summary card, radio choice between "Anyone qualified" and a specific coworker (Select of qualified coworkers), optional note, "Send request".

**Files:**
- Create: `src/app/(employee)/shifts/[shiftId]/swap/page.tsx`
- Create: `src/app/(employee)/shifts/[shiftId]/swap/loading.tsx`
- Create: `src/app/(employee)/shifts/[shiftId]/swap/error.tsx`
- Create: `src/components/employee/SwapComposer.tsx`

**Interfaces:**
- Consumes: `requireUser` (`@/lib/auth`); `getEmployeeProfile` (`@/lib/authz`); `prisma`; `SWAPS_ENABLED` (`@/lib/flags`); `listQualifiedCoworkers`, `isoDateOf` (`@/lib/requests`, Tasks 3/9); `formatMediumDate` (Task 1), `formatShiftRange` (`@/lib/time`); `POST /api/shifts/[shiftId]/swap-requests` (Task 9); `Button`, `Card`, `Select`, `Textarea`, `Spinner` primitives; `useToast`.
- Produces: `SwapComposer({ shiftId, shiftLabel, coworkers, alreadyPending })` client component; the composer screen.

- [ ] **Step 1: Create the page**

```tsx
// src/app/(employee)/shifts/[shiftId]/swap/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { SWAPS_ENABLED } from "@/lib/flags";
import { isoDateOf, listQualifiedCoworkers } from "@/lib/requests";
import { formatMediumDate, formatShiftRange } from "@/lib/time";
import { SwapComposer } from "@/components/employee/SwapComposer";

export default async function SwapComposerPage({ params }: { params: Promise<{ shiftId: string }> }) {
  if (!SWAPS_ENABLED) redirect("/");
  const { shiftId } = await params;
  const user = await requireUser();
  const profile = await getEmployeeProfile(user.id);

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { position: true, location: true },
  });
  if (!shift || shift.employeeProfileId !== profile.id) notFound();
  if (shift.status !== "published" || shift.startsAt <= new Date()) redirect(`/shifts/${shiftId}`);

  const [coworkers, pendingRequest] = await Promise.all([
    listQualifiedCoworkers(shift.locationId, shift.positionId, profile.id),
    prisma.swapRequest.findFirst({ where: { shiftId, status: "pending" } }),
  ]);

  const shiftLabel = `${formatMediumDate(isoDateOf(shift.date))} · ${shift.position.name} · ${formatShiftRange(
    shift.startsAt,
    shift.endsAt,
    shift.location.timezone,
  )}`;

  return (
    <SwapComposer
      shiftId={shiftId}
      shiftLabel={shiftLabel}
      coworkers={coworkers}
      alreadyPending={pendingRequest !== null}
    />
  );
}
```

- [ ] **Step 2: Create loading and error states**

```tsx
// src/app/(employee)/shifts/[shiftId]/swap/loading.tsx
import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
      <Spinner />
    </div>
  );
}
```

```tsx
// src/app/(employee)/shifts/[shiftId]/swap/error.tsx
"use client";

import { Button } from "@/components/ui/Button";

export default function SwapComposerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "48px 20px", textAlign: "center" }}>
      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 4px" }}>
        We couldn't load this shift.
      </p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
        Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create the composer**

```tsx
// src/components/employee/SwapComposer.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";
import type { Coworker } from "@/lib/requests";

export function SwapComposer({
  shiftId,
  shiftLabel,
  coworkers,
  alreadyPending,
}: {
  shiftId: string;
  shiftLabel: string;
  coworkers: Coworker[];
  alreadyPending: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<"anyone" | "specific">("anyone");
  const [covererId, setCovererId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (target === "specific" && !covererId) {
      setError("Pick a coworker, or choose anyone qualified.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/swap-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coveringEmployeeProfileId: target === "specific" ? covererId : null,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      toast({ tone: "success", title: "Request sent", description: "Your manager will review it." });
      router.push("/swaps");
      router.refresh();
    } catch {
      setError("Something went wrong sending your request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const radioRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "var(--text-primary)",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "18px 20px 20px", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", margin: 0 }}>
        Request swap
      </h1>
      <Card>
        <div style={{ fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{shiftLabel}</div>
      </Card>

      {alreadyPending ? (
        <>
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              A swap request for this shift is already waiting for review.
            </p>
          </Card>
          <Button variant="ghost" fullWidth onClick={() => router.push("/swaps")}>
            View my requests
          </Button>
        </>
      ) : (
        <>
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <legend
              style={{
                fontSize: "var(--text-label-size)",
                fontWeight: "var(--text-label-weight)",
                color: "var(--text-primary)",
                padding: 0,
                marginBottom: 4,
              }}
            >
              Who should cover it?
            </legend>
            <label style={radioRow}>
              <input
                type="radio"
                name="swap-target"
                value="anyone"
                checked={target === "anyone"}
                onChange={() => setTarget("anyone")}
              />
              Anyone qualified
            </label>
            <label style={{ ...radioRow, ...(coworkers.length === 0 ? { color: "var(--text-tertiary)", cursor: "default" } : {}) }}>
              <input
                type="radio"
                name="swap-target"
                value="specific"
                checked={target === "specific"}
                disabled={coworkers.length === 0}
                onChange={() => setTarget("specific")}
              />
              A specific coworker
            </label>
          </fieldset>

          {coworkers.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              No qualified coworkers for this position yet, so the request goes out to anyone qualified.
            </p>
          )}

          {target === "specific" && coworkers.length > 0 && (
            <Select
              label="Coworker"
              value={covererId}
              onChange={setCovererId}
              placeholder="Pick a coworker"
              options={coworkers.map((c) => ({ value: c.profileId, label: c.name }))}
            />
          )}

          <Textarea
            label="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Doctor appointment that afternoon."
            rows={3}
          />

          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
              {error}
            </div>
          )}

          <Button variant="primary" fullWidth size="lg" disabled={busy} onClick={submit}>
            {busy ? "Sending…" : "Send request"}
          </Button>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Your manager approves swaps before they take effect.
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds.

Then `npm run dev` as Maria: from a shift detail, "Request swap" opens the composer; "A specific coworker" reveals a Select listing only coworkers qualified for that position; sending shows the toast and lands on `/swaps`; reopening the composer for the same shift shows the already-pending card instead of the form.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(employee)/shifts/[shiftId]/swap" src/components/employee/SwapComposer.tsx
git commit -m "feat: swap composer screen built from design-system primitives"
```

---

### Task 11: Open-shifts API (`GET /api/open-shifts`, `POST /api/open-shifts/[shiftId]/claims`)

Open shifts are published, unassigned, future shifts at the caller's location, annotated with the caller's claim state and qualification. Claiming creates a pending `OpenShiftClaim` (never a fake instant success).

**Files:**
- Modify: `src/lib/requests.ts` (add `listOpenShiftsForEmployee`)
- Create: `src/app/api/open-shifts/route.ts`
- Create: `src/app/api/open-shifts/[shiftId]/claims/route.ts`
- Test: `src/tests/open-shifts.api.test.ts`

**Interfaces:**
- Consumes: `sessionUser` (Task 3); `getEmployeeProfile`; `prisma`; `formatMediumDate` (Task 1), `formatShiftRange` (`@/lib/time`); `isoDateOf` (Task 3); factory + `signInAs` (Task 2). Schema: `OpenShiftClaim` with `@@unique([shiftId, employeeProfileId])` (composite key name `shiftId_employeeProfileId`); `EmployeePosition` composite key `employeeProfileId_positionId`.
- Produces:
  - `type OpenShiftItem = { shiftId; date; dayLabel; positionName; timeLabel; qualified: boolean; myClaimStatus: "pending"|"approved"|"denied"|"cancelled"|null }` and `listOpenShiftsForEmployee(employeeProfileId: string): Promise<OpenShiftItem[]>` from `@/lib/requests` (Task 12 consumes).
  - `GET /api/open-shifts` → `{ ok: true, data: { openShifts: OpenShiftItem[] } }`.
  - `POST /api/open-shifts/[shiftId]/claims` (no body) → `{ ok: true, data: { id, status: "pending" } }`; 409 `duplicate_claim` on re-claim; 403 `not_qualified` with actionable copy.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/open-shifts.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/open-shifts/route";
import { POST } from "@/app/api/open-shifts/[shiftId]/claims/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function claimReq(shiftId: string) {
  return [
    new Request(`http://test/api/open-shifts/${shiftId}/claims`, { method: "POST" }),
    { params: Promise.resolve({ shiftId }) },
  ] as const;
}

describe("open shifts", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("lists future published unassigned shifts with my claim state", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 3,
      startHour: 16,
      endHour: 22,
    });
    // Noise that must NOT appear:
    await createShift(f, { positionId: f.positionIds.server, employeeProfileId: f.ben.profileId, daysFromNow: 3, startHour: 9, endHour: 17 }); // assigned
    await createShift(f, { positionId: f.positionIds.server, employeeProfileId: null, daysFromNow: -3, startHour: 9, endHour: 17 }); // past
    await createShift(f, { positionId: f.positionIds.server, employeeProfileId: null, daysFromNow: 4, startHour: 9, endHour: 17, status: "draft" }); // draft

    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await GET();
    const json = await res.json();
    expect(json.ok).toBe(true);
    const ids = json.data.openShifts.map((s: { shiftId: string }) => s.shiftId);
    expect(ids).toContain(open.id);
    expect(ids).toHaveLength(1);
    const item = json.data.openShifts[0];
    expect(item.positionName).toBe("Server");
    expect(item.qualified).toBe(true);
    expect(item.myClaimStatus).toBeNull();
    expect(item.timeLabel).toContain("–");
  });

  it("creates a pending claim, annotates it, and blocks duplicates", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 16,
      endHour: 22,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...claimReq(open.id));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("pending");

    const list = await (await GET()).json();
    const item = list.data.openShifts.find((s: { shiftId: string }) => s.shiftId === open.id);
    expect(item.myClaimStatus).toBe("pending");

    const dup = await POST(...claimReq(open.id));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("duplicate_claim");
  });

  it("rejects unqualified claimants with actionable copy", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 18,
      endHour: 23,
    });
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId }); // Server-only
    const res = await POST(...claimReq(open.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe(
      "Ask your manager to add the Dishwasher position to your profile before claiming this shift.",
    );
  });

  it("rejects claiming an assigned shift", async () => {
    const taken = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 6,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...claimReq(taken.id));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/open-shifts.api.test.ts`
Expected: FAIL — cannot resolve the two route modules.

- [ ] **Step 3: Add the list helper to `src/lib/requests.ts`**

Append (also add `formatMediumDate, formatShiftRange` to the existing `@/lib/time` import at the top of the file):

```ts
export type OpenShiftItem = {
  shiftId: string;
  date: string;
  dayLabel: string;
  positionName: string;
  timeLabel: string;
  qualified: boolean;
  myClaimStatus: RequestStatus | null;
};

export async function listOpenShiftsForEmployee(employeeProfileId: string): Promise<OpenShiftItem[]> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true, positions: true },
  });
  const shifts = await prisma.shift.findMany({
    where: {
      locationId: profile.locationId,
      employeeProfileId: null,
      status: "published",
      startsAt: { gt: new Date() },
    },
    include: { position: true, claims: { where: { employeeProfileId } } },
    orderBy: { startsAt: "asc" },
  });
  const qualifiedIds = new Set(profile.positions.map((p) => p.positionId));
  return shifts.map((s) => {
    const date = isoDateOf(s.date);
    return {
      shiftId: s.id,
      date,
      dayLabel: formatMediumDate(date),
      positionName: s.position.name,
      timeLabel: formatShiftRange(s.startsAt, s.endsAt, profile.location.timezone),
      qualified: qualifiedIds.has(s.positionId),
      myClaimStatus: s.claims[0]?.status ?? null,
    };
  });
}
```

- [ ] **Step 4: Implement the routes**

```ts
// src/app/api/open-shifts/route.ts
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { listOpenShiftsForEmployee } from "@/lib/requests";

export async function GET() {
  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  let profileId: string;
  try {
    profileId = (await getEmployeeProfile(user.id)).id;
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }
  return jsonOk({ openShifts: await listOpenShiftsForEmployee(profileId) });
}
```

```ts
// src/app/api/open-shifts/[shiftId]/claims/route.ts
// No request body — the shift id in the path is the whole input.
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

export async function POST(_req: Request, ctx: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await ctx.params;
  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { position: true } });
  if (!shift) return jsonErr("not_found", "This shift no longer exists.", 404);
  if (shift.locationId !== profile.locationId) return jsonErr("forbidden", "This shift isn't at your location.", 403);
  if (shift.employeeProfileId !== null) return jsonErr("already_filled", "This shift was already filled.", 409);
  if (shift.status !== "published") return jsonErr("not_published", "This shift isn't published yet.", 409);
  if (shift.startsAt <= new Date()) return jsonErr("shift_started", "This shift already started.", 409);

  const qualification = await prisma.employeePosition.findUnique({
    where: { employeeProfileId_positionId: { employeeProfileId: profile.id, positionId: shift.positionId } },
  });
  if (!qualification) {
    return jsonErr(
      "not_qualified",
      `Ask your manager to add the ${shift.position.name} position to your profile before claiming this shift.`,
      403,
    );
  }

  const existing = await prisma.openShiftClaim.findUnique({
    where: { shiftId_employeeProfileId: { shiftId, employeeProfileId: profile.id } },
  });
  if (existing) return jsonErr("duplicate_claim", "You already requested this shift.", 409);

  const created = await prisma.openShiftClaim.create({
    data: { shiftId, employeeProfileId: profile.id },
  });
  return jsonOk({ id: created.id, status: created.status });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tests/open-shifts.api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/requests.ts src/app/api/open-shifts src/tests/open-shifts.api.test.ts
git commit -m "feat: open-shift listing and pending claims API"
```

---

### Task 12: Employee swaps screen (`/(employee)/swaps`) — open shifts + my requests

Per SwapScreen: "Open shifts" cards with a Claim button that becomes a pending "Requested" badge (fixing the export's fake local-only "Claimed" success), a "My shifts" list with Request swap entry points, and a "My requests" section listing my swap requests and claims with status badges.

**Files:**
- Modify: `src/lib/requests.ts` (add `listMyRequests`, `listMyUpcomingShifts`)
- Create: `src/app/(employee)/swaps/page.tsx` (replace the Phase 4 placeholder if one exists)
- Create: `src/app/(employee)/swaps/loading.tsx`
- Create: `src/app/(employee)/swaps/error.tsx`
- Create: `src/components/employee/OpenShiftsList.tsx`
- Create: `src/components/employee/MyRequestsList.tsx`
- Test: `src/tests/my-requests.test.ts`

**Interfaces:**
- Consumes: `requireUser`; `getEmployeeProfile`; `listOpenShiftsForEmployee`, `OpenShiftItem` (Task 11); `POST /api/open-shifts/[shiftId]/claims` (Task 11); `RequestSwapButton` (Task 8); `StatusBadge` (Task 6); `Badge`, `Button`, `Card`, `EmptyState`, `Spinner` primitives; `useToast`; `formatMediumDate` (Task 1), `formatShiftRange` (`@/lib/time`); `isoDateOf` (Task 3); factory (Task 2).
- Produces:
  - `type MyRequestItem = { id; kind: "swap"|"claim"; label; detail; status: RequestStatus; createdAt }` and `listMyRequests(employeeProfileId): Promise<MyRequestItem[]>` from `@/lib/requests` (newest first, both queues merged).
  - `type SwappableShift = { shiftId; dayLabel; positionName; timeLabel; hasPendingSwap: boolean }` and `listMyUpcomingShifts(employeeProfileId, limit?): Promise<SwappableShift[]>` from `@/lib/requests`.
  - `OpenShiftsList({ items })`, `MyRequestsList({ items })` components; the `/swaps` screen.

- [ ] **Step 1: Write the failing test for the query helpers**

```ts
// src/tests/my-requests.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listMyRequests, listMyUpcomingShifts } from "@/lib/requests";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";

describe("my requests + upcoming shifts read models", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("merges my swap requests and claims, newest first, with labels", async () => {
    const myShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const openShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    await prisma.swapRequest.create({
      data: {
        shiftId: myShift.id,
        requestingEmployeeProfileId: f.ana.profileId,
        coveringEmployeeProfileId: f.ben.profileId,
      },
    });
    await prisma.openShiftClaim.create({ data: { shiftId: openShift.id, employeeProfileId: f.ana.profileId } });

    const items = await listMyRequests(f.ana.profileId);
    expect(items).toHaveLength(2);
    const kinds = items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["claim", "swap"]);
    const swap = items.find((i) => i.kind === "swap")!;
    expect(swap.label).toContain("Server");
    expect(swap.detail).toBe("Asked Ben Cho to cover");
    expect(swap.status).toBe("pending");
    const claim = items.find((i) => i.kind === "claim")!;
    expect(claim.detail).toContain("–");
  });

  it("lists upcoming published shifts with a pending-swap marker", async () => {
    const shifts = await listMyUpcomingShifts(f.ana.profileId);
    expect(shifts.length).toBeGreaterThanOrEqual(1);
    const withPending = shifts.find((s) => s.hasPendingSwap);
    expect(withPending?.positionName).toBe("Server");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/my-requests.test.ts`
Expected: FAIL — `listMyRequests` / `listMyUpcomingShifts` not exported.

- [ ] **Step 3: Add the helpers to `src/lib/requests.ts`**

Append:

```ts
export type MyRequestItem = {
  id: string;
  kind: "swap" | "claim";
  label: string;
  detail: string;
  status: RequestStatus;
  createdAt: string;
};

export async function listMyRequests(employeeProfileId: string): Promise<MyRequestItem[]> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true },
  });
  const tz = profile.location.timezone;
  const [swaps, claims] = await Promise.all([
    prisma.swapRequest.findMany({
      where: { requestingEmployeeProfileId: employeeProfileId },
      include: { shift: { include: { position: true } }, coverer: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.openShiftClaim.findMany({
      where: { employeeProfileId },
      include: { shift: { include: { position: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const items: MyRequestItem[] = [
    ...swaps.map((r) => ({
      id: r.id,
      kind: "swap" as const,
      label: `Swap · ${formatMediumDate(isoDateOf(r.shift.date))} ${r.shift.position.name}`,
      detail: r.coverer ? `Asked ${r.coverer.user.name} to cover` : "Open to anyone qualified",
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...claims.map((c) => ({
      id: c.id,
      kind: "claim" as const,
      label: `Claim · ${formatMediumDate(isoDateOf(c.shift.date))} ${c.shift.position.name}`,
      detail: formatShiftRange(c.shift.startsAt, c.shift.endsAt, tz),
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type SwappableShift = {
  shiftId: string;
  dayLabel: string;
  positionName: string;
  timeLabel: string;
  hasPendingSwap: boolean;
};

export async function listMyUpcomingShifts(employeeProfileId: string, limit = 5): Promise<SwappableShift[]> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true },
  });
  const shifts = await prisma.shift.findMany({
    where: { employeeProfileId, status: "published", startsAt: { gt: new Date() } },
    include: { position: true, swapRequests: { where: { status: "pending" } } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  return shifts.map((s) => ({
    shiftId: s.id,
    dayLabel: formatMediumDate(isoDateOf(s.date)),
    positionName: s.position.name,
    timeLabel: formatShiftRange(s.startsAt, s.endsAt, profile.location.timezone),
    hasPendingSwap: s.swapRequests.length > 0,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/my-requests.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the components and page**

```tsx
// src/components/employee/OpenShiftsList.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toaster";
import type { OpenShiftItem } from "@/lib/requests";

export function OpenShiftsList({ items }: { items: OpenShiftItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyState title="No open shifts right now" description="New shifts your manager posts show up here first." />;
  }

  async function claim(item: OpenShiftItem) {
    setBusyId(item.shiftId);
    try {
      const res = await fetch(`/api/open-shifts/${item.shiftId}/claims`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        toast({ tone: "danger", title: "Couldn't request that shift", description: json.error.message });
        return;
      }
      setRequested((r) => ({ ...r, [item.shiftId]: true }));
      toast({ tone: "success", title: "Request sent", description: "Your manager will review it." });
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't request that shift", description: "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => {
        const pending = item.myClaimStatus === "pending" || requested[item.shiftId];
        return (
          <Card key={item.shiftId}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "var(--font-sans)" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.dayLabel}</div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{item.positionName}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.timeLabel}</div>
                {!item.qualified && (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Ask your manager to add the {item.positionName} position to pick this up.
                  </div>
                )}
              </div>
              {pending ? (
                <Badge tone="warning">Requested</Badge>
              ) : item.myClaimStatus === "denied" ? (
                <Badge tone="neutral">Denied</Badge>
              ) : (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={!item.qualified || busyId === item.shiftId}
                  onClick={() => claim(item)}
                >
                  Claim
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

```tsx
// src/components/employee/MyRequestsList.tsx
// Server-safe: no state, no handlers.
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { MyRequestItem } from "@/lib/requests";

export function MyRequestsList({ items }: { items: MyRequestItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No requests yet" description="Swap requests and shift claims you send show up here." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <Card key={`${item.kind}-${item.id}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "var(--font-sans)" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.detail}</div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}
```

```tsx
// src/app/(employee)/swaps/page.tsx
import { requireUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/lib/authz";
import { listMyRequests, listMyUpcomingShifts, listOpenShiftsForEmployee } from "@/lib/requests";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OpenShiftsList } from "@/components/employee/OpenShiftsList";
import { MyRequestsList } from "@/components/employee/MyRequestsList";
import { RequestSwapButton } from "@/components/employee/RequestSwapButton";

const h = (text: string) => (
  <h2 style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)", margin: "6px 0 0" }}>
    {text}
  </h2>
);

export default async function SwapsPage() {
  const user = await requireUser();
  const profile = await getEmployeeProfile(user.id);
  const [openShifts, myShifts, myRequests] = await Promise.all([
    listOpenShiftsForEmployee(profile.id),
    listMyUpcomingShifts(profile.id),
    listMyRequests(profile.id),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px 20px", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", margin: 0 }}>
        Open shifts
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        Claim an open shift, or ask a teammate to cover one of yours.
      </p>
      <OpenShiftsList items={openShifts} />

      {h("My shifts")}
      {myShifts.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>No upcoming shifts.</p>
      )}
      {myShifts.map((s) => (
        <Card key={s.shiftId}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.dayLabel}</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{s.positionName}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.timeLabel}</div>
            </div>
            {s.hasPendingSwap ? (
              <Badge tone="warning">Swap pending</Badge>
            ) : (
              <RequestSwapButton shiftId={s.shiftId} size="sm" fullWidth={false} />
            )}
          </div>
        </Card>
      ))}

      {h("My requests")}
      <MyRequestsList items={myRequests} />
    </div>
  );
}
```

```tsx
// src/app/(employee)/swaps/loading.tsx
import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
      <Spinner />
    </div>
  );
}
```

```tsx
// src/app/(employee)/swaps/error.tsx
"use client";

import { Button } from "@/components/ui/Button";

export default function SwapsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "48px 20px", textAlign: "center" }}>
      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 4px" }}>We couldn't load open shifts.</p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
        Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm run build`
Expected: build succeeds.

Then `npm run dev`. Precondition: the seed's only open shift lives in NEXT week's DRAFT schedule, and `listOpenShiftsForEmployee` only lists published shifts — so first sign in as Jamie, go to `/manager/schedule`, page forward to next week, and publish it. Then as Maria on `/swaps`: the (now published) seeded open shift shows a Claim button; claiming flips it to a "Requested" badge (still there after reload — it's real); the seed's pending swap and claim appear under "My requests" with Pending badges; my upcoming shifts show "Request swap" buttons linking to the composer.

- [ ] **Step 7: Commit**

```bash
git add src/lib/requests.ts "src/app/(employee)/swaps" src/components/employee/OpenShiftsList.tsx src/components/employee/MyRequestsList.tsx src/tests/my-requests.test.ts
git commit -m "feat: employee swaps screen with real claim state and request history"
```

---
### Task 13: Merged approvals queue API (`GET /api/locations/[locationId]/approvals`)

The manager's SwapApprovals design shows one list mixing swap requests and open-shift claims, each with a type badge. Serve both queues merged, oldest first.

**Files:**
- Modify: `src/lib/requests.ts` (add `listPendingApprovals`)
- Create: `src/app/api/locations/[locationId]/approvals/route.ts`
- Test: `src/tests/approvals-list.api.test.ts`

**Interfaces:**
- Consumes: `sessionUser` (Task 3); `getManagerLocation`; `prisma`; `formatMediumDate` (Task 1), `formatShiftRange` (`@/lib/time`); `isoDateOf` (Task 3); factory + `signInAs` (Task 2).
- Produces:
  - `type ApprovalItem = { id; kind: "swap"|"claim"; employeeName; detail; subDetail; note: string|null; createdAt }` and `listPendingApprovals(locationId: string): Promise<ApprovalItem[]>` from `@/lib/requests` (Task 16 consumes).
  - `GET /api/locations/[locationId]/approvals?status=pending` → `{ ok: true, data: { approvals: ApprovalItem[] } }` (only `pending` is supported in v1; other values → 400).

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/approvals-list.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/locations/[locationId]/approvals/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

describe("GET /api/locations/[locationId]/approvals", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const myShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const openShift = await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 18,
      endHour: 23,
    });
    await prisma.swapRequest.create({
      data: { shiftId: myShift.id, requestingEmployeeProfileId: f.ana.profileId, coveringEmployeeProfileId: null, note: "Family dinner." },
    });
    await prisma.openShiftClaim.create({ data: { shiftId: openShift.id, employeeProfileId: f.ben.profileId } });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("merges both queues with names, labels, and kinds", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/approvals?status=pending`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.approvals).toHaveLength(2);
    const swap = json.data.approvals.find((a: { kind: string }) => a.kind === "swap");
    expect(swap.employeeName).toBe("Ana Diaz");
    expect(swap.detail).toContain("Wants to swap their");
    expect(swap.subDetail).toBe("Open to anyone qualified");
    expect(swap.note).toBe("Family dinner.");
    const claim = json.data.approvals.find((a: { kind: string }) => a.kind === "claim");
    expect(claim.employeeName).toBe("Ben Cho");
    expect(claim.detail).toContain("Dishwasher");
    expect(claim.subDetail).toBe("Awaiting your approval");
  });

  it("rejects employees", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/approvals`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/approvals-list.api.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Add the helper to `src/lib/requests.ts`**

Append:

```ts
export type ApprovalItem = {
  id: string;
  kind: "swap" | "claim";
  employeeName: string;
  detail: string;
  subDetail: string;
  note: string | null;
  createdAt: string;
};

export async function listPendingApprovals(locationId: string): Promise<ApprovalItem[]> {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const tz = location.timezone;
  const shiftLabel = (shift: { date: Date; startsAt: Date; endsAt: Date; position: { name: string } }) =>
    `${formatMediumDate(isoDateOf(shift.date))} ${shift.position.name} shift, ${formatShiftRange(shift.startsAt, shift.endsAt, tz)}`;

  const [swaps, claims] = await Promise.all([
    prisma.swapRequest.findMany({
      where: { status: "pending", shift: { locationId } },
      include: {
        shift: { include: { position: true } },
        requester: { include: { user: true } },
        coverer: { include: { user: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.openShiftClaim.findMany({
      where: { status: "pending", shift: { locationId } },
      include: { shift: { include: { position: true } }, employeeProfile: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const items: ApprovalItem[] = [
    ...swaps.map((r) => ({
      id: r.id,
      kind: "swap" as const,
      employeeName: r.requester.user.name,
      detail: `Wants to swap their ${shiftLabel(r.shift)}`,
      subDetail: r.coverer ? `${r.coverer.user.name} offered to cover` : "Open to anyone qualified",
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
    ...claims.map((c) => ({
      id: c.id,
      kind: "claim" as const,
      employeeName: c.employeeProfile.user.name,
      detail: `Wants to pick up the open ${shiftLabel(c.shift)}`,
      subDetail: "Awaiting your approval",
      note: null,
      createdAt: c.createdAt.toISOString(),
    })),
  ];
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
```

- [ ] **Step 4: Implement the route**

```ts
// src/app/api/locations/[locationId]/approvals/route.ts
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { listPendingApprovals } from "@/lib/requests";

export async function GET(req: Request, ctx: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await ctx.params;
  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  if (!z.literal("pending").safeParse(raw).success) {
    return jsonErr("invalid_input", "Only status=pending is supported.", 400);
  }

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can view approvals.", 403);

  const managerLocation = await getManagerLocation(user.id);
  if (managerLocation.id !== locationId) return jsonErr("forbidden", "You don't manage this location.", 403);

  return jsonOk({ approvals: await listPendingApprovals(locationId) });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tests/approvals-list.api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/requests.ts "src/app/api/locations/[locationId]/approvals/route.ts" src/tests/approvals-list.api.test.ts
git commit -m "feat: merged pending approvals queue API"
```

---

### Task 14: Swap decision API (`PATCH /api/swap-requests/[id]`)

Approve: transactionally mark approved and reassign the shift to the coverer — or set `employeeProfileId` to null (the shift becomes an open shift) when the request was open-to-anyone. Deny: no schedule change. Both notify the requester AND the coverer (when named) with distinct copy. Approval re-runs conflict detection on the resulting assignment and returns a `warnings` array — approving still succeeds (200), the UI surfaces warnings as a toast.

**Files:**
- Create: `src/app/api/swap-requests/[id]/route.ts`
- Test: `src/tests/swap-decision.api.test.ts`

**Interfaces:**
- Consumes: `sessionUser` (Task 3); `getManagerLocation`; `prisma`; `notifyUsers` (`@/lib/notify`); `buildConflictContext` (`@/lib/conflict-context`); `detectConflicts`, `Conflict` (`@/lib/conflicts`); `weekStartOf`, `formatShiftRange` (`@/lib/time`); `formatMediumDate` (Task 1); `isoDateOf` (Task 3); factory + `signInAs` (Task 2).
- Produces: `PATCH /api/swap-requests/[id]` — body `{ decision: "approve" | "deny" }`; 200 → `{ ok: true, data: { status, warnings: Conflict[] } }` (`warnings` non-empty only on approve with a named coverer who now has conflicts); 409 `already_decided` / `shift_changed`. Notification types: `swap_approved`, `swap_denied`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/swap-decision.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { PATCH } from "@/app/api/swap-requests/[id]/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(id: string, decision: "approve" | "deny") {
  return [
    new Request(`http://test/api/swap-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

async function makeSwap(f: Fixture, opts: { covererProfileId: string | null; daysFromNow: number; startHour?: number; endHour?: number }) {
  const shift = await createShift(f, {
    positionId: f.positionIds.server,
    employeeProfileId: f.ana.profileId,
    daysFromNow: opts.daysFromNow,
    startHour: opts.startHour ?? 16,
    endHour: opts.endHour ?? 22,
  });
  const request = await prisma.swapRequest.create({
    data: { shiftId: shift.id, requestingEmployeeProfileId: f.ana.profileId, coveringEmployeeProfileId: opts.covererProfileId },
  });
  return { shift, request };
}

describe("PATCH /api/swap-requests/[id]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approve with a named coverer reassigns the shift and notifies both people", async () => {
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 4 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");
    expect(json.data.warnings).toEqual([]);

    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ben.profileId);

    const requesterNote = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "swap_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(requesterNote?.body).toContain("Ben Cho will cover your");
    const covererNote = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "swap_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(covererNote?.body).toContain("You're covering Ana Diaz's");
  });

  it("approve of an open-to-anyone request opens the shift", async () => {
    const { shift, request } = await makeSwap(f, { covererProfileId: null, daysFromNow: 5 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect((await res.json()).data.status).toBe("approved");
    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBeNull();
  });

  it("deny changes nothing on the schedule and notifies both people", async () => {
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 6 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "deny"));
    expect((await res.json()).data.status).toBe("denied");
    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ana.profileId);
    const covererNote = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "swap_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(covererNote?.body).toContain("Nothing changes for you.");
  });

  it("approving a swap that double-books the coverer returns 200 with warnings", async () => {
    // Ben already works 15:00–23:00 that day; the swapped shift is 16:00–22:00.
    await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 8,
      startHour: 15,
      endHour: 23,
    });
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 8 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.warnings.length).toBeGreaterThanOrEqual(1);
    expect(json.data.warnings.some((w: { kind: string }) => w.kind === "double_booked")).toBe(true);
    // The reassignment still happened — the manager approved with eyes open.
    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ben.profileId);
  });

  it("returns 409 on a second decision", async () => {
    const { request } = await makeSwap(f, { covererProfileId: null, daysFromNow: 9 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(...patchReq(request.id, "deny"));
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_decided");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/swap-decision.api.test.ts`
Expected: FAIL — cannot resolve `@/app/api/swap-requests/[id]/route`.

- [ ] **Step 3: Implement the handler**

```ts
// src/app/api/swap-requests/[id]/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { notifyUsers } from "@/lib/notify";
import type { NotifyInput } from "@/lib/notify";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import { formatMediumDate, formatShiftRange, weekStartOf } from "@/lib/time";
import { isoDateOf } from "@/lib/requests";

const decisionSchema = z.object({ decision: z.enum(["approve", "deny"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide swap requests.", 403);

  const request = await prisma.swapRequest.findUnique({
    where: { id },
    include: {
      shift: { include: { position: true, location: true } },
      requester: { include: { user: true } },
      coverer: { include: { user: true } },
    },
  });
  if (!request) return jsonErr("not_found", "This swap request no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (request.shift.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision } = parsed.data;
  if (decision === "approve" && request.shift.employeeProfileId !== request.requestingEmployeeProfileId) {
    return jsonErr("shift_changed", "This shift changed since the request was made.", 409);
  }

  const status = decision === "approve" ? "approved" : "denied";
  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.swapRequest.updateMany({
      where: { id, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: new Date() },
    });
    if (updated.count === 0) return false;
    if (decision === "approve") {
      await tx.shift.update({
        where: { id: request.shiftId },
        data: { employeeProfileId: request.coveringEmployeeProfileId },
      });
    }
    return true;
  });
  if (!decided) return jsonErr("already_decided", "This request was already decided.", 409);

  const timezone = request.shift.location.timezone;
  const shiftLabel = `${formatMediumDate(isoDateOf(request.shift.date))} ${request.shift.position.name} shift, ${formatShiftRange(
    request.shift.startsAt,
    request.shift.endsAt,
    timezone,
  )}`;
  const requesterUserId = request.requester.userId;
  const requesterName = request.requester.user.name;

  if (decision === "approve" && request.coverer) {
    await notifyUsers([
      {
        userId: requesterUserId,
        type: "swap_approved",
        title: "Swap approved",
        body: `${request.coverer.user.name} will cover your ${shiftLabel}.`,
      },
      {
        userId: request.coverer.userId,
        type: "swap_approved",
        title: "You picked up a shift",
        body: `You're covering ${requesterName}'s ${shiftLabel}.`,
      },
    ]);
  } else if (decision === "approve") {
    await notifyUsers([
      {
        userId: requesterUserId,
        type: "swap_approved",
        title: "Swap approved",
        body: `Your ${shiftLabel} is now posted as an open shift.`,
      },
    ]);
  } else {
    const inputs: NotifyInput[] = [
      {
        userId: requesterUserId,
        type: "swap_denied",
        title: "Swap request denied",
        body: `Your swap request for the ${shiftLabel} was denied. You're still scheduled.`,
      },
    ];
    if (request.coverer) {
      inputs.push({
        userId: request.coverer.userId,
        type: "swap_denied",
        title: "Swap not needed",
        body: `${requesterName}'s request for you to cover the ${shiftLabel} was denied. Nothing changes for you.`,
      });
    }
    await notifyUsers(inputs);
  }

  // Re-run conflict detection on the resulting assignment. Warnings inform,
  // never block — the manager already approved.
  let warnings: Conflict[] = [];
  if (decision === "approve" && request.coveringEmployeeProfileId) {
    const context = await buildConflictContext(
      request.coveringEmployeeProfileId,
      weekStartOf(request.shift.startsAt, timezone),
    );
    warnings = detectConflicts(
      {
        shiftId: request.shiftId, // exclude the just-reassigned shift itself
        employeeProfileId: request.coveringEmployeeProfileId,
        date: isoDateOf(request.shift.date),
        startsAt: request.shift.startsAt,
        endsAt: request.shift.endsAt,
      },
      context,
    );
  }

  return jsonOk({ status, warnings });
}
```

Note: if `NotifyInput` is not exported from `@/lib/notify` (it is pinned in the roadmap's contract, so it should be), add `export` to its type declaration in `src/lib/notify/index.ts` — that is the only permitted edit to that file in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/swap-decision.api.test.ts`
Expected: PASS (5 tests). If the double-booking test finds zero warnings, debug `buildConflictContext` week alignment first (the overlapping shift and the swapped shift are on the same `daysFromNow: 8` day, so they share a week).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/swap-requests/[id]/route.ts" src/tests/swap-decision.api.test.ts
git commit -m "feat: swap approval transaction with reassignment, fan-out, and conflict warnings"
```

---

### Task 15: Claim decision API (`PATCH /api/open-shift-claims/[claimId]`)

Approve: assign the shift to the claimant, auto-deny all competing pending claims for the same shift, notify the winner and every competing claimant. Deny: notify the claimant only. Approve also returns conflict `warnings` like Task 14.

**Files:**
- Create: `src/app/api/open-shift-claims/[claimId]/route.ts`
- Test: `src/tests/claim-decision.api.test.ts`

**Interfaces:**
- Consumes: same as Task 14 (`sessionUser`, `getManagerLocation`, `prisma`, `notifyUsers`, conflicts lib, time labels, factory).
- Produces: `PATCH /api/open-shift-claims/[claimId]` — body `{ decision: "approve" | "deny" }`; 200 → `{ ok: true, data: { status, warnings: Conflict[] } }`; 409 `already_decided` / `already_filled`. Notification types: `claim_approved`, `claim_denied`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/claim-decision.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { PATCH } from "@/app/api/open-shift-claims/[claimId]/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(claimId: string, decision: "approve" | "deny") {
  return [
    new Request(`http://test/api/open-shift-claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }),
    { params: Promise.resolve({ claimId }) },
  ] as const;
}

describe("PATCH /api/open-shift-claims/[claimId]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approve assigns the shift, auto-denies competing claims, and notifies everyone", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const anaClaim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ana.profileId } });
    const calClaim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.cal.profileId } });

    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(anaClaim.id, "approve"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");
    expect(json.data.warnings).toEqual([]);

    const shift = await prisma.shift.findUniqueOrThrow({ where: { id: open.id } });
    expect(shift.employeeProfileId).toBe(f.ana.profileId);

    const loser = await prisma.openShiftClaim.findUniqueOrThrow({ where: { id: calClaim.id } });
    expect(loser.status).toBe("denied");
    expect(loser.decidedByUserId).toBe(f.managerUserId);

    const winNote = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "claim_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(winNote?.body).toContain("is yours");
    const loseNote = await prisma.notification.findFirst({
      where: { userId: f.cal.userId, type: "claim_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(loseNote?.body).toContain("went to another teammate");
  });

  it("deny keeps the shift open and notifies the claimant", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    const claim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ben.profileId } });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(claim.id, "deny"));
    expect((await res.json()).data.status).toBe("denied");
    const shift = await prisma.shift.findUniqueOrThrow({ where: { id: open.id } });
    expect(shift.employeeProfileId).toBeNull();
    const note = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "claim_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.body).toContain("was denied");
  });

  it("approving a claim that double-books the claimant returns 200 with warnings", async () => {
    await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.cal.profileId,
      daysFromNow: 8,
      startHour: 15,
      endHour: 23,
    });
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 8,
      startHour: 16,
      endHour: 22,
    });
    const claim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.cal.profileId } });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(claim.id, "approve"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.warnings.some((w: { kind: string }) => w.kind === "double_booked")).toBe(true);
  });

  it("returns 409 when the shift was already filled", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 9,
      startHour: 9,
      endHour: 17,
    });
    const first = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ana.profileId } });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(...patchReq(first.id, "approve"));
    // A late claim on the now-filled shift (created before approval in real life;
    // simulate by inserting directly, bypassing the API's open check).
    const late = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ben.profileId } });
    const res = await PATCH(...patchReq(late.id, "approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_filled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/claim-decision.api.test.ts`
Expected: FAIL — cannot resolve `@/app/api/open-shift-claims/[claimId]/route`.

- [ ] **Step 3: Implement the handler**

```ts
// src/app/api/open-shift-claims/[claimId]/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { notifyUsers } from "@/lib/notify";
import type { NotifyInput } from "@/lib/notify";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import { formatMediumDate, formatShiftRange, weekStartOf } from "@/lib/time";
import { isoDateOf } from "@/lib/requests";

const decisionSchema = z.object({ decision: z.enum(["approve", "deny"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide shift claims.", 403);

  const claim = await prisma.openShiftClaim.findUnique({
    where: { id: claimId },
    include: {
      shift: { include: { position: true, location: true } },
      employeeProfile: { include: { user: true } },
    },
  });
  if (!claim) return jsonErr("not_found", "This claim no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (claim.shift.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision } = parsed.data;
  if (decision === "approve" && claim.shift.employeeProfileId !== null) {
    return jsonErr("already_filled", "This shift was already filled.", 409);
  }

  const status = decision === "approve" ? "approved" : "denied";
  const now = new Date();
  let competingUserIds: string[] = [];
  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.openShiftClaim.updateMany({
      where: { id: claimId, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: now },
    });
    if (updated.count === 0) return false;
    if (decision === "approve") {
      const competing = await tx.openShiftClaim.findMany({
        where: { shiftId: claim.shiftId, status: "pending", id: { not: claimId } },
        include: { employeeProfile: true },
      });
      competingUserIds = competing.map((c) => c.employeeProfile.userId);
      await tx.openShiftClaim.updateMany({
        where: { shiftId: claim.shiftId, status: "pending", id: { not: claimId } },
        data: { status: "denied", decidedByUserId: user.id, decidedAt: now },
      });
      await tx.shift.update({
        where: { id: claim.shiftId },
        data: { employeeProfileId: claim.employeeProfileId },
      });
    }
    return true;
  });
  if (!decided) return jsonErr("already_decided", "This claim was already decided.", 409);

  const timezone = claim.shift.location.timezone;
  const shiftLabel = `${formatMediumDate(isoDateOf(claim.shift.date))} ${claim.shift.position.name} shift, ${formatShiftRange(
    claim.shift.startsAt,
    claim.shift.endsAt,
    timezone,
  )}`;
  const claimantUserId = claim.employeeProfile.userId;

  if (decision === "approve") {
    const inputs: NotifyInput[] = [
      { userId: claimantUserId, type: "claim_approved", title: "Shift confirmed", body: `The ${shiftLabel} is yours.` },
      ...competingUserIds.map((userId) => ({
        userId,
        type: "claim_denied" as const,
        title: "Shift filled",
        body: `The ${shiftLabel} went to another teammate this time.`,
      })),
    ];
    await notifyUsers(inputs);
  } else {
    await notifyUsers([
      {
        userId: claimantUserId,
        type: "claim_denied",
        title: "Claim denied",
        body: `Your request for the ${shiftLabel} was denied.`,
      },
    ]);
  }

  let warnings: Conflict[] = [];
  if (decision === "approve") {
    const context = await buildConflictContext(claim.employeeProfileId, weekStartOf(claim.shift.startsAt, timezone));
    warnings = detectConflicts(
      {
        shiftId: claim.shiftId,
        employeeProfileId: claim.employeeProfileId,
        date: isoDateOf(claim.shift.date),
        startsAt: claim.shift.startsAt,
        endsAt: claim.shift.endsAt,
      },
      context,
    );
  }

  return jsonOk({ status, warnings });
}
```

Note: if `NotifyInput` is not exported from `@/lib/notify` (it is pinned in the roadmap's contract, so it should be), add `export` to its type declaration in `src/lib/notify/index.ts` — that is the only permitted edit to that file in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/claim-decision.api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/open-shift-claims/[claimId]/route.ts" src/tests/claim-decision.api.test.ts
git commit -m "feat: claim approval with competing-claim auto-deny and conflict warnings"
```

---

### Task 16: Manager approvals screen (`/manager/swaps`)

Per SwapApprovals.jsx: one queue mixing swaps and claims, each card with the requester, a type Badge ("Swap" = info, "Open shift" = warning), detail lines, and working Deny (ghost) / Approve (secondary) buttons. Approving a conflicting assignment surfaces the warnings as a warning toast.

**Files:**
- Create: `src/app/manager/swaps/page.tsx`
- Create: `src/app/manager/swaps/loading.tsx`
- Create: `src/app/manager/swaps/error.tsx`
- Create: `src/components/manager/ApprovalsQueue.tsx`

**Interfaces:**
- Consumes: `requireManager`; `getManagerLocation`; `listPendingApprovals`, `ApprovalItem` (Task 13); `PATCH /api/swap-requests/[id]` (Task 14); `PATCH /api/open-shift-claims/[claimId]` (Task 15); `Badge`, `Button`, `Card`, `Spinner` primitives; `useToast`.
- Produces: `ApprovalsQueue({ items }: { items: ApprovalItem[] })` client component; the `/manager/swaps` screen.

- [ ] **Step 1: Create the page, loading, and error files**

```tsx
// src/app/manager/swaps/page.tsx
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { listPendingApprovals } from "@/lib/requests";
import { ApprovalsQueue } from "@/components/manager/ApprovalsQueue";

export default async function ManagerSwapsPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const approvals = await listPendingApprovals(location.id);

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <h1
        style={{
          fontSize: "var(--text-h1-size)",
          fontWeight: "var(--text-h1-weight)",
          color: "var(--text-primary)",
          margin: "0 0 6px",
        }}
      >
        Swaps &amp; open shifts
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 18px" }}>
        Approve shift swaps and claims before they take effect.
      </p>
      <ApprovalsQueue items={approvals} />
    </div>
  );
}
```

```tsx
// src/app/manager/swaps/loading.tsx
import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
      <Spinner />
    </div>
  );
}
```

```tsx
// src/app/manager/swaps/error.tsx
"use client";

import { Button } from "@/components/ui/Button";

export default function SwapsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "48px 0", textAlign: "center" }}>
      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 4px" }}>We couldn't load approvals.</p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
        Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create the queue component**

```tsx
// src/components/manager/ApprovalsQueue.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toaster";
import type { ApprovalItem } from "@/lib/requests";

export function ApprovalsQueue({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0, fontFamily: "var(--font-sans)" }}>
        All caught up — no pending requests.
      </p>
    );
  }

  async function decide(item: ApprovalItem, decision: "approve" | "deny") {
    setBusyId(item.id);
    try {
      const url = item.kind === "swap" ? `/api/swap-requests/${item.id}` : `/api/open-shift-claims/${item.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ tone: "danger", title: "Couldn't save that decision", description: json.error.message });
        return;
      }
      const warnings: { message: string }[] = json.data.warnings ?? [];
      if (decision === "approve" && warnings.length > 0) {
        toast({
          tone: "warning",
          title: "Approved with a conflict",
          description: warnings.map((w) => w.message).join(" "),
        });
      } else {
        toast({
          tone: "success",
          title: decision === "approve" ? "Request approved" : "Request denied",
          description: `${item.employeeName} will be notified.`,
        });
      }
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't save that decision", description: "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "var(--font-sans)" }}>
      {items.map((item) => (
        <Card key={`${item.kind}-${item.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.employeeName}</span>
              <Badge tone={item.kind === "swap" ? "info" : "warning"}>
                {item.kind === "swap" ? "Swap" : "Open shift"}
              </Badge>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.detail}</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
              {item.subDetail}
              {item.note ? ` · "${item.note}"` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <Button variant="ghost" size="sm" disabled={busyId === item.id} onClick={() => decide(item, "deny")}>
              Deny
            </Button>
            <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => decide(item, "approve")}>
              Approve
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds.

Then `npm run dev` as Jamie on `/manager/swaps`: the seed's pending swap and pending claim both appear with type badges; Approve/Deny work and refresh the list; approving a swap that double-books the coverer shows the "Approved with a conflict" warning toast quoting the specific overlap message.

- [ ] **Step 4: Commit**

```bash
git add src/app/manager/swaps src/components/manager/ApprovalsQueue.tsx
git commit -m "feat: manager approvals queue with type badges and conflict-warning toasts"
```

---
### Task 17: Haversine geo library (`src/lib/geo.ts`)

Pure math for the soft geofence (spec decision #11): distance between two lat/lng points, and a within-radius predicate.

**Files:**
- Create: `src/lib/geo.ts`
- Test: `src/lib/geo.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (Task 18/19 consume):
  - `type LatLng = { lat: number; lng: number }`
  - `haversineMeters(a: LatLng, b: LatLng): number`
  - `isWithinGeofence(point: LatLng, center: LatLng, radiusM: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/geo.test.ts
import { describe, expect, it } from "vitest";
import { haversineMeters, isWithinGeofence } from "@/lib/geo";

const NYC = { lat: 40.7128, lng: -74.006 };
const LA = { lat: 34.0522, lng: -118.2437 };

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(NYC, NYC)).toBe(0);
  });

  it("measures ~1.11 km per 0.01 degrees of latitude", () => {
    const d = haversineMeters(NYC, { lat: 40.7228, lng: -74.006 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1125);
  });

  it("measures NYC to LA at ~3,936 km", () => {
    const d = haversineMeters(NYC, LA);
    expect(d).toBeGreaterThan(3_925_000);
    expect(d).toBeLessThan(3_950_000);
  });

  it("is symmetric", () => {
    expect(haversineMeters(NYC, LA)).toBeCloseTo(haversineMeters(LA, NYC), 6);
  });
});

describe("isWithinGeofence", () => {
  it("accepts a point ~50 m away with a 150 m radius", () => {
    const near = { lat: 40.71325, lng: -74.006 }; // ~50 m north
    expect(isWithinGeofence(near, NYC, 150)).toBe(true);
  });

  it("rejects a point ~1.1 km away with a 150 m radius", () => {
    expect(isWithinGeofence({ lat: 40.7228, lng: -74.006 }, NYC, 150)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/geo.ts
// Great-circle distance (haversine). Used by the time clock's soft
// geofence: out-of-range punches are recorded and flagged, never blocked.

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isWithinGeofence(point: LatLng, center: LatLng, radiusM: number): boolean {
  return haversineMeters(point, center) <= radiusM;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts src/lib/geo.test.ts
git commit -m "feat: haversine distance and geofence predicate"
```

---

### Task 18: Time-clock domain library (`src/lib/timeclock.ts`)

Pure shift-matching and hours math (unit-tested), plus the prisma-backed screen state used by the clock page and `GET /api/me/time-clock`.

**Files:**
- Create: `src/lib/timeclock.ts`
- Test: `src/lib/timeclock.test.ts` (pure functions only — the API task integration-tests the rest)

**Interfaces:**
- Consumes: `prisma`; `formatShiftRange`, `localToUtc` (`@/lib/time`); `TZDate` (`@date-fns/tz`), `format` (`date-fns`).
- Produces (Tasks 19/20 consume):
  - `CLOCK_IN_EARLY_MS = 30 * 60 * 1000`
  - `pickClockInShift<T extends { id; startsAt: Date; endsAt: Date }>(shifts: T[], now: Date): T | null` — earliest shift with `startsAt − 30 min ≤ now ≤ endsAt`
  - `sumHoursToday(entries: { clockInAt: Date; clockOutAt: Date | null }[], now: Date): number` — open entries count up to `now`; rounded to 1 decimal
  - `type TimeClockState = { activeEntry: { id; clockInAt: string; positionName: string | null } | null; todayShift: { id; positionName: string; timeLabel: string } | null; locationName: string; hoursToday: number }`
  - `getTimeClockState(employeeProfileId: string): Promise<TimeClockState>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/timeclock.test.ts
import { describe, expect, it } from "vitest";
import { pickClockInShift, sumHoursToday } from "@/lib/timeclock";

const T = (iso: string) => new Date(iso);

describe("pickClockInShift", () => {
  const shifts = [
    { id: "a", startsAt: T("2026-07-10T11:00:00Z"), endsAt: T("2026-07-10T19:00:00Z") },
    { id: "b", startsAt: T("2026-07-10T19:00:00Z"), endsAt: T("2026-07-11T01:00:00Z") },
  ];

  it("matches a shift once inside the 30-minute early window", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T10:31:00Z"))?.id).toBe("a");
  });

  it("does not match more than 30 minutes early", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T10:29:00Z"))).toBeNull();
  });

  it("matches until the shift ends", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T18:59:00Z"))?.id).toBe("a");
  });

  it("prefers the earlier shift when windows overlap", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T18:45:00Z"))?.id).toBe("a");
  });

  it("returns null when nothing matches", () => {
    expect(pickClockInShift([], T("2026-07-10T12:00:00Z"))).toBeNull();
  });
});

describe("sumHoursToday", () => {
  it("sums completed entries to one decimal", () => {
    const entries = [
      { clockInAt: T("2026-07-10T11:00:00Z"), clockOutAt: T("2026-07-10T15:30:00Z") }, // 4.5
      { clockInAt: T("2026-07-10T16:00:00Z"), clockOutAt: T("2026-07-10T19:00:00Z") }, // 3
    ];
    expect(sumHoursToday(entries, T("2026-07-10T20:00:00Z"))).toBe(7.5);
  });

  it("counts an open entry up to now", () => {
    const entries = [{ clockInAt: T("2026-07-10T11:00:00Z"), clockOutAt: null }];
    expect(sumHoursToday(entries, T("2026-07-10T13:00:00Z"))).toBe(2);
  });

  it("returns 0 with no entries", () => {
    expect(sumHoursToday([], T("2026-07-10T13:00:00Z"))).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/timeclock.test.ts`
Expected: FAIL — cannot resolve `@/lib/timeclock`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/timeclock.ts
// Time-clock domain logic. Pure helpers up top (unit-tested); the
// prisma-backed screen state below (integration-tested via the API).
import { prisma } from "@/lib/db";
import { formatShiftRange, localToUtc } from "@/lib/time";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const CLOCK_IN_EARLY_MS = 30 * 60 * 1000;

export function pickClockInShift<T extends { id: string; startsAt: Date; endsAt: Date }>(
  shifts: T[],
  now: Date,
): T | null {
  const eligible = shifts
    .filter((s) => s.startsAt.getTime() - CLOCK_IN_EARLY_MS <= now.getTime() && now.getTime() <= s.endsAt.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return eligible[0] ?? null;
}

export function sumHoursToday(
  entries: { clockInAt: Date; clockOutAt: Date | null }[],
  now: Date,
): number {
  const ms = entries.reduce((total, e) => total + ((e.clockOutAt ?? now).getTime() - e.clockInAt.getTime()), 0);
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export type TimeClockState = {
  activeEntry: { id: string; clockInAt: string; positionName: string | null } | null;
  todayShift: { id: string; positionName: string; timeLabel: string } | null;
  locationName: string;
  hoursToday: number;
};

export async function getTimeClockState(employeeProfileId: string): Promise<TimeClockState> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true },
  });
  const tz = profile.location.timezone;
  const now = new Date();
  const todayISO = format(new TZDate(now, tz), "yyyy-MM-dd");
  const localMidnight = localToUtc(todayISO, { hour: 0, minute: 0 }, tz);

  const [active, todayShifts, entriesToday] = await Promise.all([
    prisma.timeClockEntry.findFirst({
      where: { employeeProfileId, clockOutAt: null },
      include: { shift: { include: { position: true } } },
      orderBy: { clockInAt: "desc" },
    }),
    prisma.shift.findMany({
      where: { employeeProfileId, status: "published", date: new Date(todayISO) },
      include: { position: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeClockEntry.findMany({
      where: { employeeProfileId, clockInAt: { gte: localMidnight } },
    }),
  ]);

  const nextToday = todayShifts.find((s) => s.endsAt.getTime() > now.getTime()) ?? null;
  return {
    activeEntry: active
      ? { id: active.id, clockInAt: active.clockInAt.toISOString(), positionName: active.shift?.position.name ?? null }
      : null,
    todayShift: nextToday
      ? { id: nextToday.id, positionName: nextToday.position.name, timeLabel: formatShiftRange(nextToday.startsAt, nextToday.endsAt, tz) }
      : null,
    locationName: profile.location.name,
    hoursToday: sumHoursToday(entriesToday, now),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/timeclock.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeclock.ts src/lib/timeclock.test.ts
git commit -m "feat: time-clock shift matching and hours math"
```

---

### Task 19: Time-clock API (`GET /api/me/time-clock`, `POST /api/time-clock/clock-in`, `POST /api/time-clock/clock-out`)

Soft geofence per spec decision #11: when both the punch and the location have coordinates, compute the haversine distance against `geofenceRadiusM` (default 150 m when null) → `locationVerified: true | false`. Missing coordinates on either side → `locationVerified: null`. Out-of-range or missing NEVER blocks the punch. Clock-in auto-links the matching shift (my published shift at this location whose `startsAt − 30 min ≤ now ≤ endsAt`).

**Files:**
- Create: `src/app/api/me/time-clock/route.ts`
- Create: `src/app/api/time-clock/clock-in/route.ts`
- Create: `src/app/api/time-clock/clock-out/route.ts`
- Test: `src/tests/time-clock.api.test.ts`

**Interfaces:**
- Consumes: `sessionUser` (Task 3); `getEmployeeProfile` (returns `{ ...profile, location }`); `prisma`; `pickClockInShift`, `sumHoursToday`, `getTimeClockState`, `CLOCK_IN_EARLY_MS` (Task 18); `isWithinGeofence` (Task 17); `localToUtc` (`@/lib/time`); factory + `createShiftAt` + `signInAs` (Task 2). Schema: `TimeClockEntry { employeeProfileId, shiftId?, locationId, clockInAt, clockOutAt?, clockInLat/Lng?, clockOutLat/Lng? }`; `Location.latitude/longitude` are Prisma `Decimal` — convert with `Number(...)`.
- Produces:
  - `GET /api/me/time-clock` → `{ ok: true, data: TimeClockState }`
  - `POST /api/time-clock/clock-in` — body `{ lat?: number, lng?: number }` → `{ ok: true, data: { entryId, clockInAt, positionName: string | null, locationVerified: boolean | null } }`; 409 `already_clocked_in`.
  - `POST /api/time-clock/clock-out` — body `{ lat?, lng? }` → `{ ok: true, data: { hoursToday: number, locationVerified: boolean | null } }`; 409 `not_clocked_in`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/time-clock.api.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/me/time-clock/route";
import { POST as clockIn } from "@/app/api/time-clock/clock-in/route";
import { POST as clockOut } from "@/app/api/time-clock/clock-out/route";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function post(body: unknown) {
  return new Request("http://test/api/time-clock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ON_SITE = { lat: 40.7128, lng: -74.006 }; // fixture location coordinates
const FAR_AWAY = { lat: 34.0522, lng: -118.2437 };

describe("time clock API", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("clock-in on site links the current shift and verifies location", async () => {
    const now = Date.now();
    const shift = await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: new Date(now - 60 * 60 * 1000),
      endsAt: new Date(now + 4 * 60 * 60 * 1000),
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockIn(post(ON_SITE));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.locationVerified).toBe(true);
    expect(json.data.positionName).toBe("Server");
    const entry = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: json.data.entryId } });
    expect(entry.shiftId).toBe(shift.id);
    expect(Number(entry.clockInLat)).toBeCloseTo(ON_SITE.lat, 4);

    // GET reflects the active entry
    const state = await (await GET()).json();
    expect(state.data.activeEntry?.id).toBe(json.data.entryId);

    // Double clock-in is a conflict
    const dup = await clockIn(post(ON_SITE));
    expect(dup.status).toBe(409);

    // Clock out returns hours worked today
    const out = await clockOut(post(ON_SITE));
    const outJson = await out.json();
    expect(outJson.ok).toBe(true);
    expect(outJson.data.hoursToday).toBeGreaterThan(0);
  });

  it("clock-in far away is recorded and flagged, never blocked", async () => {
    signInAs(f.ben.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockIn(post(FAR_AWAY));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.locationVerified).toBe(false);
    expect(json.data.positionName).toBeNull(); // no shift scheduled now
    await clockOut(post(FAR_AWAY));
  });

  it("clock-in without coordinates records with unknown verification", async () => {
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockIn(post({}));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.locationVerified).toBeNull();
    const entry = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: json.data.entryId } });
    expect(entry.clockInLat).toBeNull();
    await clockOut(post({}));
  });

  it("clock-out without an active entry is a conflict", async () => {
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockOut(post({}));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("not_clocked_in");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/time-clock.api.test.ts`
Expected: FAIL — cannot resolve the three route modules.

- [ ] **Step 3: Implement the routes**

```ts
// src/app/api/me/time-clock/route.ts
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { getTimeClockState } from "@/lib/timeclock";

export async function GET() {
  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  let profileId: string;
  try {
    profileId = (await getEmployeeProfile(user.id)).id;
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }
  return jsonOk(await getTimeClockState(profileId));
}
```

```ts
// src/app/api/time-clock/clock-in/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { isWithinGeofence } from "@/lib/geo";
import { CLOCK_IN_EARLY_MS, pickClockInShift } from "@/lib/timeclock";

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

function verifyLocation(
  lat: number | undefined,
  lng: number | undefined,
  location: { latitude: unknown; longitude: unknown; geofenceRadiusM: number | null },
): boolean | null {
  if (lat == null || lng == null || location.latitude == null || location.longitude == null) return null;
  return isWithinGeofence(
    { lat, lng },
    { lat: Number(location.latitude), lng: Number(location.longitude) },
    location.geofenceRadiusM ?? 150,
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = coordsSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Location coordinates look invalid.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const active = await prisma.timeClockEntry.findFirst({
    where: { employeeProfileId: profile.id, clockOutAt: null },
  });
  if (active) return jsonErr("already_clocked_in", "You're already clocked in.", 409);

  const now = new Date();
  const candidates = await prisma.shift.findMany({
    where: {
      employeeProfileId: profile.id,
      locationId: profile.locationId,
      status: "published",
      startsAt: { lte: new Date(now.getTime() + CLOCK_IN_EARLY_MS) },
      endsAt: { gte: now },
    },
    include: { position: true },
  });
  const matched = pickClockInShift(candidates, now);

  const { lat, lng } = parsed.data;
  const locationVerified = verifyLocation(lat, lng, profile.location);

  const entry = await prisma.timeClockEntry.create({
    data: {
      employeeProfileId: profile.id,
      locationId: profile.locationId,
      shiftId: matched?.id ?? null,
      clockInAt: now,
      clockInLat: lat ?? null,
      clockInLng: lng ?? null,
    },
  });

  return jsonOk({
    entryId: entry.id,
    clockInAt: entry.clockInAt.toISOString(),
    positionName: matched?.position.name ?? null,
    locationVerified,
  });
}
```

```ts
// src/app/api/time-clock/clock-out/route.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { isWithinGeofence } from "@/lib/geo";
import { getTimeClockState } from "@/lib/timeclock";

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = coordsSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Location coordinates look invalid.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const active = await prisma.timeClockEntry.findFirst({
    where: { employeeProfileId: profile.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!active) return jsonErr("not_clocked_in", "You're not clocked in right now.", 409);

  const { lat, lng } = parsed.data;
  const loc = profile.location;
  const locationVerified =
    lat == null || lng == null || loc.latitude == null || loc.longitude == null
      ? null
      : isWithinGeofence({ lat, lng }, { lat: Number(loc.latitude), lng: Number(loc.longitude) }, loc.geofenceRadiusM ?? 150);

  await prisma.timeClockEntry.update({
    where: { id: active.id },
    data: { clockOutAt: new Date(), clockOutLat: lat ?? null, clockOutLng: lng ?? null },
  });

  const state = await getTimeClockState(profile.id);
  return jsonOk({ hoursToday: state.hoursToday, locationVerified });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/time-clock.api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/me/time-clock src/app/api/time-clock src/tests/time-clock.api.test.ts
git commit -m "feat: geolocated time-clock API with soft geofence and shift matching"
```

---

### Task 20: Time-clock screen (`/(employee)/clock`)

Per TimeClockScreen, fixed: a big round REAL `<button>` (the export used a div), an elapsed timer while clocked in, today's-shift context, a permission-denied state that still punches, and a last-punch summary ("Clocked out — 7.5 hrs today.").

**Files:**
- Create: `src/app/(employee)/clock/page.tsx` (replace the Phase 4 placeholder if one exists)
- Create: `src/app/(employee)/clock/loading.tsx`
- Create: `src/app/(employee)/clock/error.tsx`
- Create: `src/components/employee/TimeClock.tsx`
- Create: `src/components/employee/TimeClock.module.css`

**Interfaces:**
- Consumes: `requireUser`; `getEmployeeProfile`; `getTimeClockState`, `TimeClockState` (Task 18); clock-in/out endpoints (Task 19); `formatDurationHrs` (`@/lib/time` — pure, safe in client bundles); `Card`, `Spinner`, `Button`, `Icon` primitives (`Icon({ name, size })` renders the pinned lucide set).
- Produces: `TimeClock({ initial }: { initial: TimeClockState })` client component; the `/clock` screen.

- [ ] **Step 1: Create page, loading, error**

```tsx
// src/app/(employee)/clock/page.tsx
import { requireUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/lib/authz";
import { getTimeClockState } from "@/lib/timeclock";
import { TimeClock } from "@/components/employee/TimeClock";

export default async function ClockPage() {
  const user = await requireUser();
  const profile = await getEmployeeProfile(user.id);
  const state = await getTimeClockState(profile.id);
  return <TimeClock initial={state} />;
}
```

```tsx
// src/app/(employee)/clock/loading.tsx
import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
      <Spinner />
    </div>
  );
}
```

```tsx
// src/app/(employee)/clock/error.tsx
"use client";

import { Button } from "@/components/ui/Button";

export default function ClockError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "48px 20px", textAlign: "center" }}>
      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 4px" }}>We couldn't load the time clock.</p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
        Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS module**

```css
/* src/components/employee/TimeClock.module.css */
.clockButton {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 20px 0;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 18px;
  box-shadow: var(--shadow-md);
  background: var(--surface-brand);
  color: var(--text-inverse);
  transition: transform 120ms ease;
}

.clockButton:hover {
  box-shadow: var(--shadow-lg);
}

.clockButton:active {
  transform: scale(0.97);
}

.clockButton:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus), var(--shadow-md);
}

.clockButton:disabled {
  cursor: default;
  opacity: 0.7;
}

.clockedIn {
  background: var(--status-danger-bg);
  color: var(--status-danger);
}
```

- [ ] **Step 3: Create the component**

```tsx
// src/components/employee/TimeClock.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatDurationHrs } from "@/lib/time";
import type { TimeClockState } from "@/lib/timeclock";
import styles from "./TimeClock.module.css";

type Phase =
  | { kind: "out" }
  | { kind: "in"; clockInAt: string; positionName: string | null }
  | { kind: "summary"; hoursToday: number };

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // denied, unavailable, or timed out — punch anyway
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

function formatElapsed(fromIso: string, nowMs: number): string {
  const total = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

export function TimeClock({ initial }: { initial: TimeClockState }) {
  const [phase, setPhase] = useState<Phase>(
    initial.activeEntry
      ? { kind: "in", clockInAt: initial.activeEntry.clockInAt, positionName: initial.activeEntry.positionName }
      : { kind: "out" },
  );
  const [busy, setBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const clockedIn = phase.kind === "in";

  useEffect(() => {
    if (!clockedIn) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clockedIn]);

  async function punch() {
    setBusy(true);
    setError(null);
    setGeoNote(null);
    const coords = await getPosition();
    const endpoint = clockedIn ? "/api/time-clock/clock-out" : "/api/time-clock/clock-in";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords ?? {}),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      if (clockedIn) {
        setPhase({ kind: "summary", hoursToday: json.data.hoursToday });
        if (coords === null) {
          setGeoNote("We couldn't get your location — you're still clocked out; your manager may follow up.");
        } else if (json.data.locationVerified === false) {
          setGeoNote("Your location looks out of range — you're still clocked out; your manager may follow up.");
        }
      } else {
        setPhase({ kind: "in", clockInAt: json.data.clockInAt, positionName: json.data.positionName });
        if (coords === null) {
          setGeoNote("We couldn't get your location — you're still clocked in; your manager may follow up.");
        } else if (json.data.locationVerified === false) {
          setGeoNote("Your location looks out of range — you're still clocked in; your manager may follow up.");
        }
      }
    } catch {
      setError("Something went wrong. You may not be clocked " + (clockedIn ? "out" : "in") + " — try again.");
    } finally {
      setBusy(false);
    }
  }

  const statusLine = clockedIn
    ? `Clocked in${phase.kind === "in" && phase.positionName ? ` for ${phase.positionName}` : ""} · ${initial.locationName}`
    : "You're not clocked in right now.";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "18px 20px 20px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", margin: 0 }}>
        Time clock
      </h1>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{statusLine}</div>

        {clockedIn && phase.kind === "in" && (
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {formatElapsed(phase.clockInAt, nowMs)}
          </div>
        )}

        <button
          type="button"
          className={`${styles.clockButton}${clockedIn ? ` ${styles.clockedIn}` : ""}`}
          disabled={busy}
          onClick={punch}
        >
          <Icon name={clockedIn ? "square" : "play"} size={28} />
          {busy ? "One moment…" : clockedIn ? "Clock out" : "Clock in"}
        </button>

        {phase.kind === "summary" && (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              Clocked out — {formatDurationHrs(phase.hoursToday)} today.
            </p>
          </Card>
        )}

        {phase.kind === "out" && initial.todayShift && (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              Today: {initial.todayShift.positionName}, {initial.todayShift.timeLabel}
            </p>
          </Card>
        )}

        {geoNote && (
          <p role="status" style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            {geoNote}
          </p>
        )}
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)", margin: 0 }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
          Uses your phone's location to confirm you're on-site.
        </p>
      </div>
    </div>
  );
}
```

Note: the summary state intentionally survives until navigation. When the page reloads, `getTimeClockState` shows the fresh "out" state with today's shift context — that's correct.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds.

Then `npm run dev` as Maria on `/clock`: the round button is keyboard-focusable (Tab reaches it, `--shadow-focus` ring visible); clocking in starts the elapsed timer and shows the shift name when one is scheduled now; blocking location permission in the browser still clocks in and shows the "We couldn't get your location…" note; clocking out shows "Clocked out — X hrs today."

- [ ] **Step 5: Commit**

```bash
git add "src/app/(employee)/clock" src/components/employee/TimeClock.tsx src/components/employee/TimeClock.module.css
git commit -m "feat: time-clock screen with real button, timer, and geolocation states"
```

---

### Task 21: Dashboard tie-ins — live "Clocked in now" and all-queue pending count

Phase 3's `src/lib/dashboard-data.ts` (`getDashboardData(locationId, timezone)`) already computes both figures correctly — its pending-requests count already sums pending time-off + swaps + claims, and its "Clocked in now" data already filters `TimeClockEntry` rows with `clockOutAt: null` by `locationId` (the table simply had no writers until this phase). This task is a refactor to shared counters, not a bug fix: add canonical counters to `src/lib/requests.ts`, swap the dashboard's inline queries for them so both surfaces share one definition, and pin behavior with an integration test.

**Files:**
- Modify: `src/lib/requests.ts` (add `countPendingRequests`, `countClockedInNow`)
- Modify: `src/lib/dashboard-data.ts` (Phase 3 file — swap its inline count queries for the shared counters)
- Test: `src/tests/dashboard-counts.test.ts`

**Interfaces:**
- Consumes: `prisma`; factory (Task 2); Phase 3's `src/lib/dashboard-data.ts` (exports `getDashboardData(locationId, timezone)` — the loader the `/manager` page calls).
- Produces:
  - `countPendingRequests(locationId: string): Promise<number>` — pending time-off + pending swaps + pending claims.
  - `countClockedInNow(locationId: string): Promise<number>` — `TimeClockEntry` rows with `clockOutAt: null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/dashboard-counts.test.ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { countClockedInNow, countPendingRequests } from "@/lib/requests";
import { createFixture, createShift, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";

describe("dashboard counters", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const myShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const openShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    // One of each pending queue + one decided row that must NOT count.
    await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date(isoDateFromNow(10, f.timezone)),
        endDate: new Date(isoDateFromNow(11, f.timezone)),
        reason: "vacation",
      },
    });
    await prisma.swapRequest.create({
      data: { shiftId: myShift.id, requestingEmployeeProfileId: f.ana.profileId, coveringEmployeeProfileId: null },
    });
    await prisma.openShiftClaim.create({ data: { shiftId: openShift.id, employeeProfileId: f.ben.profileId } });
    await prisma.openShiftClaim.create({
      data: { shiftId: openShift.id, employeeProfileId: f.cal.profileId, status: "denied", decidedAt: new Date() },
    });
    // One live clock entry, one completed.
    await prisma.timeClockEntry.create({
      data: { employeeProfileId: f.ana.profileId, locationId: f.locationId, clockInAt: new Date() },
    });
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ben.profileId,
        locationId: f.locationId,
        clockInAt: new Date(Date.now() - 8 * 3_600_000),
        clockOutAt: new Date(Date.now() - 3_600_000),
      },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("counts pending requests across all three queues", async () => {
    expect(await countPendingRequests(f.locationId)).toBe(3);
  });

  it("counts only currently clocked-in employees", async () => {
    expect(await countClockedInNow(f.locationId)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/dashboard-counts.test.ts`
Expected: FAIL — `countPendingRequests` / `countClockedInNow` not exported.

- [ ] **Step 3: Add the counters to `src/lib/requests.ts`**

Append:

```ts
export async function countPendingRequests(locationId: string): Promise<number> {
  const [timeOff, swaps, claims] = await Promise.all([
    prisma.timeOffRequest.count({ where: { status: "pending", employeeProfile: { locationId } } }),
    prisma.swapRequest.count({ where: { status: "pending", shift: { locationId } } }),
    prisma.openShiftClaim.count({ where: { status: "pending", shift: { locationId } } }),
  ]);
  return timeOff + swaps + claims;
}

export async function countClockedInNow(locationId: string): Promise<number> {
  return prisma.timeClockEntry.count({ where: { locationId, clockOutAt: null } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/dashboard-counts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the dashboard (pure dedupe refactor)**

Open `src/lib/dashboard-data.ts` (Phase 3). `getDashboardData(locationId, timezone)` already computes the right values inline; swap those inline queries for the shared counters so both surfaces use one definition:

1. the pending-requests total — it already sums the three pending queues (time-off + swaps + claims). Replace the three inline count queries feeding that total with `await countPendingRequests(locationId)` (import `countPendingRequests` from `@/lib/requests`; `locationId` is the loader's location argument). If the return shape also exposes the per-queue counts separately, keep those fields wired exactly as they are — only the total moves to the shared counter.
2. the clocked-in-now count — it already queries `TimeClockEntry` with `{ locationId, clockOutAt: null }`. Replace the count with `await countClockedInNow(locationId)`, keeping the `clockedInNow` name list (`{ name, positionName | null }[]`) query intact — the count and the list must stay consistent.

Behavior does not change; this removes duplicated query definitions now that Phase 5 also needs them. Keep `getDashboardData`'s exported name and return shape exactly as-is — the `/manager` page depends on them.

- [ ] **Step 6: Verify**

Run: `npm run build && npx vitest run`
Expected: build passes; the full suite is green. Phase 3's dashboard-data tests must still pass unchanged — they already assert the all-queues pending count (seed: 1 time-off + 1 swap + 1 claim = 3), which is exactly what the shared counter returns; if any assertion breaks, the refactor changed behavior and the refactor (not the test) is wrong.

Then `npm run dev` as Jamie on `/manager`: "Pending requests" reflects time off + swaps + claims (seed: 3); after Maria clocks in on `/clock`, refreshing the dashboard shows "Clocked in now: 1".

- [ ] **Step 7: Commit**

```bash
git add src/lib/requests.ts src/lib/dashboard-data.ts src/tests/dashboard-counts.test.ts
git commit -m "refactor: dashboard shares canonical pending-request and clocked-in counters"
```

---
### Task 22: SMS body templates and deep links in the notifier

Every notification type gets an SMS body: "RosterHouse: {title}. {body} {deep-link URL}" — sentence case, calm, with a per-type deep link into the app. The driver stays ConsoleDriver; only the body it receives gets smarter.

**Files:**
- Create: `src/lib/notify/templates.ts`
- Modify: `src/lib/notify/index.ts` (route SMS sends through the template)
- Test: `src/lib/notify/templates.test.ts`

**Interfaces:**
- Consumes: `NotificationType` enum type from `@/generated/prisma/client` (`schedule_published`, `shift_reminder`, `swap_approved`, `swap_denied`, `timeoff_approved`, `timeoff_denied`, `claim_approved`, `claim_denied`, `open_shift_posted`); Phase 3's `src/lib/notify/index.ts` (its `notifyUsers` resolves per-user channel prefs and calls `driver.sendSms(phone, body)`); env `APP_URL` (optional, default `http://localhost:3000`).
- Produces:
  - `deepLinkFor(type: NotificationType): string` — absolute URL.
  - `smsBodyFor(input: { type: NotificationType; title: string; body: string }): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/notify/templates.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { deepLinkFor, smsBodyFor } from "@/lib/notify/templates";

afterEach(() => {
  delete process.env.APP_URL;
});

describe("deepLinkFor", () => {
  it("maps every notification type to an employee-app path", () => {
    expect(deepLinkFor("schedule_published")).toBe("http://localhost:3000/");
    expect(deepLinkFor("shift_reminder")).toBe("http://localhost:3000/");
    expect(deepLinkFor("swap_approved")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("swap_denied")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("claim_approved")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("claim_denied")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("open_shift_posted")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("timeoff_approved")).toBe("http://localhost:3000/availability");
    expect(deepLinkFor("timeoff_denied")).toBe("http://localhost:3000/availability");
  });

  it("respects APP_URL", () => {
    process.env.APP_URL = "https://rosterhouse.example.com";
    expect(deepLinkFor("swap_approved")).toBe("https://rosterhouse.example.com/swaps");
  });
});

describe("smsBodyFor", () => {
  it("composes a calm sentence-case body with the deep link", () => {
    expect(
      smsBodyFor({
        type: "swap_approved",
        title: "Swap approved",
        body: "Ben Cho will cover your Sat Jul 12 Server shift, 4:00 PM – 10:00 PM.",
      }),
    ).toBe(
      "RosterHouse: Swap approved. Ben Cho will cover your Sat Jul 12 Server shift, 4:00 PM – 10:00 PM. http://localhost:3000/swaps",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notify/templates.test.ts`
Expected: FAIL — cannot resolve `@/lib/notify/templates`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/notify/templates.ts
// SMS bodies per notification type: "RosterHouse: {title}. {body} {url}".
// Sentence case, no exclamation points, one deep link into the app.
import type { NotificationType } from "@/generated/prisma/client";

const DEEP_LINK_PATHS: Record<NotificationType, string> = {
  schedule_published: "/",
  shift_reminder: "/",
  swap_approved: "/swaps",
  swap_denied: "/swaps",
  timeoff_approved: "/availability",
  timeoff_denied: "/availability",
  claim_approved: "/swaps",
  claim_denied: "/swaps",
  open_shift_posted: "/swaps",
};

export function deepLinkFor(type: NotificationType): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${DEEP_LINK_PATHS[type]}`;
}

export function smsBodyFor(input: { type: NotificationType; title: string; body: string }): string {
  return `RosterHouse: ${input.title}. ${input.body} ${deepLinkFor(input.type)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notify/templates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Route SMS sends through the template**

Open `src/lib/notify/index.ts` (Phase 3). Inside `notifyUsers`, find the SMS dispatch — the call shaped like `driver.sendSms(<phone>, <something derived from the input>)` (it runs when the recipient's profile has `notifySms` true and the user has a `phone`). Change it to send the templated body:

```ts
import { smsBodyFor } from "./templates";
// ...at the existing sendSms call site, for the current NotifyInput `input`:
await driver.sendSms(phone, smsBodyFor(input));
```

Use the file's actual local variable names for the phone number and input; change nothing else about channel resolution or Notification-row writes.

- [ ] **Step 6: Verify**

Run: `npx vitest run`
Expected: whole suite green (Phase 3 notify tests included — if one asserts the raw body was sent over SMS, update it to expect `smsBodyFor(input)`; the in-app Notification row keeps the raw title/body).

Quick manual check: `npm run dev`, approve any pending request as Jamie, and confirm the dev-server console shows the ConsoleDriver SMS line ending with a deep-link URL.

- [ ] **Step 7: Commit**

```bash
git add src/lib/notify/templates.ts src/lib/notify/templates.test.ts src/lib/notify/index.ts
git commit -m "feat: SMS body templates with per-type deep links"
```

---

### Task 23 (OPTIONAL — deferred by spec; env-gated, disabled by default, requires credentials; skip in CI): Twilio SMS driver drop-in

The spec's out-of-scope list defers the SMS provider hookup ("interface ready, driver stubbed"); per the spec amendment, the driver may ship behind env vars, disabled by default. Do this task only when real Twilio credentials are available; it is not required for the phase gate and must be skipped in CI. Without env vars the app keeps using the console driver, so shipping this code is harmless.

**Files:**
- Create: `src/lib/notify/twilio.ts`
- Modify: `src/lib/notify/index.ts` (driver selection)
- Modify: `.env.example` (document the vars; create the file if the repo lacks one)

**Interfaces:**
- Consumes: `ChannelDriver` interface and the `consoleDriver` object (`@/lib/notify`, Phase 3 — an object-literal export used as `notifyUsers`' default parameter, not a class); env `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- Produces: `TwilioDriver implements ChannelDriver` from `@/lib/notify/twilio`; env-based driver selection in `src/lib/notify/index.ts`.

- [ ] **Step 1: Write the driver (plain fetch — no SDK dependency)**

```ts
// src/lib/notify/twilio.ts
// Twilio SMS driver. Selected automatically when TWILIO_* env vars are set
// (see index.ts). Push stays a no-op until the PWA pass ships web push.
import type { ChannelDriver } from "./index";

export class TwilioDriver implements ChannelDriver {
  async sendSms(phone: string, body: string): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      throw new Error("TwilioDriver selected without TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER set.");
    }
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: from, Body: body }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Twilio send failed: ${res.status} ${await res.text()}`);
    }
  }

  async sendPush(): Promise<void> {
    // Web push ships with the PWA pass; SMS is the primary channel for now.
  }
}
```

If `ChannelDriver` is not exported from `src/lib/notify/index.ts`, add `export` to the interface declaration there (it is pinned in the roadmap contract, so it should already be exported).

- [ ] **Step 2: Select the driver by environment**

Phase 3's console driver is `export const consoleDriver: ChannelDriver = { ... }` — an object literal, not a class (there is no `ConsoleDriver` class and no construction site; `new ConsoleDriver()` doesn't exist). `notifyUsers` takes it as a default parameter: `driver: ChannelDriver = consoleDriver`. In `src/lib/notify/index.ts`, add an env-selected default driver and use it as that default-parameter value:

```ts
import { TwilioDriver } from "./twilio";
// ...
const defaultDriver: ChannelDriver = process.env.TWILIO_ACCOUNT_SID ? new TwilioDriver() : consoleDriver;
// ...in notifyUsers' signature, change the default parameter:
export async function notifyUsers(inputs: NotifyInput[], driver: ChannelDriver = defaultDriver): Promise<{ count: number }> {
```

(Keep the existing `consoleDriver` object exported and untouched — it remains the default and the CI path; no class conversion is needed.)

- [ ] **Step 3: Document the env vars**

Append to `.env.example`:

```bash
# Twilio SMS driver (optional — deferred by spec; disabled by default). When
# TWILIO_ACCOUNT_SID is set, notify/ switches from consoleDriver to TwilioDriver.
# Leave unset in CI.
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
# Absolute app URL used in SMS deep links (defaults to http://localhost:3000).
APP_URL=
```

- [ ] **Step 4: Verify**

Run: `npm run build && npx vitest run`
Expected: both green with no Twilio env set (`consoleDriver` still selected — the suite never hits Twilio).

With real credentials in `.env.local` only (never committed): approve a request for a user whose `User.phone` is your test phone and confirm the SMS arrives with the deep link.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notify/twilio.ts src/lib/notify/index.ts .env.example
git commit -m "feat: optional Twilio SMS driver behind env vars"
```

---

### Task 24: End-of-phase verification gate + QA checklist

**Files:** none created — this is the phase gate.

**Interfaces:**
- Consumes: everything above; seed logins `jamie@harborvine.test` / `rosterhouse1` (manager, "Harbor & Vine" → "Downtown") and `maria@harborvine.test` / `rosterhouse1` (employee); seed data includes one pending time-off, one pending swap, one pending claim, one open shift (the open shift sits in next week's DRAFT schedule — Step 5 publishes next week first so it becomes claimable).
- Produces: a verified, committed Phase 5.

- [ ] **Step 1: Automated gate**

```bash
docker compose up -d
npm run build
npx vitest run
git status
```

Expected: build passes; every test green; working tree clean; `git log --oneline` shows one commit per task above.

- [ ] **Step 2: Reset to a clean demo dataset**

```bash
npx prisma migrate reset --force
```

(Reseeds via `prisma/seed.ts`.) Start the app: `npm run dev`.

- [ ] **Step 3: QA — time-off loop, both ways**

As Maria (`/availability`):
1. "Request time off" → pick next Mon–Tue, reason Vacation → Send request → toast "Request sent — your manager will review it."; the request lists below with a Pending badge.
2. Send a second request with reason Other and no note → inline error "Tell your manager why you need this time off."; add a note → sends.

As Jamie (`/manager/time-off`):
3. Both new requests plus the seeded one appear, oldest first. Approve the vacation one → calm toast; it moves to "Decided in the last 30 days" with an Approved badge.
4. Deny the other with note "That week is fully booked already." → confirm dialog → denied.

As Maria:
5. Notifications feed shows "Time off approved" and "Time off request denied … Note from your manager: That week is fully booked already." Dev console shows both ConsoleDriver SMS lines ending in `/availability`.
6. As Jamie, open the schedule assign dialog for Maria during her approved days → the conflict warning mentions her approved time off.

- [ ] **Step 4: QA — swap loop, both ways**

As Maria:
1. From an upcoming shift's detail → "Request swap" → composer. Choose "A specific coworker" → the Select lists only coworkers qualified for that position. Pick one, add a note, Send → lands on `/swaps` with the request Pending under "My requests".
2. Try composing another swap for the same shift → "A swap request for this shift is already waiting for review."

As Jamie (`/manager/swaps`):
3. The request shows with a "Swap" badge, requester name, shift label, coverer line, and note. Deny it → toast; as Maria, both she and the named coverer get denial notifications ("…You're still scheduled." / "…Nothing changes for you.").
4. Maria composes a new swap, "Anyone qualified". Jamie approves → Maria's notification says the shift is now posted as an open shift; the shift appears in `/swaps` open-shifts list and the manager week grid shows it as open.
5. Conflict path: Maria requests a swap naming a coworker who already works an overlapping shift that day; Jamie approves → the "Approved with a conflict" warning toast quotes the overlap; the schedule shows the double-booked conflict.

- [ ] **Step 5: QA — open-shift claim loop, both ways**

Precondition (as Jamie): the seed's only open shift lives in NEXT week's DRAFT schedule, and open-shift listing only shows published shifts — go to `/manager/schedule`, page forward to next week, and publish it before starting this step.

As Maria (`/swaps`):
1. Claim the seeded (now published) open shift → button becomes a "Requested" badge (persists across reload — no fake success).
2. As a second employee (pick any seeded teammate qualified for that position; all seeded employees share the password), claim the same shift.

As Jamie (`/manager/swaps`):
3. Both claims show with "Open shift" badges. Approve Maria's → toast; the shift is assigned to Maria on the schedule.

As Maria: notification "Shift confirmed — The … shift is yours." and the shift now in her upcoming shifts. As the other claimant: "Shift filled — … went to another teammate this time." and their claim shows Denied under "My requests".
4. Deny path: Jamie posts/leaves another open shift, an employee claims it, Jamie denies → claimant notified, shift stays open and claimable by others.

- [ ] **Step 6: QA — time clock**

As Maria (`/clock`), during (or within 30 minutes before) one of her seeded shifts today if available, otherwise verify the no-shift path:
1. Allow location → Clock in: elapsed timer runs; status line names the position when a shift matched; dashboard (as Jamie) shows "Clocked in now: 1".
2. Clock out → "Clocked out — X hrs today." with the duration in "X hrs" format.
3. Block location permission in the browser, clock in again → still clocks in, with "We couldn't get your location — you're still clocked in; your manager may follow up."
4. Clock out again; confirm `/api/me/time-clock` (via the page after refresh) shows no active entry.

- [ ] **Step 7: QA — dashboard + notifications wrap-up**

As Jamie on `/manager`: "Pending requests" equals the sum of pending time-off + swaps + claims currently visible in the two queues; the numbers move as you approve/deny. As Maria: the bell/notifications feed contains every decision from this pass, each calm, sentence-case, 12-hour formatted, with no exclamation points.

- [ ] **Step 8: Final commit check**

```bash
git status
```

Expected: clean tree. Phase 5 is done — every request loop works both ways, the time clock is live, and every decision notifies the people it affects.
