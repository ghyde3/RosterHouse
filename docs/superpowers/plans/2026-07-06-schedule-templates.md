# Weekly Schedule Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a manager save a week's staffing pattern as a reusable named template, then stamp it onto a future week (with a review-and-confirm step for assignments) to pre-fill draft shifts they edit and publish as normal.

**Architecture:** Two new Prisma models (`ScheduleTemplate`, `ScheduleTemplateRow`) store day-of-week + wall-clock rows. A `lib/template-data.ts` domain layer snapshots a week into rows, resolves rows against a target week (conflict hints + occupancy), and applies them transactionally as draft shifts — reusing the existing `shiftInstants` / `getOrCreateSchedule` / `detectConflicts` engine verbatim. New `/api/schedule-templates` route handlers mirror the shift-API conventions exactly. UI adds two buttons to the schedule builder, an apply dialog, and a `/manager/templates` page with a row editor.

**Tech Stack:** Next.js 16 (App Router, RSC + route handlers), Prisma 7 + Postgres, zod 4, React 19, Vitest 4 (+ Testing Library), CSS modules + design tokens (no Tailwind).

## Global Constraints

- **Read before coding:** `node_modules/next/dist/docs/` is the source of truth for Next.js 16 (AGENTS.md). Route-handler dynamic params are `{ params: Promise<{ templateId: string }> }` and MUST be `await`ed. Server pages take `searchParams`/`params` as Promises.
- **No Tailwind.** Styling is CSS modules + CSS custom properties (design tokens). Reuse existing tokens/classes.
- **Tenancy is server-side.** Every endpoint calls `requireManagerForApi()` and scopes all queries to `guard.location.id`. Never trust a client-supplied locationId beyond the guard's location.
- **JSON envelopes:** success `jsonOk(data, status?)` → `{ ok: true, data }`; error `jsonErr(code, message, status)` → `{ ok: false, error: { code, message } }`; wrap handlers in `try { … } catch (err) { return handleApiError(err); }`. Throw `ApiError(status, code, message)` for expected failures inside helpers.
- **Conflicts are computed, never stored.** Apply writes plain draft shifts; the existing read path re-derives conflicts. Preview computes hints on the fly.
- **Time semantics:** `Location.timezone` (IANA) is the source of truth. Template rows store wall-clock 12-hour strings ("7:00 AM"); UTC instants are derived at apply/preview via `shiftInstants(date, parseTime12h(start)!, parseTime12h(end)!, timezone)`. `dayOfWeek` is `0=Mon..6=Sun` (matches `AvailabilityRule` and `dayOfWeekMon0`).
- **Prisma client import:** `import { prisma } from "@/lib/db";` Generated types: `import { Prisma } from "@/generated/prisma/client";`
- **Commit after every task** with a `feat:` / `test:` message. Branch is `feat/schedule-templates` (already checked out).
- **Verify commands:** `npm test` (vitest run), `npm run lint`, `npm run build` (runs `prisma generate` then `next build` — the typecheck gate).

---

### Task 1: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma` (add two models + three back-relations)

**Interfaces:**
- Produces: Prisma models `ScheduleTemplate { id, locationId, name, createdAt, updatedAt, location, rows }` and `ScheduleTemplateRow { id, templateId, positionId, employeeProfileId?, dayOfWeek, startTime, endTime, notes?, template, position, employeeProfile? }`. Delegates `prisma.scheduleTemplate` and `prisma.scheduleTemplateRow` on the generated client.

- [ ] **Step 1: Add the two models** at the end of `prisma/schema.prisma`:

```prisma
model ScheduleTemplate {
  id         String   @id @default(cuid())
  locationId String
  name       String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  location Location              @relation(fields: [locationId], references: [id], onDelete: Cascade)
  rows     ScheduleTemplateRow[]

  @@unique([locationId, name])
}

model ScheduleTemplateRow {
  id                String  @id @default(cuid())
  templateId        String
  positionId        String
  employeeProfileId String? // remembered default assignee; null = open slot
  dayOfWeek         Int // 0=Mon..6=Sun
  startTime         String // wall-clock, location-local, 12h ("7:00 AM")
  endTime           String
  notes             String?

  template        ScheduleTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  position        Position         @relation(fields: [positionId], references: [id], onDelete: Cascade)
  employeeProfile EmployeeProfile? @relation(fields: [employeeProfileId], references: [id], onDelete: SetNull)

  @@index([templateId])
}
```

- [ ] **Step 2: Add the back-relations** to the three existing models. In `model Location` (after `clockEntries TimeClockEntry[]`):

```prisma
  scheduleTemplates ScheduleTemplate[]
```

In `model Position` (after `invites          Invite[]`):

```prisma
  templateRows     ScheduleTemplateRow[]
```

In `model EmployeeProfile` (after `clockEntries    TimeClockEntry[]`):

```prisma
  templateRows    ScheduleTemplateRow[]
```

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name schedule-templates`
Expected: prints "Applying migration `..._schedule_templates`" then "✔ Generated Prisma Client". A new folder `prisma/migrations/<timestamp>_schedule_templates/migration.sql` exists.

- [ ] **Step 4: Verify the client typechecks with the new models**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

Run: `npx tsx -e "import { prisma } from './src/lib/db'; console.log(typeof prisma.scheduleTemplate.findMany, typeof prisma.scheduleTemplateRow.createMany)"`
Expected: prints `function function`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: schedule template Prisma models + migration"
```

---

### Task 2: Template zod schemas

**Files:**
- Create: `src/lib/template-schemas.ts`
- Test: `src/lib/__tests__/template-schemas.test.ts`

**Interfaces:**
- Consumes: `isoDateSchema`, `time12hSchema` from `@/lib/shift-schemas`.
- Produces:
  - `templateRowInputSchema` and `type TemplateRowInput = { positionId: string; employeeProfileId: string | null; dayOfWeek: number; startTime: string; endTime: string; notes?: string | null }`
  - `createTemplateSchema` → `{ name: string; fromWeek?: ISODate; rows?: TemplateRowInput[] }` (exactly one of `fromWeek` / `rows`)
  - `updateTemplateSchema` → `{ name?: string; rows?: TemplateRowInput[] }`
  - `previewTemplateSchema` → `{ targetWeek: ISODate }`
  - `applyTemplateSchema` → `{ targetWeek: ISODate; mode: "replace" | "add"; assignments: Record<string, string | null> }`

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/template-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyTemplateSchema,
  createTemplateSchema,
  templateRowInputSchema,
  updateTemplateSchema,
} from "@/lib/template-schemas";

describe("templateRowInputSchema", () => {
  const base = {
    positionId: "pos-1",
    employeeProfileId: null,
    dayOfWeek: 0,
    startTime: "7:00 AM",
    endTime: "3:00 PM",
  };

  it("accepts a valid open-slot row", () => {
    expect(templateRowInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects dayOfWeek out of 0..6", () => {
    expect(templateRowInputSchema.safeParse({ ...base, dayOfWeek: 7 }).success).toBe(false);
  });

  it("rejects a non-12h time", () => {
    expect(templateRowInputSchema.safeParse({ ...base, startTime: "13:00 PM" }).success).toBe(false);
  });
});

describe("createTemplateSchema", () => {
  it("accepts name + fromWeek", () => {
    expect(
      createTemplateSchema.safeParse({ name: "Standard week", fromWeek: "2026-07-06" }).success,
    ).toBe(true);
  });

  it("accepts name + empty rows (blank template)", () => {
    expect(createTemplateSchema.safeParse({ name: "Blank", rows: [] }).success).toBe(true);
  });

  it("rejects when neither fromWeek nor rows is present", () => {
    expect(createTemplateSchema.safeParse({ name: "Bad" }).success).toBe(false);
  });

  it("rejects when both fromWeek and rows are present", () => {
    expect(
      createTemplateSchema.safeParse({ name: "Bad", fromWeek: "2026-07-06", rows: [] }).success,
    ).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(createTemplateSchema.safeParse({ name: "", rows: [] }).success).toBe(false);
  });
});

describe("applyTemplateSchema", () => {
  it("accepts a replace with an assignments map", () => {
    const parsed = applyTemplateSchema.safeParse({
      targetWeek: "2026-07-13",
      mode: "replace",
      assignments: { "row-1": "ep-1", "row-2": null },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown mode", () => {
    expect(
      applyTemplateSchema.safeParse({ targetWeek: "2026-07-13", mode: "merge", assignments: {} }).success,
    ).toBe(false);
  });
});

describe("updateTemplateSchema", () => {
  it("accepts a rename only", () => {
    expect(updateTemplateSchema.safeParse({ name: "Renamed" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/template-schemas.test.ts`
Expected: FAIL — "Cannot find module '@/lib/template-schemas'".

- [ ] **Step 3: Write the implementation** `src/lib/template-schemas.ts`:

```ts
import { z } from "zod";
import { isoDateSchema, time12hSchema } from "@/lib/shift-schemas";

export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const templateRowInputSchema = z.object({
  positionId: z.string().min(1),
  employeeProfileId: z.string().min(1).nullable(),
  dayOfWeek: dayOfWeekSchema,
  startTime: time12hSchema,
  endTime: time12hSchema,
  notes: z.string().max(500).nullable().optional(),
});

export type TemplateRowInput = z.infer<typeof templateRowInputSchema>;

const nameSchema = z.string().min(1, { message: "Name your template" }).max(80);

// Create either by snapshotting a week (fromWeek) or from explicit rows
// (the editor, including a blank template with rows: []). Exactly one source.
export const createTemplateSchema = z
  .object({
    name: nameSchema,
    fromWeek: isoDateSchema.optional(),
    rows: z.array(templateRowInputSchema).optional(),
  })
  .refine((v) => (v.fromWeek === undefined) !== (v.rows === undefined), {
    message: "Provide either a week to snapshot or a set of rows",
  });

export const updateTemplateSchema = z.object({
  name: nameSchema.optional(),
  rows: z.array(templateRowInputSchema).optional(),
});

export const previewTemplateSchema = z.object({
  targetWeek: isoDateSchema,
});

export const applyTemplateSchema = z.object({
  targetWeek: isoDateSchema,
  mode: z.enum(["replace", "add"]),
  // rowId -> employeeProfileId (or null for an open slot)
  assignments: z.record(z.string(), z.string().min(1).nullable()),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/template-schemas.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/template-schemas.ts src/lib/__tests__/template-schemas.test.ts
git commit -m "feat: zod schemas for schedule templates"
```

---

### Task 3: Template data layer — types + CRUD helpers

**Files:**
- Create: `src/lib/template-data.ts`
- Test: `src/tests/template-data.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`), `Prisma` (`@/generated/prisma/client`), `ApiError` (`@/lib/api`), `TemplateRowInput` (`@/lib/template-schemas`), `parseTime12h` (`@/lib/time`).
- Produces (types):

```ts
export type TemplateRow = {
  id: string;
  positionId: string;
  positionName: string;
  employeeProfileId: string | null;
  employeeName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};
export type TemplateSummary = { id: string; name: string; rowCount: number; updatedAt: string };
export type TemplateDetail = { id: string; name: string; updatedAt: string; rows: TemplateRow[] };
```

- Produces (functions):
  - `listTemplates(locationId: string): Promise<TemplateSummary[]>`
  - `getTemplateDetail(locationId: string, templateId: string): Promise<TemplateDetail | null>`
  - `createTemplate(locationId: string, name: string, rows: TemplateRowInput[]): Promise<TemplateDetail>` — throws `ApiError(409, "name_taken", …)` on duplicate name.
  - `updateTemplate(locationId: string, templateId: string, patch: { name?: string; rows?: TemplateRowInput[] }): Promise<TemplateDetail | null>` — `null` if not found; throws `ApiError(409, "name_taken", …)` on rename collision.
  - `deleteTemplate(locationId: string, templateId: string): Promise<boolean>` — `false` if not found.
  - Internal: `TEMPLATE_ROW_INCLUDE` (Prisma include const) and `toTemplateRow(row)` / `sortRows(rows)` helpers reused by later tasks.

- [ ] **Step 1: Write the failing test** `src/tests/template-data.test.ts`:

```ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  createTemplate,
  deleteTemplate,
  getTemplateDetail,
  listTemplates,
  updateTemplate,
} from "@/lib/template-data";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("createTemplate / getTemplateDetail", () => {
  it("creates a template with rows and reads it back with resolved names", async () => {
    const detail = await createTemplate(f.locationId, "CRUD template", [
      {
        positionId: f.positionIds.server,
        employeeProfileId: f.ana.profileId,
        dayOfWeek: 0,
        startTime: "7:00 AM",
        endTime: "3:00 PM",
        notes: "Open the floor",
      },
    ]);
    expect(detail.name).toBe("CRUD template");
    expect(detail.rows).toHaveLength(1);
    expect(detail.rows[0].positionName).toBe("Server");
    expect(detail.rows[0].employeeName).toBe("Ana Diaz");
    expect(detail.rows[0].notes).toBe("Open the floor");

    const read = await getTemplateDetail(f.locationId, detail.id);
    expect(read?.rows[0].startTime).toBe("7:00 AM");
  });

  it("rejects a duplicate name at the same location with ApiError 409", async () => {
    await createTemplate(f.locationId, "Dup", []);
    await expect(createTemplate(f.locationId, "Dup", [])).rejects.toMatchObject({
      status: 409,
      code: "name_taken",
    });
  });
});

describe("listTemplates", () => {
  it("returns summaries with a row count", async () => {
    const created = await createTemplate(f.locationId, "Listed", [
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 1, startTime: "9:00 AM", endTime: "5:00 PM" },
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 2, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);
    const list = await listTemplates(f.locationId);
    const found = list.find((t) => t.id === created.id);
    expect(found?.rowCount).toBe(2);
  });

  it("does not leak templates from another location", async () => {
    const other = await createFixture();
    try {
      await createTemplate(other.locationId, "Foreign", []);
      const list = await listTemplates(f.locationId);
      expect(list.some((t) => t.name === "Foreign")).toBe(false);
    } finally {
      await destroyFixture(other);
    }
  });
});

describe("updateTemplate / deleteTemplate", () => {
  it("renames and replaces rows", async () => {
    const created = await createTemplate(f.locationId, "Before", [
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 0, startTime: "8:00 AM", endTime: "4:00 PM" },
    ]);
    const updated = await updateTemplate(f.locationId, created.id, {
      name: "After",
      rows: [
        { positionId: f.positionIds.dishwasher, employeeProfileId: null, dayOfWeek: 5, startTime: "6:00 PM", endTime: "11:00 PM" },
      ],
    });
    expect(updated?.name).toBe("After");
    expect(updated?.rows).toHaveLength(1);
    expect(updated?.rows[0].positionName).toBe("Dishwasher");
  });

  it("returns null when updating a template at the wrong location", async () => {
    const created = await createTemplate(f.locationId, "Scoped", []);
    const other = await createFixture();
    try {
      const res = await updateTemplate(other.locationId, created.id, { name: "Hijack" });
      expect(res).toBeNull();
    } finally {
      await destroyFixture(other);
    }
  });

  it("deletes and reports found/not-found", async () => {
    const created = await createTemplate(f.locationId, "Doomed", []);
    expect(await deleteTemplate(f.locationId, created.id)).toBe(true);
    expect(await getTemplateDetail(f.locationId, created.id)).toBeNull();
    expect(await deleteTemplate(f.locationId, created.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/template-data.test.ts`
Expected: FAIL — "Cannot find module '@/lib/template-data'".

- [ ] **Step 3: Write the implementation** `src/lib/template-data.ts`:

```ts
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { TemplateRowInput } from "@/lib/template-schemas";
import { parseTime12h } from "@/lib/time";

export type TemplateRow = {
  id: string;
  positionId: string;
  positionName: string;
  employeeProfileId: string | null;
  employeeName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};

export type TemplateSummary = { id: string; name: string; rowCount: number; updatedAt: string };
export type TemplateDetail = { id: string; name: string; updatedAt: string; rows: TemplateRow[] };

export const TEMPLATE_ROW_INCLUDE = {
  position: true,
  employeeProfile: { include: { user: true } },
} satisfies Prisma.ScheduleTemplateRowInclude;

type RowWithJoins = Prisma.ScheduleTemplateRowGetPayload<{ include: typeof TEMPLATE_ROW_INCLUDE }>;

/** Minutes-since-midnight for sorting 12h wall-clock strings. */
function minutesOf(time: string): number {
  const t = parseTime12h(time);
  return t ? t.hour * 60 + t.minute : 0;
}

export function sortRows<T extends { dayOfWeek: number; startTime: string }>(rows: T[]): T[] {
  return rows
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || minutesOf(a.startTime) - minutesOf(b.startTime));
}

export function toTemplateRow(row: RowWithJoins): TemplateRow {
  return {
    id: row.id,
    positionId: row.positionId,
    positionName: row.position.name,
    employeeProfileId: row.employeeProfileId,
    employeeName: row.employeeProfile?.user.name ?? null,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    notes: row.notes,
  };
}

function rowCreateData(rows: TemplateRowInput[]) {
  return rows.map((r) => ({
    positionId: r.positionId,
    employeeProfileId: r.employeeProfileId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes ?? null,
  }));
}

export async function listTemplates(locationId: string): Promise<TemplateSummary[]> {
  const templates = await prisma.scheduleTemplate.findMany({
    where: { locationId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    rowCount: t._count.rows,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function getTemplateDetail(
  locationId: string,
  templateId: string,
): Promise<TemplateDetail | null> {
  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, locationId },
    include: { rows: { include: TEMPLATE_ROW_INCLUDE } },
  });
  if (!template) return null;
  return {
    id: template.id,
    name: template.name,
    updatedAt: template.updatedAt.toISOString(),
    rows: sortRows(template.rows.map(toTemplateRow)),
  };
}

export async function createTemplate(
  locationId: string,
  name: string,
  rows: TemplateRowInput[],
): Promise<TemplateDetail> {
  const dup = await prisma.scheduleTemplate.findFirst({ where: { locationId, name } });
  if (dup) throw new ApiError(409, "name_taken", "A template with that name already exists");
  const created = await prisma.scheduleTemplate.create({
    data: { locationId, name, rows: { create: rowCreateData(rows) } },
  });
  return (await getTemplateDetail(locationId, created.id))!;
}

export async function updateTemplate(
  locationId: string,
  templateId: string,
  patch: { name?: string; rows?: TemplateRowInput[] },
): Promise<TemplateDetail | null> {
  const existing = await prisma.scheduleTemplate.findFirst({ where: { id: templateId, locationId } });
  if (!existing) return null;
  if (patch.name !== undefined && patch.name !== existing.name) {
    const dup = await prisma.scheduleTemplate.findFirst({
      where: { locationId, name: patch.name, id: { not: templateId } },
    });
    if (dup) throw new ApiError(409, "name_taken", "A template with that name already exists");
  }
  await prisma.$transaction([
    ...(patch.rows !== undefined
      ? [
          prisma.scheduleTemplateRow.deleteMany({ where: { templateId } }),
          prisma.scheduleTemplateRow.createMany({
            data: rowCreateData(patch.rows).map((r) => ({ ...r, templateId })),
          }),
        ]
      : []),
    prisma.scheduleTemplate.update({
      where: { id: templateId },
      data: { name: patch.name ?? existing.name },
    }),
  ]);
  return getTemplateDetail(locationId, templateId);
}

export async function deleteTemplate(locationId: string, templateId: string): Promise<boolean> {
  const existing = await prisma.scheduleTemplate.findFirst({ where: { id: templateId, locationId } });
  if (!existing) return false;
  await prisma.scheduleTemplate.delete({ where: { id: templateId } });
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/template-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/template-data.ts src/tests/template-data.test.ts
git commit -m "feat: template-data CRUD helpers (list/get/create/update/delete)"
```

---
### Task 4: Snapshot a week into template rows

**Files:**
- Modify: `src/lib/template-data.ts` (add `snapshotWeekToRows` + imports)
- Test: `src/tests/template-data.test.ts` (add a `describe("snapshotWeekToRows")` block)

**Interfaces:**
- Consumes: `getScheduleWeekData` (`@/lib/schedule-data`), `dayOfWeekMon0`, `weekStartOfISO`, `type ISODate` (`@/lib/time`).
- Produces: `snapshotWeekToRows(locationId: string, fromWeek: ISODate): Promise<TemplateRowInput[]>` — reads the week via `getScheduleWeekData` and converts each shift into a relative row (`dayOfWeek` from its date; `startTime`/`endTime` by splitting the already-formatted `timeRange` on `" – "`). Captures open shifts (null employee) and cross-midnight shifts unchanged.

- [ ] **Step 1: Add imports** to the top of `src/lib/template-data.ts`:

```ts
import { getOrCreateSchedule, getScheduleWeekData } from "@/lib/schedule-data";
import {
  addDaysISO,
  dayOfWeekMon0,
  parseTime12h,
  shiftInstants,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";
```

(Merge the `@/lib/time` import with the existing `parseTime12h` import from Task 3 — keep one import line. `getOrCreateSchedule`/`shiftInstants`/`addDaysISO`/`weekStartOfISO` are used by Tasks 5–6 too.)

- [ ] **Step 2: Write the failing test** — add to `src/tests/template-data.test.ts`:

```ts
import { createShiftAt } from "./helpers/factory";
import { addDaysISO, localToUtc, weekStartOf } from "@/lib/time";
import { snapshotWeekToRows } from "@/lib/template-data";

describe("snapshotWeekToRows", () => {
  it("relativizes a week's shifts: open shifts, assignments, and cross-midnight", async () => {
    const week = weekStartOf(new Date(), f.timezone); // Monday ISODate
    // Mon 7:00 AM – 3:00 PM, assigned to Ana
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: localToUtc(week, { hour: 7, minute: 0 }, f.timezone),
      endsAt: localToUtc(week, { hour: 15, minute: 0 }, f.timezone),
    });
    // Wed 9:00 AM – 5:00 PM, OPEN
    const wed = addDaysISO(week, 2);
    await createShiftAt(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: null,
      startsAt: localToUtc(wed, { hour: 9, minute: 0 }, f.timezone),
      endsAt: localToUtc(wed, { hour: 17, minute: 0 }, f.timezone),
    });
    // Fri 8:00 PM – 2:00 AM (crosses midnight), assigned to Ben
    const fri = addDaysISO(week, 4);
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ben.profileId,
      startsAt: localToUtc(fri, { hour: 20, minute: 0 }, f.timezone),
      endsAt: localToUtc(addDaysISO(fri, 1), { hour: 2, minute: 0 }, f.timezone),
    });

    const rows = await snapshotWeekToRows(f.locationId, week);
    expect(rows).toHaveLength(3);

    const mon = rows.find((r) => r.dayOfWeek === 0)!;
    expect(mon).toMatchObject({
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startTime: "7:00 AM",
      endTime: "3:00 PM",
    });

    const wedRow = rows.find((r) => r.dayOfWeek === 2)!;
    expect(wedRow.employeeProfileId).toBeNull();
    expect(wedRow.startTime).toBe("9:00 AM");

    const friRow = rows.find((r) => r.dayOfWeek === 4)!;
    expect(friRow.employeeProfileId).toBe(f.ben.profileId);
    expect(friRow).toMatchObject({ startTime: "8:00 PM", endTime: "2:00 AM" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/tests/template-data.test.ts -t snapshotWeekToRows`
Expected: FAIL — `snapshotWeekToRows` is not exported.

- [ ] **Step 4: Implement** — add to `src/lib/template-data.ts`:

```ts
export async function snapshotWeekToRows(
  locationId: string,
  fromWeek: ISODate,
): Promise<TemplateRowInput[]> {
  const data = await getScheduleWeekData(locationId, weekStartOfISO(fromWeek));
  return data.shifts.map((s) => {
    const [startTime, endTime] = s.timeRange.split(" – ");
    return {
      positionId: s.positionId,
      employeeProfileId: s.employeeProfileId,
      dayOfWeek: dayOfWeekMon0(s.date),
      startTime,
      endTime,
      notes: s.notes,
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/tests/template-data.test.ts -t snapshotWeekToRows`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/template-data.ts src/tests/template-data.test.ts
git commit -m "feat: snapshot a schedule week into template rows"
```

---

### Task 5: Resolve a template against a target week (preview)

**Files:**
- Modify: `src/lib/template-data.ts` (add types + `resolveTemplateForWeek` + imports)
- Test: `src/tests/template-data.test.ts` (add a `describe("resolveTemplateForWeek")` block)

**Interfaces:**
- Consumes: `getOrCreateSchedule` (`@/lib/schedule-data`), `buildConflictContext` (`@/lib/conflict-context`), `detectConflicts` + `type Conflict` (`@/lib/conflicts`), `shiftInstants`, `addDaysISO`, `weekStartOfISO` (`@/lib/time`).
- Produces:

```ts
export type ResolvedRow = {
  rowId: string;
  positionId: string;
  positionName: string;
  dayOfWeek: number;
  date: ISODate;
  startTime: string;
  endTime: string;
  timeRange: string;
  notes: string | null;
  defaultEmployeeProfileId: string | null; // remembered assignee, only if still valid
  defaultEmployeeName: string | null;
  employeeValid: boolean;
  conflicts: Conflict[];
};
export type TemplatePreview = {
  templateId: string;
  templateName: string;
  targetWeek: ISODate;
  rows: ResolvedRow[];
  occupancy: { draftCount: number; publishedCount: number };
};
```

  - `resolveTemplateForWeek(locationId, templateId, targetWeek, timezone): Promise<TemplatePreview | null>` — `null` if the template isn't at this location. Snaps `targetWeek` to Monday. Computes occupancy (draft/published shift counts already in the week) and, for each row whose remembered employee is still on the team, conflict hints via one cached `buildConflictContext` per employee.

- [ ] **Step 1: Add imports** to `src/lib/template-data.ts`:

```ts
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
```

- [ ] **Step 2: Write the failing test** — add to `src/tests/template-data.test.ts`:

```ts
import { createTemplate, resolveTemplateForWeek } from "@/lib/template-data";
import { prisma } from "@/lib/db";

describe("resolveTemplateForWeek", () => {
  it("resolves dates, occupancy, conflict hints, and drops invalid assignees to open", async () => {
    const targetWeek = addDaysISO(weekStartOf(new Date(), f.timezone), 7); // next Monday
    const template = await createTemplate(f.locationId, "Resolve me", [
      { positionId: f.positionIds.server, employeeProfileId: f.ana.profileId, dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM" },
      { positionId: f.positionIds.dishwasher, employeeProfileId: null, dayOfWeek: 1, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);

    // A pre-existing DRAFT shift for Ana that overlaps her Monday row → conflict + occupancy.
    const mon = targetWeek;
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: localToUtc(mon, { hour: 10, minute: 0 }, f.timezone),
      endsAt: localToUtc(mon, { hour: 14, minute: 0 }, f.timezone),
      status: "draft",
    });

    const preview = (await resolveTemplateForWeek(f.locationId, template.id, targetWeek, f.timezone))!;
    expect(preview.targetWeek).toBe(targetWeek);
    expect(preview.occupancy.draftCount).toBe(1);
    expect(preview.occupancy.publishedCount).toBe(0);

    const anaRow = preview.rows.find((r) => r.dayOfWeek === 0)!;
    expect(anaRow.date).toBe(mon);
    expect(anaRow.employeeValid).toBe(true);
    expect(anaRow.defaultEmployeeName).toBe("Ana Diaz");
    expect(anaRow.conflicts.some((c) => c.kind === "double_booked")).toBe(true);

    const openRow = preview.rows.find((r) => r.dayOfWeek === 1)!;
    expect(openRow.employeeValid).toBe(false);
    expect(openRow.conflicts).toEqual([]);

    // Point Ana's row at a foreign-location profile: exists (FK ok) but not on this team.
    const other = await createFixture();
    try {
      await prisma.scheduleTemplateRow.update({
        where: { id: anaRow.rowId },
        data: { employeeProfileId: other.ana.profileId },
      });
      const reprev = (await resolveTemplateForWeek(f.locationId, template.id, targetWeek, f.timezone))!;
      const staleRow = reprev.rows.find((r) => r.dayOfWeek === 0)!;
      expect(staleRow.employeeValid).toBe(false);
      expect(staleRow.defaultEmployeeProfileId).toBeNull();
      expect(staleRow.conflicts).toEqual([]);
    } finally {
      await destroyFixture(other);
    }
  });

  it("returns null for a template at another location", async () => {
    const t = await createTemplate(f.locationId, "Scoped preview", []);
    const other = await createFixture();
    try {
      expect(await resolveTemplateForWeek(other.locationId, t.id, weekStartOf(new Date(), other.timezone), other.timezone)).toBeNull();
    } finally {
      await destroyFixture(other);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/tests/template-data.test.ts -t resolveTemplateForWeek`
Expected: FAIL — `resolveTemplateForWeek` is not exported.

- [ ] **Step 4: Implement** — add the types (above) and this function to `src/lib/template-data.ts`:

```ts
export async function resolveTemplateForWeek(
  locationId: string,
  templateId: string,
  targetWeekInput: ISODate,
  timezone: string,
): Promise<TemplatePreview | null> {
  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, locationId },
    include: { rows: { include: TEMPLATE_ROW_INCLUDE } },
  });
  if (!template) return null;
  const targetWeek = weekStartOfISO(targetWeekInput);
  const schedule = await getOrCreateSchedule(locationId, targetWeek);

  const rememberedIds = [
    ...new Set(template.rows.map((r) => r.employeeProfileId).filter((id): id is string => id !== null)),
  ];
  const [draftCount, publishedCount, validProfiles] = await Promise.all([
    prisma.shift.count({ where: { scheduleId: schedule.id, status: "draft" } }),
    prisma.shift.count({ where: { scheduleId: schedule.id, status: "published" } }),
    prisma.employeeProfile.findMany({ where: { locationId, id: { in: rememberedIds } }, select: { id: true } }),
  ]);
  const validSet = new Set(validProfiles.map((p) => p.id));

  // One conflict context per still-valid employee, reused across their rows.
  const contexts = new Map(
    await Promise.all(
      [...validSet].map(async (id) => [id, await buildConflictContext(id, targetWeek)] as const),
    ),
  );

  const rows = sortRows(template.rows.map(toTemplateRow)).map((r): ResolvedRow => {
    const date = addDaysISO(targetWeek, r.dayOfWeek);
    const employeeValid = r.employeeProfileId !== null && validSet.has(r.employeeProfileId);
    let conflicts: Conflict[] = [];
    if (employeeValid) {
      const { startsAt, endsAt } = shiftInstants(date, parseTime12h(r.startTime)!, parseTime12h(r.endTime)!, timezone);
      conflicts = detectConflicts(
        { employeeProfileId: r.employeeProfileId, date, startsAt, endsAt },
        contexts.get(r.employeeProfileId!)!,
      );
    }
    return {
      rowId: r.id,
      positionId: r.positionId,
      positionName: r.positionName,
      dayOfWeek: r.dayOfWeek,
      date,
      startTime: r.startTime,
      endTime: r.endTime,
      timeRange: `${r.startTime} – ${r.endTime}`,
      notes: r.notes,
      defaultEmployeeProfileId: employeeValid ? r.employeeProfileId : null,
      defaultEmployeeName: employeeValid ? r.employeeName : null,
      employeeValid,
      conflicts,
    };
  });

  return { templateId: template.id, templateName: template.name, targetWeek, rows, occupancy: { draftCount, publishedCount } };
}
```

> Preview conflicts reflect shifts already in the DB, not other rows of the same template (template-internal double-booking surfaces after apply on the normal grid render). This is intentional — preview is an advisory hint.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/tests/template-data.test.ts -t resolveTemplateForWeek`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/template-data.ts src/tests/template-data.test.ts
git commit -m "feat: resolve a template against a target week (preview + conflict hints)"
```

---

### Task 6: Apply a template (transactional write)

**Files:**
- Modify: `src/lib/template-data.ts` (add `ApplyResult` + `applyTemplate`)
- Test: `src/tests/template-data.test.ts` (add a `describe("applyTemplate")` block)

**Interfaces:**
- Produces:

```ts
export type ApplyResult = { created: number; openCount: number; week: ISODate };
```

  - `applyTemplate(locationId, templateId, input: { targetWeek: ISODate; mode: "replace" | "add"; assignments: Record<string, string | null> }, timezone): Promise<ApplyResult | null>` — `null` if the template isn't at this location. Snaps `targetWeek` to Monday. Per row, the assignee is the explicit override (else the remembered default); anyone not currently on the team becomes an open slot. `replace` deletes only the week's **draft** shifts first (published shifts survive). All writes in one `$transaction`; new shifts are `draft`.

- [ ] **Step 1: Write the failing test** — add to `src/tests/template-data.test.ts`:

```ts
import { applyTemplate } from "@/lib/template-data";
import { formatTime } from "@/lib/time";

describe("applyTemplate", () => {
  it("preserves wall-clock across a DST boundary (EST vs EDT weeks)", async () => {
    const template = await createTemplate(f.locationId, "DST week", [
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);
    // 2026-02-02 is a Monday in EST; 2026-07-06 is a Monday in EDT.
    for (const week of ["2026-02-02", "2026-07-06"]) {
      const res = (await applyTemplate(f.locationId, template.id, { targetWeek: week, mode: "replace", assignments: {} }, f.timezone))!;
      expect(res.created).toBe(1);
      const schedule = await prisma.schedule.findFirstOrThrow({
        where: { locationId: f.locationId, weekStartDate: new Date(week) },
      });
      const shift = await prisma.shift.findFirstOrThrow({ where: { scheduleId: schedule.id, status: "draft" } });
      expect(formatTime(shift.startsAt, f.timezone)).toBe("9:00 AM");
      expect(formatTime(shift.endsAt, f.timezone)).toBe("5:00 PM");
      // cleanup this DST probe week
      await prisma.shift.deleteMany({ where: { scheduleId: schedule.id } });
      await prisma.schedule.delete({ where: { id: schedule.id } });
    }
  });

  it("replace deletes only draft shifts (published survive); add appends", async () => {
    const targetWeek = addDaysISO(weekStartOf(new Date(), f.timezone), 14); // isolate: 2 weeks out
    // Seed the target week with one PUBLISHED and one DRAFT shift.
    await createShiftAt(f, {
      positionId: f.positionIds.server, employeeProfileId: null,
      startsAt: localToUtc(targetWeek, { hour: 6, minute: 0 }, f.timezone),
      endsAt: localToUtc(targetWeek, { hour: 10, minute: 0 }, f.timezone),
      status: "published",
    });
    await createShiftAt(f, {
      positionId: f.positionIds.server, employeeProfileId: null,
      startsAt: localToUtc(targetWeek, { hour: 11, minute: 0 }, f.timezone),
      endsAt: localToUtc(targetWeek, { hour: 15, minute: 0 }, f.timezone),
      status: "draft",
    });

    const template = await createTemplate(f.locationId, "Replace add", [
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 3, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);
    const schedule = await prisma.schedule.findFirstOrThrow({
      where: { locationId: f.locationId, weekStartDate: new Date(targetWeek) },
    });

    // ADD: 1 published + 1 draft + 1 new template draft = 3.
    await applyTemplate(f.locationId, template.id, { targetWeek, mode: "add", assignments: {} }, f.timezone);
    expect(await prisma.shift.count({ where: { scheduleId: schedule.id } })).toBe(3);

    // REPLACE: drops the 2 drafts (seeded + added), keeps the 1 published, adds 1 template draft = 2.
    await applyTemplate(f.locationId, template.id, { targetWeek, mode: "replace", assignments: {} }, f.timezone);
    expect(await prisma.shift.count({ where: { scheduleId: schedule.id } })).toBe(2);
    expect(await prisma.shift.count({ where: { scheduleId: schedule.id, status: "published" } })).toBe(1);
  });

  it("honors assignment overrides and coerces off-team ids to open", async () => {
    const targetWeek = addDaysISO(weekStartOf(new Date(), f.timezone), 21);
    const template = await createTemplate(f.locationId, "Assign apply", [
      { positionId: f.positionIds.server, employeeProfileId: f.ana.profileId, dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM" },
      { positionId: f.positionIds.server, employeeProfileId: f.ana.profileId, dayOfWeek: 1, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);
    const detail = (await getTemplateDetail(f.locationId, template.id))!;
    const [row0, row1] = detail.rows;

    const other = await createFixture();
    try {
      const res = (await applyTemplate(
        f.locationId,
        template.id,
        { targetWeek, mode: "replace", assignments: { [row0.id]: f.ben.profileId, [row1.id]: other.ana.profileId } },
        f.timezone,
      ))!;
      expect(res.created).toBe(2);
      expect(res.openCount).toBe(1); // row1's off-team id coerced to open
      const schedule = await prisma.schedule.findFirstOrThrow({
        where: { locationId: f.locationId, weekStartDate: new Date(targetWeek) },
      });
      const shifts = await prisma.shift.findMany({ where: { scheduleId: schedule.id }, orderBy: { date: "asc" } });
      expect(shifts[0].employeeProfileId).toBe(f.ben.profileId); // override honored
      expect(shifts[1].employeeProfileId).toBeNull(); // off-team → open
    } finally {
      await destroyFixture(other);
    }
  });

  it("returns null for a template at another location", async () => {
    const t = await createTemplate(f.locationId, "Scoped apply", []);
    const other = await createFixture();
    try {
      expect(
        await applyTemplate(other.locationId, t.id, { targetWeek: "2026-07-06", mode: "add", assignments: {} }, other.timezone),
      ).toBeNull();
    } finally {
      await destroyFixture(other);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/template-data.test.ts -t applyTemplate`
Expected: FAIL — `applyTemplate` is not exported.

- [ ] **Step 3: Implement** — add to `src/lib/template-data.ts`:

```ts
export type ApplyResult = { created: number; openCount: number; week: ISODate };

export async function applyTemplate(
  locationId: string,
  templateId: string,
  input: { targetWeek: ISODate; mode: "replace" | "add"; assignments: Record<string, string | null> },
  timezone: string,
): Promise<ApplyResult | null> {
  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, locationId },
    include: { rows: true },
  });
  if (!template) return null;
  const targetWeek = weekStartOfISO(input.targetWeek);
  const schedule = await getOrCreateSchedule(locationId, targetWeek);

  // Requested assignee per row: explicit override, else the row's remembered default.
  const requestedByRow = new Map(
    template.rows.map((r) => [
      r.id,
      r.id in input.assignments ? input.assignments[r.id] : r.employeeProfileId,
    ]),
  );
  const requestedIds = [...new Set([...requestedByRow.values()].filter((v): v is string => v !== null))];
  const members = await prisma.employeeProfile.findMany({
    where: { locationId, id: { in: requestedIds } },
    select: { id: true },
  });
  const memberSet = new Set(members.map((m) => m.id));

  const shiftData = template.rows.map((r) => {
    const requested = requestedByRow.get(r.id) ?? null;
    const employeeProfileId = requested && memberSet.has(requested) ? requested : null;
    const date = addDaysISO(targetWeek, r.dayOfWeek);
    const { startsAt, endsAt } = shiftInstants(date, parseTime12h(r.startTime)!, parseTime12h(r.endTime)!, timezone);
    return {
      scheduleId: schedule.id,
      locationId,
      positionId: r.positionId,
      employeeProfileId,
      date: new Date(date),
      startsAt,
      endsAt,
      notes: r.notes,
      status: "draft" as const,
    };
  });

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (input.mode === "replace") {
    ops.push(prisma.shift.deleteMany({ where: { scheduleId: schedule.id, status: "draft" } }));
  }
  ops.push(prisma.shift.createMany({ data: shiftData }));
  await prisma.$transaction(ops);

  return {
    created: shiftData.length,
    openCount: shiftData.filter((s) => s.employeeProfileId === null).length,
    week: targetWeek,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/template-data.test.ts`
Expected: PASS (whole file: schemas of Task 3 + snapshot + resolve + apply).

- [ ] **Step 5: Commit**

```bash
git add src/lib/template-data.ts src/tests/template-data.test.ts
git commit -m "feat: apply a template as draft shifts (replace/add, DST-safe)"
```

---
### Task 7: CRUD route handlers

**Files:**
- Create: `src/app/api/schedule-templates/route.ts` (GET list, POST create)
- Create: `src/app/api/schedule-templates/[templateId]/route.ts` (GET, PATCH, DELETE)
- Test: `src/tests/template-api.test.ts`

**Interfaces:**
- Consumes: `requireManagerForApi`, `jsonOk`/`jsonErr`/`handleApiError`, `createTemplateSchema`/`updateTemplateSchema`, `listTemplates`/`createTemplate`/`snapshotWeekToRows`/`getTemplateDetail`/`updateTemplate`/`deleteTemplate`.
- Produces (HTTP): `GET /api/schedule-templates` → `{ templates: TemplateSummary[] }`; `POST` → `{ template: TemplateDetail }` (201); `GET/PATCH /api/schedule-templates/{id}` → `{ template: TemplateDetail }`; `DELETE` → `{ deleted: true }`.

- [ ] **Step 1: Write the failing test** `src/tests/template-api.test.ts`:

```ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; name: string; role: "manager" | "employee"; organizationId: string } },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mockSession.current) }));

import { GET as listTemplatesRoute, POST as createTemplateRoute } from "@/app/api/schedule-templates/route";
import {
  DELETE as deleteTemplateRoute,
  GET as getTemplateRoute,
  PATCH as patchTemplateRoute,
} from "@/app/api/schedule-templates/[templateId]/route";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { localToUtc, weekStartOf } from "@/lib/time";

let f: Fixture;

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://test/api/schedule-templates", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  f = await createFixture();
  mockSession.current = {
    user: { id: f.managerUserId, name: f.managerName, role: "manager", organizationId: f.orgId },
  };
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("POST /api/schedule-templates", () => {
  it("creates from explicit rows and returns the detail", async () => {
    const res = await createTemplateRoute(
      jsonRequest("POST", {
        name: "From rows",
        rows: [{ positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM" }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.template.rows).toHaveLength(1);
  });

  it("creates by snapshotting a week", async () => {
    const week = weekStartOf(new Date(), f.timezone);
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: localToUtc(week, { hour: 8, minute: 0 }, f.timezone),
      endsAt: localToUtc(week, { hour: 16, minute: 0 }, f.timezone),
    });
    const res = await createTemplateRoute(jsonRequest("POST", { name: "From week", fromWeek: week }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.template.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("409s on a duplicate name", async () => {
    await createTemplateRoute(jsonRequest("POST", { name: "Dup api", rows: [] }));
    const res = await createTemplateRoute(jsonRequest("POST", { name: "Dup api", rows: [] }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("name_taken");
  });

  it("401s when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await createTemplateRoute(jsonRequest("POST", { name: "Nope", rows: [] }));
    expect(res.status).toBe(401);
    mockSession.current = saved;
  });
});

describe("GET/PATCH/DELETE /api/schedule-templates/[templateId]", () => {
  async function createOne(name: string): Promise<string> {
    const res = await createTemplateRoute(jsonRequest("POST", { name, rows: [] }));
    return (await res.json()).data.template.id;
  }

  it("gets, renames, and deletes", async () => {
    const id = await createOne("Lifecycle");
    const getRes = await getTemplateRoute(new Request("http://test"), { params: Promise.resolve({ templateId: id }) });
    expect((await getRes.json()).data.template.name).toBe("Lifecycle");

    const patchRes = await patchTemplateRoute(jsonRequest("PATCH", { name: "Lifecycle 2" }), {
      params: Promise.resolve({ templateId: id }),
    });
    expect((await patchRes.json()).data.template.name).toBe("Lifecycle 2");

    const delRes = await deleteTemplateRoute(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ templateId: id }),
    });
    expect((await delRes.json()).data.deleted).toBe(true);

    const missRes = await deleteTemplateRoute(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ templateId: id }),
    });
    expect(missRes.status).toBe(404);
  });

  it("404s a template from another location (tenancy)", async () => {
    const other = await createFixture();
    const savedSession = mockSession.current;
    try {
      // Create a template owned by `other`'s manager, then switch back to f's manager.
      mockSession.current = {
        user: { id: other.managerUserId, name: other.managerName, role: "manager", organizationId: other.orgId },
      };
      const createRes = await createTemplateRoute(jsonRequest("POST", { name: "Foreign api", rows: [] }));
      const foreignId = (await createRes.json()).data.template.id;
      mockSession.current = savedSession;

      const res = await getTemplateRoute(new Request("http://test"), {
        params: Promise.resolve({ templateId: foreignId }),
      });
      expect(res.status).toBe(404);
    } finally {
      mockSession.current = savedSession;
      await destroyFixture(other);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/template-api.test.ts`
Expected: FAIL — cannot find the route modules.

- [ ] **Step 3: Implement `src/app/api/schedule-templates/route.ts`:**

```ts
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { createTemplateSchema } from "@/lib/template-schemas";
import { createTemplate, listTemplates, snapshotWeekToRows } from "@/lib/template-data";

export async function GET() {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    return jsonOk({ templates: await listTemplates(guard.location.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

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
    const parsed = createTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;
    const rows =
      input.fromWeek !== undefined
        ? await snapshotWeekToRows(guard.location.id, input.fromWeek)
        : input.rows ?? [];
    const template = await createTemplate(guard.location.id, input.name, rows);
    return jsonOk({ template }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 4: Implement `src/app/api/schedule-templates/[templateId]/route.ts`:**

```ts
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { updateTemplateSchema } from "@/lib/template-schemas";
import { deleteTemplate, getTemplateDetail, updateTemplate } from "@/lib/template-data";

export async function GET(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;
    const template = await getTemplateDetail(guard.location.id, templateId);
    if (!template) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = updateTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const template = await updateTemplate(guard.location.id, templateId, parsed.data);
    if (!template) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;
    const ok = await deleteTemplate(guard.location.id, templateId);
    if (!ok) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/tests/template-api.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/schedule-templates/route.ts src/app/api/schedule-templates/[templateId]/route.ts src/tests/template-api.test.ts
git commit -m "feat: schedule-template CRUD endpoints"
```

---

### Task 8: Preview + apply route handlers

**Files:**
- Create: `src/app/api/schedule-templates/[templateId]/preview/route.ts`
- Create: `src/app/api/schedule-templates/[templateId]/apply/route.ts`
- Test: `src/tests/template-api.test.ts` (add `describe` blocks)

**Interfaces:**
- Consumes: `previewTemplateSchema`/`applyTemplateSchema`, `resolveTemplateForWeek`/`applyTemplate`.
- Produces (HTTP): `POST /api/schedule-templates/{id}/preview` → `{ preview: TemplatePreview }`; `POST /api/schedule-templates/{id}/apply` → `{ result: ApplyResult }`.

- [ ] **Step 1: Write the failing test** — add to `src/tests/template-api.test.ts`:

```ts
import { POST as previewRoute } from "@/app/api/schedule-templates/[templateId]/preview/route";
import { POST as applyRoute } from "@/app/api/schedule-templates/[templateId]/apply/route";
import { prisma } from "@/lib/db";
import { addDaysISO } from "@/lib/time";

function bodyRequest(body: unknown): Request {
  return new Request("http://test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("preview + apply endpoints", () => {
  it("previews then applies a template as draft shifts", async () => {
    const createRes = await createTemplateRoute(
      jsonRequest("POST", {
        name: "Preview apply api",
        rows: [
          { positionId: f.positionIds.server, employeeProfileId: f.ana.profileId, dayOfWeek: 2, startTime: "9:00 AM", endTime: "5:00 PM" },
        ],
      }),
    );
    const templateId = (await createRes.json()).data.template.id;
    const targetWeek = addDaysISO(weekStartOf(new Date(), f.timezone), 28); // isolate

    const previewRes = await previewRoute(bodyRequest({ targetWeek }), { params: Promise.resolve({ templateId }) });
    const preview = (await previewRes.json()).data.preview;
    expect(preview.targetWeek).toBe(targetWeek);
    expect(preview.rows).toHaveLength(1);
    const rowId = preview.rows[0].rowId;

    const applyRes = await applyRoute(
      bodyRequest({ targetWeek, mode: "replace", assignments: { [rowId]: f.ana.profileId } }),
      { params: Promise.resolve({ templateId }) },
    );
    const result = (await applyRes.json()).data.result;
    expect(result.created).toBe(1);

    const schedule = await prisma.schedule.findFirstOrThrow({
      where: { locationId: f.locationId, weekStartDate: new Date(targetWeek) },
    });
    const shifts = await prisma.shift.findMany({ where: { scheduleId: schedule.id } });
    expect(shifts).toHaveLength(1);
    expect(shifts[0].status).toBe("draft");
    expect(shifts[0].employeeProfileId).toBe(f.ana.profileId);
  });

  it("404s preview/apply for an unknown template", async () => {
    const p = await previewRoute(bodyRequest({ targetWeek: "2026-07-06" }), { params: Promise.resolve({ templateId: "nope" }) });
    expect(p.status).toBe(404);
    const a = await applyRoute(bodyRequest({ targetWeek: "2026-07-06", mode: "add", assignments: {} }), {
      params: Promise.resolve({ templateId: "nope" }),
    });
    expect(a.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/template-api.test.ts -t "preview + apply"`
Expected: FAIL — cannot find preview/apply route modules.

- [ ] **Step 3: Implement `src/app/api/schedule-templates/[templateId]/preview/route.ts`:**

```ts
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { previewTemplateSchema } from "@/lib/template-schemas";
import { resolveTemplateForWeek } from "@/lib/template-data";

export async function POST(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = previewTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const preview = await resolveTemplateForWeek(
      guard.location.id,
      templateId,
      parsed.data.targetWeek,
      guard.location.timezone,
    );
    if (!preview) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ preview });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 4: Implement `src/app/api/schedule-templates/[templateId]/apply/route.ts`:**

```ts
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { applyTemplateSchema } from "@/lib/template-schemas";
import { applyTemplate } from "@/lib/template-data";

export async function POST(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = applyTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const result = await applyTemplate(
      guard.location.id,
      templateId,
      parsed.data,
      guard.location.timezone,
    );
    if (!result) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/tests/template-api.test.ts`
Expected: PASS (whole file).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/schedule-templates/[templateId]/preview src/app/api/schedule-templates/[templateId]/apply src/tests/template-api.test.ts
git commit -m "feat: schedule-template preview + apply endpoints"
```

---
### Task 9: "Save as template" dialog + builder button

**Files:**
- Create: `src/components/schedule/SaveAsTemplateDialog.tsx`
- Modify: `src/components/schedule/ScheduleView.tsx` (import, `saveOpen` state, button, dialog render)
- Test: `src/components/schedule/SaveAsTemplateDialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog`, `Button`, `Input`, `useToast`; `type ISODate`.
- Produces: `SaveAsTemplateDialog({ open, week, onClose })` — default export. POSTs `/api/schedule-templates` with `{ name, fromWeek: week }`.

- [ ] **Step 1: Write the failing test** `src/components/schedule/SaveAsTemplateDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SaveAsTemplateDialog from "@/components/schedule/SaveAsTemplateDialog";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { template: { id: "t1" } } }), {
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("SaveAsTemplateDialog", () => {
  it("POSTs the name + fromWeek when saved", async () => {
    render(<SaveAsTemplateDialog open week="2026-07-06" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Standard week" } });
    fireEvent.click(screen.getByText("Save template"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/schedule-templates");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Standard week", fromWeek: "2026-07-06" });
  });

  it("does not POST an empty name", async () => {
    render(<SaveAsTemplateDialog open week="2026-07-06" onClose={() => {}} />);
    fireEvent.click(screen.getByText("Save template"));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/schedule/SaveAsTemplateDialog.test.tsx`
Expected: FAIL — cannot find `SaveAsTemplateDialog`.

- [ ] **Step 3: Implement `src/components/schedule/SaveAsTemplateDialog.tsx`:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toaster";
import type { ISODate } from "@/lib/time";

type SaveAsTemplateDialogProps = {
  open: boolean;
  week: ISODate;
  onClose: () => void;
};

export default function SaveAsTemplateDialog({ open, week, onClose }: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName("");
    setError(undefined);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name your template");
      return;
    }
    onClose();
    try {
      const res = await fetch("/api/schedule-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, fromWeek: week }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template saved", description: `"${trimmed}" is ready to apply.` });
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save template",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save week as template"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save template
          </Button>
        </>
      }
    >
      <Input
        label="Template name"
        placeholder="e.g. Standard week"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
      />
    </Dialog>
  );
}
```

- [ ] **Step 4: Wire into `ScheduleView.tsx`** — three edits:

Add the import after the `PublishDialog` import:

```tsx
import SaveAsTemplateDialog from "@/components/schedule/SaveAsTemplateDialog";
```

Add state after `const [publishOpen, setPublishOpen] = useState(false);`:

```tsx
  const [saveOpen, setSaveOpen] = useState(false);
```

Replace the `actions` toolbar block to add the button first:

```tsx
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setSaveOpen(true)}>
            Save as template
          </Button>
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

Add the dialog render immediately after the `<PublishDialog … />` block:

```tsx
      <SaveAsTemplateDialog open={saveOpen} week={week} onClose={() => setSaveOpen(false)} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/schedule/SaveAsTemplateDialog.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/schedule/SaveAsTemplateDialog.tsx src/components/schedule/SaveAsTemplateDialog.test.tsx src/components/schedule/ScheduleView.tsx
git commit -m "feat: save-week-as-template dialog + builder button"
```

---

### Task 10: "Apply template" dialog (pick → preview → review)

**Files:**
- Create: `src/components/schedule/ApplyTemplateDialog.tsx`
- Create: `src/components/schedule/ApplyTemplateDialog.module.css`
- Modify: `src/components/schedule/ScheduleView.tsx` (import, `applyOpen` state, button, dialog render)
- Test: `src/components/schedule/ApplyTemplateDialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog`, `Button`, `Select`, `ConflictChip`, `useToast`, `useRouter`; `qualifiedEmployees` (`@/components/schedule/AssignShiftDialog`); `EmployeeOption`; `addDaysISO`, `formatDateShort`, `type ISODate`; the `TemplateSummary`/`TemplatePreview`/`ResolvedRow` types (`@/lib/template-data`).
- Produces:
  - `ApplyTemplateDialog({ open, week, employees, onClose })` — default export.
  - Named pure helpers (exported for unit test): `nextMondays(week: ISODate, count: number): ISODate[]`; `assignmentsFromPreview(preview: TemplatePreview): Record<string, string>` (rowId → employeeProfileId or `""`); `defaultMode(occupancy: { draftCount: number; publishedCount: number }): "replace" | "add"`; `DOW_LABELS: string[]`.

- [ ] **Step 1: Write the failing test** `src/components/schedule/ApplyTemplateDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  assignmentsFromPreview,
  defaultMode,
  nextMondays,
} from "@/components/schedule/ApplyTemplateDialog";
import type { TemplatePreview } from "@/lib/template-data";

describe("nextMondays", () => {
  it("returns count Mondays starting at week", () => {
    expect(nextMondays("2026-07-06", 3)).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
  });
});

describe("assignmentsFromPreview", () => {
  it("maps each row to its valid default, or empty string for open", () => {
    const preview = {
      templateId: "t", templateName: "T", targetWeek: "2026-07-06",
      occupancy: { draftCount: 0, publishedCount: 0 },
      rows: [
        { rowId: "r1", defaultEmployeeProfileId: "ep1", conflicts: [] },
        { rowId: "r2", defaultEmployeeProfileId: null, conflicts: [] },
      ],
    } as unknown as TemplatePreview;
    expect(assignmentsFromPreview(preview)).toEqual({ r1: "ep1", r2: "" });
  });
});

describe("defaultMode", () => {
  it("prefers replace when the week already has draft shifts", () => {
    expect(defaultMode({ draftCount: 2, publishedCount: 0 })).toBe("replace");
    expect(defaultMode({ draftCount: 0, publishedCount: 0 })).toBe("add");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/schedule/ApplyTemplateDialog.test.tsx`
Expected: FAIL — cannot find `ApplyTemplateDialog`.

- [ ] **Step 3: Create `src/components/schedule/ApplyTemplateDialog.module.css`:**

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  font-family: var(--font-sans);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 340px;
  overflow-y: auto;
}

.row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 10px;
  align-items: start;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.rowMeta {
  font-size: 13px;
  color: var(--text-secondary);
}

.rowMetaTitle {
  font-weight: 600;
  color: var(--text-primary);
}

.warning {
  font-size: 13px;
  color: var(--text-secondary);
}

.empty {
  font-size: 14px;
  color: var(--text-secondary);
  padding: var(--space-4) 0;
}

.conflicts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
```

> If `--border-subtle` isn't a defined token, use `--border-strong` (present in `grids.module.css`). Verify against `src/styles/tokens/` and pick an existing border token.

- [ ] **Step 4: Implement `src/components/schedule/ApplyTemplateDialog.tsx`:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { qualifiedEmployees } from "@/components/schedule/AssignShiftDialog";
import { Button } from "@/components/ui/Button";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import type { EmployeeOption } from "@/lib/schedule-data";
import type { TemplatePreview, TemplateSummary } from "@/lib/template-data";
import { addDaysISO, formatDateShort, type ISODate } from "@/lib/time";
import styles from "./ApplyTemplateDialog.module.css";

export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function nextMondays(week: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(week, i * 7));
}

export function assignmentsFromPreview(preview: TemplatePreview): Record<string, string> {
  return Object.fromEntries(preview.rows.map((r) => [r.rowId, r.defaultEmployeeProfileId ?? ""]));
}

export function defaultMode(occupancy: { draftCount: number; publishedCount: number }): "replace" | "add" {
  return occupancy.draftCount > 0 ? "replace" : "add";
}

type ApplyTemplateDialogProps = {
  open: boolean;
  week: ISODate;
  employees: EmployeeOption[];
  onClose: () => void;
};

export default function ApplyTemplateDialog({ open, week, employees, onClose }: ApplyTemplateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<"pick" | "review">("pick");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [targetWeek, setTargetWeek] = useState<ISODate>(week);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [mode, setMode] = useState<"replace" | "add">("add");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStep("pick");
    setTemplateId("");
    setTargetWeek(week);
    setPreview(null);
    setAssignments({});
    /* eslint-enable react-hooks/set-state-in-effect */
    void (async () => {
      try {
        const res = await fetch("/api/schedule-templates");
        const body = await res.json();
        if (body.ok) setTemplates(body.data.templates);
      } catch {
        // leave the list empty; the pick step shows the empty message
      }
    })();
  }, [open, week]);

  async function handleNext() {
    if (!templateId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/schedule-templates/${templateId}/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetWeek }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      const p: TemplatePreview = body.data.preview;
      setPreview(p);
      setAssignments(assignmentsFromPreview(p));
      setMode(defaultMode(p.occupancy));
      setStep("review");
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't preview template", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setBusy(true);
    onClose();
    try {
      const res = await fetch(`/api/schedule-templates/${preview.templateId}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetWeek: preview.targetWeek,
          mode,
          assignments: Object.fromEntries(
            Object.entries(assignments).map(([rowId, ep]) => [rowId, ep === "" ? null : ep]),
          ),
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      const { created, openCount } = body.data.result;
      toast({
        tone: "success",
        title: "Template applied",
        description: `${created} shift${created === 1 ? "" : "s"} added${openCount ? `, ${openCount} left open` : ""}.`,
      });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't apply template", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  }

  const weekOptions = nextMondays(week, 6).map((w) => ({ value: w, label: `Week of ${formatDateShort(w)}` }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === "pick" ? "Apply a template" : `Apply "${preview?.templateName ?? ""}"`}
      footer={
        step === "pick" ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleNext} disabled={!templateId || busy}>Next</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep("pick")}>Back</Button>
            <Button variant="primary" onClick={handleApply} disabled={busy}>Apply template</Button>
          </>
        )
      }
    >
      {step === "pick" && (
        <div className={styles.stack}>
          {templates.length === 0 ? (
            <p className={styles.empty}>No templates yet. Build a week and use “Save as template” first.</p>
          ) : (
            <>
              <Select
                label="Template"
                value={templateId}
                onChange={setTemplateId}
                placeholder="Choose a template"
                options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.rowCount} shifts)` }))}
              />
              <Select
                label="Apply to"
                value={targetWeek}
                onChange={(v) => setTargetWeek(v as ISODate)}
                options={weekOptions}
              />
            </>
          )}
        </div>
      )}

      {step === "review" && preview && (
        <div className={styles.stack}>
          {preview.occupancy.draftCount > 0 && (
            <Select
              label="This week already has draft shifts"
              value={mode}
              onChange={(v) => setMode(v as "replace" | "add")}
              options={[
                { value: "replace", label: "Replace existing draft shifts" },
                { value: "add", label: "Add on top of them" },
              ]}
            />
          )}
          {preview.occupancy.publishedCount > 0 && (
            <p className={styles.warning}>
              This week has {preview.occupancy.publishedCount} published shift
              {preview.occupancy.publishedCount === 1 ? "" : "s"} — those are left untouched; new shifts come in as drafts.
            </p>
          )}
          <div className={styles.rows}>
            {preview.rows.map((r) => (
              <div key={r.rowId} className={styles.row}>
                <div className={styles.rowMeta}>
                  <div className={styles.rowMetaTitle}>
                    {DOW_LABELS[r.dayOfWeek]} · {r.positionName}
                  </div>
                  <div>{r.timeRange}</div>
                </div>
                <div>
                  <Select
                    value={assignments[r.rowId] ?? ""}
                    onChange={(v) => setAssignments((a) => ({ ...a, [r.rowId]: v }))}
                    placeholder="Open shift (unassigned)"
                    options={qualifiedEmployees(employees, r.positionId).map((e) => ({
                      value: e.employeeProfileId,
                      label: e.name,
                    }))}
                  />
                  {r.conflicts.length > 0 && (
                    <div className={styles.conflicts}>
                      {r.conflicts.map((c) => (
                        <ConflictChip key={c.message}>{c.message}</ConflictChip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire into `ScheduleView.tsx`** — three edits:

Import after the `SaveAsTemplateDialog` import:

```tsx
import ApplyTemplateDialog from "@/components/schedule/ApplyTemplateDialog";
```

State after `const [saveOpen, setSaveOpen] = useState(false);`:

```tsx
  const [applyOpen, setApplyOpen] = useState(false);
```

Add an "Apply template" button in `actions`, right after the "Save as template" button:

```tsx
          <Button variant="secondary" onClick={() => setApplyOpen(true)}>
            Apply template
          </Button>
```

Add the dialog render after the `<SaveAsTemplateDialog … />` line:

```tsx
      <ApplyTemplateDialog
        open={applyOpen}
        week={week}
        employees={employees}
        onClose={() => setApplyOpen(false)}
      />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/components/schedule/ApplyTemplateDialog.test.tsx`
Expected: PASS (pure helper unit tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/schedule/ApplyTemplateDialog.tsx src/components/schedule/ApplyTemplateDialog.module.css src/components/schedule/ApplyTemplateDialog.test.tsx src/components/schedule/ScheduleView.tsx
git commit -m "feat: apply-template dialog (pick, preview, review, confirm)"
```

---
### Task 11: Templates page (list + manage) + nav entry

**Files:**
- Create: `src/components/manager/TemplatesView.tsx`
- Create: `src/components/manager/TemplatesView.module.css`
- Create: `src/app/manager/templates/page.tsx`
- Create: `src/app/manager/templates/loading.tsx`
- Create: `src/app/manager/templates/error.tsx`
- Modify: `src/components/chrome/ManagerSidebar.tsx` (add NAV entry)
- Test: `src/components/manager/TemplatesView.test.tsx`

**Interfaces:**
- Consumes: `ApplyTemplateDialog`; `Card`, `Button`, `Dialog`, `Input`, `EmptyState`, `useToast`; `Link`, `useRouter`; `TemplateSummary`, `EmployeeOption`, `ISODate`.
- Produces: `TemplatesView({ currentWeek, employees, templates })` (named export) + `templateSubtitle(t: TemplateSummary): string` (named, unit-tested). New NAV item `{ href: "/manager/templates", label: "Templates", icon: "calendar-days" }`.

- [ ] **Step 1: Write the failing test** `src/components/manager/TemplatesView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { TemplatesView, templateSubtitle } from "@/components/manager/TemplatesView";
import type { TemplateSummary } from "@/lib/template-data";

const templates: TemplateSummary[] = [
  { id: "t1", name: "Standard week", rowCount: 12, updatedAt: "2026-07-06T12:00:00.000Z" },
  { id: "t2", name: "Weekend crew", rowCount: 4, updatedAt: "2026-07-05T12:00:00.000Z" },
];

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

describe("templateSubtitle", () => {
  it("summarizes count + updated date", () => {
    expect(templateSubtitle(templates[0])).toContain("12 shifts");
    expect(templateSubtitle({ ...templates[0], rowCount: 1 })).toContain("1 shift ·");
  });
});

describe("TemplatesView", () => {
  it("lists templates", () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={templates} />);
    expect(screen.getByText("Standard week")).toBeTruthy();
    expect(screen.getByText("Weekend crew")).toBeTruthy();
  });

  it("shows an empty state with no templates", () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={[]} />);
    expect(screen.getByText("No templates yet")).toBeTruthy();
  });

  it("deletes a template after confirming", async () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={templates} />);
    fireEvent.click(screen.getAllByText("Delete")[0]); // card action opens the confirm dialog
    fireEvent.click(screen.getByText("Delete template")); // dialog confirm button
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/schedule-templates/t1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/manager/TemplatesView.test.tsx`
Expected: FAIL — cannot find `TemplatesView`.

- [ ] **Step 3: Create `src/components/manager/TemplatesView.module.css`:**

```css
.header {
  display: flex;
  align-items: center;
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
.actions {
  display: flex;
  gap: 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}
.card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
}
.name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}
.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.cardActions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.editLink {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-link, var(--text-primary));
  text-decoration: none;
  padding: 6px 8px;
}
.editLink:hover {
  text-decoration: underline;
}
```

> `--text-link` may not exist; the fallback `var(--text-link, var(--text-primary))` handles that. Prefer an accent token if `src/styles/tokens/` defines one.

- [ ] **Step 4: Implement `src/components/manager/TemplatesView.tsx`:**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ApplyTemplateDialog from "@/components/schedule/ApplyTemplateDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toaster";
import type { EmployeeOption } from "@/lib/schedule-data";
import type { TemplateSummary } from "@/lib/template-data";
import type { ISODate } from "@/lib/time";
import styles from "./TemplatesView.module.css";

export function templateSubtitle(t: TemplateSummary): string {
  const when = new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${t.rowCount} shift${t.rowCount === 1 ? "" : "s"} · updated ${when}`;
}

type TemplatesViewProps = {
  currentWeek: ISODate;
  employees: EmployeeOption[];
  templates: TemplateSummary[];
};

export function TemplatesView({ currentWeek, employees, templates }: TemplatesViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TemplateSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  async function createTemplate() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Name your template");
    try {
      const res = await fetch("/api/schedule-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, rows: [] }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      setNewOpen(false);
      router.push(`/manager/templates/${body.data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function renameTemplate() {
    if (!renameTarget) return;
    const trimmed = name.trim();
    if (!trimmed) return setError("Name your template");
    const target = renameTarget;
    setRenameTarget(null);
    try {
      const res = await fetch(`/api/schedule-templates/${target.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template renamed" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't rename", description: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function removeTemplate() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/schedule-templates/${target.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template deleted" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't delete", description: err instanceof Error ? err.message : "Try again." });
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Templates</h1>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setApplyOpen(true)} disabled={templates.length === 0}>
            Apply a template
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setName("");
              setError(undefined);
              setNewOpen(true);
            }}
          >
            New template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Save a week from the schedule, or create one here, to reuse staffing patterns."
        />
      ) : (
        <div className={styles.grid}>
          {templates.map((t) => (
            <Card key={t.id} className={styles.card}>
              <div>
                <div className={styles.name}>{t.name}</div>
                <div className={styles.subtitle}>{templateSubtitle(t)}</div>
              </div>
              <div className={styles.cardActions}>
                <Link href={`/manager/templates/${t.id}`} className={styles.editLink}>
                  Edit
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setName(t.name);
                    setError(undefined);
                    setRenameTarget(t);
                  }}
                >
                  Rename
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(t)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createTemplate}>Create</Button>
          </>
        }
      >
        <Input label="Template name" placeholder="e.g. Weekend crew" value={name} onChange={(e) => setName(e.target.value)} error={error} />
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={renameTemplate}>Save</Button>
          </>
        }
      >
        <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete template?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={removeTemplate}>Delete template</Button>
          </>
        }
      >
        <p>“{deleteTarget?.name}” will be removed. Shifts you already created from it stay put.</p>
      </Dialog>

      <ApplyTemplateDialog open={applyOpen} week={currentWeek} employees={employees} onClose={() => setApplyOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/manager/templates/page.tsx`:**

```tsx
import type { Metadata } from "next";
import { TemplatesView } from "@/components/manager/TemplatesView";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getAssignableEmployees } from "@/lib/schedule-data";
import { listTemplates } from "@/lib/template-data";
import { localISODate, weekStartOfISO } from "@/lib/time";

export const metadata: Metadata = { title: "Templates — RosterHouse" };

export default async function TemplatesPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const [templates, employees] = await Promise.all([
    listTemplates(location.id),
    getAssignableEmployees(location.id),
  ]);
  const currentWeek = weekStartOfISO(localISODate(new Date(), location.timezone));
  return <TemplatesView currentWeek={currentWeek} employees={employees} templates={templates} />;
}
```

- [ ] **Step 6: Create `src/app/manager/templates/loading.tsx`:**

```tsx
import { Spinner } from "@/components/ui/Spinner";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplatesLoading() {
  return (
    <div className={styles.loadingWrap} role="status" aria-label="Loading templates">
      <Spinner />
      <span>Loading templates…</span>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/app/manager/templates/error.tsx`:**

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplatesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.errorWrap}>
      <EmptyState
        title="Something went wrong loading templates"
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

- [ ] **Step 8: Add the nav entry** in `src/components/chrome/ManagerSidebar.tsx` — insert into `NAV` right after the Schedule item:

```tsx
  { href: "/manager/schedule", label: "Schedule", icon: "calendar" },
  { href: "/manager/templates", label: "Templates", icon: "calendar-days" },
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- src/components/manager/TemplatesView.test.tsx`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/manager/TemplatesView.tsx src/components/manager/TemplatesView.module.css src/app/manager/templates src/components/chrome/ManagerSidebar.tsx src/components/manager/TemplatesView.test.tsx
git commit -m "feat: templates page (list/new/rename/delete/apply) + nav entry"
```

---

### Task 12: Template row editor (grid) + template-shift dialog

**Files:**
- Create: `src/components/schedule/TemplateEditor.tsx`
- Create: `src/components/schedule/TemplateShiftDialog.tsx`
- Create: `src/app/manager/templates/[templateId]/page.tsx`
- Create: `src/app/manager/templates/[templateId]/loading.tsx`
- Create: `src/app/manager/templates/[templateId]/error.tsx`
- Test: `src/components/schedule/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes: `qualifiedEmployees` (`@/components/schedule/AssignShiftDialog`); `WeekGridCell`, `ShiftBlock`; `Dialog`, `Button`, `Select`, `Input`, `TimeField`, `Textarea`, `useToast`, `useRouter`; `TemplateDetail`/`TemplateRow` (`@/lib/template-data`), `TemplateRowInput` (`@/lib/template-schemas`); `parseTime12h`; grid CSS (`./grids.module.css`), `./schedule.module.css`, `./AssignShiftDialog.module.css`.
- Produces:
  - `TemplateEditor({ template, positions, employees })` (default export) + `type EditorRow` + `detailRowsToEditor(rows: TemplateRow[]): EditorRow[]` + `editorRowsToInput(rows: EditorRow[]): TemplateRowInput[]` (named, unit-tested).
  - `TemplateShiftDialog({ open, positions, employees, initial, onSave, onDelete, onClose })` (default export).

- [ ] **Step 1: Write the failing test** `src/components/schedule/TemplateEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { detailRowsToEditor, editorRowsToInput, type EditorRow } from "@/components/schedule/TemplateEditor";
import type { TemplateRow } from "@/lib/template-data";

describe("editor row conversions", () => {
  it("round-trips detail rows to editor rows to inputs", () => {
    const detail: TemplateRow[] = [
      {
        id: "row-1", positionId: "pos-1", positionName: "Server", employeeProfileId: "ep-1",
        employeeName: "Ana", dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM", notes: "Open",
      },
    ];
    const editor = detailRowsToEditor(detail);
    expect(editor[0]).toMatchObject({ key: "row-1", positionId: "pos-1", dayOfWeek: 0, startTime: "9:00 AM" });

    const input = editorRowsToInput(editor);
    expect(input[0]).toEqual({
      positionId: "pos-1", employeeProfileId: "ep-1", dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM", notes: "Open",
    });
    expect("key" in input[0]).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/schedule/TemplateEditor.test.tsx`
Expected: FAIL — cannot find `TemplateEditor`.

- [ ] **Step 3: Implement `src/components/schedule/TemplateShiftDialog.tsx`:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { qualifiedEmployees } from "@/components/schedule/AssignShiftDialog";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TimeField } from "@/components/ui/TimeField";
import type { EmployeeOption } from "@/lib/schedule-data";
import { parseTime12h } from "@/lib/time";
import type { EditorRow } from "@/components/schedule/TemplateEditor";
import styles from "./AssignShiftDialog.module.css";

const DOW_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, value) => ({
  value: String(value),
  label,
}));

type TemplateShiftDialogProps = {
  open: boolean;
  positions: { id: string; name: string }[];
  employees: EmployeeOption[];
  initial: EditorRow | null;
  onSave: (row: EditorRow) => void;
  onDelete: (key: string) => void;
  onClose: () => void;
};

type FieldErrors = { start?: string; end?: string; position?: string };

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export default function TemplateShiftDialog({
  open,
  positions,
  employees,
  initial,
  onSave,
  onDelete,
  onClose,
}: TemplateShiftDialogProps) {
  const isEdit = Boolean(initial?.key);
  const [positionId, setPositionId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [employeeProfileId, setEmployeeProfileId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPositionId(initial?.positionId ?? "");
    setDayOfWeek(String(initial?.dayOfWeek ?? 0));
    setEmployeeProfileId(initial?.employeeProfileId ?? "");
    setStartTime(initial?.startTime ?? "");
    setEndTime(initial?.endTime ?? "");
    setNotes(initial?.notes ?? "");
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initial]);

  const eligible = positionId ? qualifiedEmployees(employees, positionId) : employees;

  function handleSave() {
    const next: FieldErrors = {};
    if (!positionId) next.position = "Choose a position";
    if (!parseTime12h(startTime)) next.start = "Enter a time like 7:00 AM";
    if (!parseTime12h(endTime)) next.end = "Enter a time like 3:00 PM";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave({
      key: initial?.key || newKey(),
      positionId,
      dayOfWeek: Number(dayOfWeek),
      employeeProfileId: employeeProfileId || null,
      startTime,
      endTime,
      notes: notes || null,
    });
    onClose();
  }

  function handleRemove() {
    if (initial?.key) onDelete(initial.key);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit template shift" : "Add template shift"}
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
        <Select label="Day of week" value={dayOfWeek} onChange={setDayOfWeek} options={DOW_OPTIONS} />
        <Select
          label="Employee"
          value={employeeProfileId}
          onChange={setEmployeeProfileId}
          placeholder="Open shift (unassigned)"
          options={eligible.map((e) => ({ value: e.employeeProfileId, label: e.name }))}
        />
        <div className={styles.timeRow}>
          <TimeField label="Start" placeholder="7:00 AM" value={startTime} onChange={setStartTime} error={errors.start} />
          <TimeField label="End" placeholder="3:00 PM" value={endTime} onChange={setEndTime} error={errors.end} />
        </div>
        <Textarea
          label="Notes"
          placeholder="Anything the employee should know"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: Implement `src/components/schedule/TemplateEditor.tsx`:**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TemplateShiftDialog from "@/components/schedule/TemplateShiftDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import { useToast } from "@/components/ui/Toaster";
import type { EmployeeOption } from "@/lib/schedule-data";
import type { TemplateDetail, TemplateRow } from "@/lib/template-data";
import type { TemplateRowInput } from "@/lib/template-schemas";
import gridStyles from "./grids.module.css";
import styles from "./schedule.module.css";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type EditorRow = {
  key: string;
  positionId: string;
  employeeProfileId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};

export function detailRowsToEditor(rows: TemplateRow[]): EditorRow[] {
  return rows.map((r) => ({
    key: r.id,
    positionId: r.positionId,
    employeeProfileId: r.employeeProfileId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes,
  }));
}

export function editorRowsToInput(rows: EditorRow[]): TemplateRowInput[] {
  return rows.map((r) => ({
    positionId: r.positionId,
    employeeProfileId: r.employeeProfileId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes,
  }));
}

type TemplateEditorProps = {
  template: TemplateDetail;
  positions: { id: string; name: string }[];
  employees: EmployeeOption[];
};

export default function TemplateEditor({ template, positions, employees }: TemplateEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(template.name);
  const [rows, setRows] = useState<EditorRow[]>(detailRowsToEditor(template.rows));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<EditorRow | null>(null);
  const [saving, setSaving] = useState(false);

  function employeeName(id: string | null): string | null {
    if (!id) return null;
    return employees.find((e) => e.employeeProfileId === id)?.name ?? "Assigned";
  }

  function openAdd(positionId: string, dayOfWeek: number) {
    setDialogInitial({ key: "", positionId, employeeProfileId: null, dayOfWeek, startTime: "", endTime: "", notes: null });
    setDialogOpen(true);
  }

  function upsertRow(row: EditorRow) {
    setRows((prev) => (prev.some((r) => r.key === row.key) ? prev.map((r) => (r.key === row.key ? row : r)) : [...prev, row]));
  }

  function deleteRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rows: editorRowsToInput(rows) }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template saved" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save template", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSaving(false);
    }
  }

  const byCell = new Map<string, EditorRow[]>();
  for (const r of rows) {
    const key = `${r.positionId}|${r.dayOfWeek}`;
    byCell.set(key, [...(byCell.get(key) ?? []), r]);
  }

  return (
    <div>
      <div className={styles.header}>
        <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className={styles.actions}>
          <Button variant="primary" onClick={save} disabled={saving || !name.trim()}>
            Save template
          </Button>
        </div>
      </div>

      <div className={gridStyles.weekGrid}>
        <div className={gridStyles.headerRow}>
          <div />
          {DOW_LABELS.map((d) => (
            <div key={d} className={gridStyles.dayLabel}>
              {d}
            </div>
          ))}
        </div>
        {positions.map((position) => (
          <div key={position.id} className={gridStyles.positionRow}>
            <div className={gridStyles.positionLabel}>{position.name}</div>
            {DOW_LABELS.map((label, dow) => {
              const cellRows = byCell.get(`${position.id}|${dow}`) ?? [];
              if (cellRows.length === 0) {
                return (
                  <WeekGridCell
                    key={dow}
                    empty
                    onClick={() => openAdd(position.id, dow)}
                    addLabel={`Add ${position.name} on ${label}`}
                  />
                );
              }
              return (
                <WeekGridCell key={dow}>
                  <div className={gridStyles.cellStack}>
                    {cellRows.map((r) => (
                      <ShiftBlock
                        key={r.key}
                        compact
                        role={employeeName(r.employeeProfileId) ?? "Open shift"}
                        time={`${r.startTime} – ${r.endTime}`}
                        status={r.employeeProfileId ? "confirmed" : "open"}
                        onClick={() => {
                          setDialogInitial(r);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      className={gridStyles.addButton}
                      aria-label={`Add ${position.name} on ${label}`}
                      onClick={() => openAdd(position.id, dow)}
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

      <TemplateShiftDialog
        open={dialogOpen}
        positions={positions}
        employees={employees}
        initial={dialogInitial}
        onSave={upsertRow}
        onDelete={deleteRow}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
```

> Confirm `ShiftBlock` and `WeekGridCell` prop names against `src/components/ui/ShiftBlock.tsx` / `WeekGridCell.tsx` (they are used identically in `WeekGrid.tsx`: `ShiftBlock` takes `compact`, `role`, `time`, `status`, `conflictReason?`, `onClick`; `WeekGridCell` takes `empty?`, `hasConflict?`, `onClick?`, `addLabel?`, `children`). Match exactly.

- [ ] **Step 5: Create `src/app/manager/templates/[templateId]/page.tsx`:**

```tsx
import { notFound } from "next/navigation";
import TemplateEditor from "@/components/schedule/TemplateEditor";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getAssignableEmployees } from "@/lib/schedule-data";
import { getTemplateDetail } from "@/lib/template-data";

export default async function TemplateEditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const [template, positions, employees] = await Promise.all([
    getTemplateDetail(location.id, templateId),
    prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } }),
    getAssignableEmployees(location.id),
  ]);
  if (!template) notFound();
  return (
    <TemplateEditor
      template={template}
      positions={positions.map((p) => ({ id: p.id, name: p.name }))}
      employees={employees}
    />
  );
}
```

- [ ] **Step 6: Create `src/app/manager/templates/[templateId]/loading.tsx` and `error.tsx`** — same bodies as Task 11 Steps 6–7 but labelled "template":

`loading.tsx`:

```tsx
import { Spinner } from "@/components/ui/Spinner";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplateEditorLoading() {
  return (
    <div className={styles.loadingWrap} role="status" aria-label="Loading template">
      <Spinner />
      <span>Loading template…</span>
    </div>
  );
}
```

`error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplateEditorError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.errorWrap}>
      <EmptyState
        title="Something went wrong loading this template"
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

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- src/components/schedule/TemplateEditor.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/schedule/TemplateEditor.tsx src/components/schedule/TemplateShiftDialog.tsx src/components/schedule/TemplateEditor.test.tsx "src/app/manager/templates/[templateId]"
git commit -m "feat: template row editor (grid) + template-shift dialog"
```

---
### Task 13: Full-suite verification + manual QA

**Files:** none (verification + fixes only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites PASS — the pre-existing ~392 tests plus the new `template-schemas`, `template-data`, `template-api`, `SaveAsTemplateDialog`, `ApplyTemplateDialog`, `TemplatesView`, `TemplateEditor` suites. Fix any regression before proceeding.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Common fixes: unused imports, and the `react-hooks/set-state-in-effect` disables must wrap only the seeding `setState` calls (see the pattern copied from `AssignShiftDialog.tsx`).

- [ ] **Step 3: Typecheck + build**

Run: `npm run build`
Expected: `prisma generate` succeeds, then `next build` completes with no type errors. This is the real gate for the route-handler param types and the Prisma payload types.

- [ ] **Step 4: Manual QA in the running app** (browser — do this with the preview tooling or `npm run dev`; sign in as `jamie@harborvine.test` / `rosterhouse1`).

Verify the full loop:
1. **Save:** On `/manager/schedule`, a week with shifts → "Save as template" → name it → toast confirms. `/manager/templates` lists it with the right shift count.
2. **Edit:** Open the template → grid shows the snapshotted rows in the right position/day cells → add a row, edit a row's time, remove a row, rename → "Save template" → reopen and confirm the changes persisted.
3. **Apply (empty week):** Navigate the schedule to a future empty week → "Apply template" → pick it → review shows each row with the remembered assignee pre-filled and any conflict hints → confirm → draft shifts appear in the grid; the week reads "Draft".
4. **Apply (replace vs add):** Apply again to the same week → the dialog offers Replace / Add → "Replace" leaves it at N shifts (no duplicates); "Add" doubles them.
5. **Published safety:** Publish a week, then apply a template to it → published shifts remain; new ones come in as draft and the header shows "Unpublished changes".
6. **Assignment coercion:** A template whose remembered employee you then remove from the team → applying leaves that slot Open (no crash).

- [ ] **Step 5: Confirm the branch is clean and ready**

Run: `git status`
Expected: clean working tree; all work committed on `feat/schedule-templates`.

The branch is ready for review/land (e.g. gstack `/ship` or a PR). No `VERSION`/`CHANGELOG` files exist in this repo, so there's nothing to bump.

---

## Spec Coverage Map

Every spec section maps to a task (verify during execution):

| Spec requirement | Task(s) |
|---|---|
| `ScheduleTemplate` + `ScheduleTemplateRow` models, back-relations, `@@unique([locationId, name])` | 1 |
| Day-of-week + wall-clock storage; DST-safe re-derivation | 1, 6 (round-trip test) |
| 12-hour time format | 2, 4 |
| Zod schemas (create/update/preview/apply) | 2 |
| Snapshot a week → rows (open shifts + cross-midnight captured) | 4 |
| Preview: resolve dates, occupancy, conflict hints, stale-assignee → open | 5 |
| Apply: transactional, replace deletes only draft, published untouched, assignment coercion | 6 |
| CRUD endpoints + tenancy + 409 name | 7 |
| Preview + apply endpoints | 8 |
| Save-as-template button + dialog | 9 |
| Apply dialog (pick → preview → review/confirm, replace/add) | 10 |
| Templates page (list/new/rename/delete/apply) + nav entry | 11 |
| Full row editor + day-of-week dialog | 12 |
| Notes carry over; conflicts advisory (computed not stored) | 4, 6 (notes), 5/10 (hints) |
| Out of scope: multi-week apply, org-wide templates, versioning | — (not built, by design) |
| Testing: round-trip, apply modes, tenancy, name-uniqueness, preview | 3–8, 13 |





