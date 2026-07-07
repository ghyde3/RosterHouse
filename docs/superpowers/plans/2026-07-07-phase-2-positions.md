# Phase 2 — Positions Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Let managers add, rename, reorder, and archive the positions that drive scheduling, without ever hard-deleting a position that has data, while keeping archived roles out of every *new*-scheduling picker but visible on the schedule grid whenever they still have a shift.

**Architecture:** A nullable `Position.archivedAt` column marks a role active (`null`) or archived. Three manager-guarded, tenancy-scoped route handlers (`POST /api/positions`, `PATCH /api/positions/[positionId]`, `PATCH /api/positions/reorder`) mirror the existing `/api/shifts` route pattern (guard → parse zod → validate → prisma → `jsonOk`) with case-insensitive name uniqueness matching the signup dedup. Every `prisma.position.findMany` that feeds a *new*-scheduling picker gains `where: { archivedAt: null }`; `getScheduleWeekData` changes its grid rows to *active positions ∪ positions referenced by this week's shifts* so archived-but-scheduled roles still render. A client `PositionsView` at `/manager/settings/positions` renders the active list (name · up/down · Rename · Archive), an Add input, and a collapsed Archived list with Unarchive.

**Tech Stack:** Next.js 16, Prisma 7 + Postgres, zod 4, React 19, Vitest 4, CSS modules.

## Global Constraints

- **Phase 1 dependency:** Phase 1 ("Settings foundation") creates `src/app/manager/settings/layout.tsx` (the horizontal Location · Positions · Templates sub-nav) and a stub `src/app/manager/settings/positions/page.tsx`. This plan **fills in** that page. If Phase 1 has not landed, the page created in Task 6 still works standalone (it renders inside the existing `src/app/manager/layout.tsx` sidebar shell); the sub-nav is Phase 1's concern, not this plan's.
- **Tenancy on every endpoint:** `const guard = await requireManagerForApi(); if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);` then scope every query to `guard.location.id`. For `[positionId]` routes, load the row with `where: { id, locationId: guard.location.id }` and 404 if absent.
- **JSON envelopes:** `jsonOk(data, status?)`, `jsonErr(code, message, status)`; wrap every handler body in `try { … } catch (err) { return handleApiError(err); }`; throw `new ApiError(status, code, message)` inside lib helpers. All from `@/lib/api`.
- **Case-insensitive uniqueness** for position names, mirroring `src/app/api/auth/signup/route.ts:51-61`: compare `name.trim().toLowerCase()` against existing **active** positions' lowercased names. Collision → `409 { code: "name_taken" }`. This is tighter than the DB's case-sensitive `@@unique([locationId, name])`.
- **Archive, never hard-delete.** `Shift.positionId`, `EmployeeProfile.primaryPositionId`, and `Invite.positionId` have no `onDelete` (default `Restrict`) — a hard delete throws at the DB. Archiving sets `archivedAt = new Date()`; unarchiving sets it back to `null`.
- **Archived roles disappear from every *new*-scheduling picker** (`where: { archivedAt: null }`): schedule page positions, team/invite positions, template editor positions. **`getScheduleWeekData` grid rows = active positions ∪ positions referenced by this week's shifts.** Views that display an *existing* shift's position keep joining `Position` regardless (archived still renders on old records).
- **`sortOrder`** is dense per active list: new position gets `max(sortOrder among active) + 1`; reorder assigns `sortOrder = index` across the passed `orderedIds` in one transaction.
- **Prisma imports:** `import { prisma } from "@/lib/db";` and `import { Prisma } from "@/generated/prisma/client";`.
- **No Tailwind.** CSS modules + design tokens (`var(--...)`). Reuse existing tokens/classes.
- **UI kit (no barrel):** `@/components/ui/{Button,Input,EmptyState,Icon,Badge}`; toast via `useToast` from `@/components/ui/Toaster`; `useRouter().refresh()` after mutations.
- **Migrations:** `npx prisma migrate dev --name <x>` then `npx prisma generate`.
- **Commit after every task** with a `feat:` / `test:` message.
- **Run a single test file** with `npm test -- <path>`.

---

## Task 1 — Add `Position.archivedAt` column (migration)

**Files:**
- Modify: `prisma/schema.prisma` (Position model)
- Create: `prisma/migrations/<timestamp>_position_archived_at/migration.sql` (generated)

**Interfaces:**
- Produces: `Position.archivedAt: DateTime?` (Prisma), regenerated `@/generated/prisma/client` types with `archivedAt: Date | null` on `Position`.
- Consumes: nothing.

**Steps:**

- [ ] 1.1 — Modify the Position model in `prisma/schema.prisma`. Locate (lines ~185-200):
  ```prisma
  model Position {
    id         String   @id @default(cuid())
    locationId String
    name       String
    sortOrder  Int      @default(0) // week grid renders positions as fixed ordered rows
    createdAt  DateTime @default(now())

    location         Location           @relation(fields: [locationId], references: [id], onDelete: Cascade)
    shifts           Shift[]
    employees        EmployeePosition[]
    primaryFor       EmployeeProfile[]  @relation("PrimaryPosition")
    invites          Invite[]
    templateRows     ScheduleTemplateRow[]

    @@unique([locationId, name])
  }
  ```
  Add `archivedAt` immediately after `createdAt`:
  ```prisma
  model Position {
    id         String    @id @default(cuid())
    locationId String
    name       String
    sortOrder  Int       @default(0) // week grid renders positions as fixed ordered rows
    createdAt  DateTime  @default(now())
    archivedAt DateTime? // null = active; set = hidden from new scheduling

    location         Location           @relation(fields: [locationId], references: [id], onDelete: Cascade)
    shifts           Shift[]
    employees        EmployeePosition[]
    primaryFor       EmployeeProfile[]  @relation("PrimaryPosition")
    invites          Invite[]
    templateRows     ScheduleTemplateRow[]

    @@unique([locationId, name])
  }
  ```

- [ ] 1.2 — Run the migration: `npx prisma migrate dev --name position_archived_at`. Expected: a new migration folder is created and applied; the SQL contains `ALTER TABLE "Position" ADD COLUMN "archivedAt" TIMESTAMP(3);` (nullable, no default). Expected PASS (migration applies cleanly to the dev DB).

- [ ] 1.3 — Regenerate the client: `npx prisma generate`. Expected: `@/generated/prisma/client` now types `Position.archivedAt` as `Date | null`.

- [ ] 1.4 — Sanity-check compilation: `npx tsc --noEmit`. Expected PASS (no type errors from the new column — nothing references it yet).

- [ ] 1.5 — Commit: `git add prisma/schema.prisma prisma/migrations && git commit -m "feat: add Position.archivedAt column for archive-not-delete"`.

---

## Task 2 — Position zod schemas + case-insensitive uniqueness helper

**Files:**
- Create: `src/lib/position-schemas.ts`
- Create: `src/lib/position-data.ts`
- Test: `src/tests/position-data.test.ts`

**Interfaces:**
- Produces:
  - `createPositionSchema = z.object({ name: z.string().trim().min(1).max(60) })`
  - `updatePositionSchema = z.object({ name: z.string().trim().min(1).max(60).optional(), archived: z.boolean().optional() }).refine(has-at-least-one-field)`
  - `reorderPositionsSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) })`
  - `type CreatePositionInput = z.infer<typeof createPositionSchema>` etc.
  - `assertNameAvailable(locationId: string, name: string, opts?: { excludeId?: string }): Promise<void>` — throws `new ApiError(409, "name_taken", "A position with that name already exists")` if any **active** position at the location has the same lowercased name (excluding `excludeId`).
  - `nextSortOrder(locationId: string): Promise<number>` — returns `max(sortOrder among active positions) + 1`, or `0` if none.
- Consumes: `ApiError` from `@/lib/api`; `prisma` from `@/lib/db`.

**Steps:**

- [ ] 2.1 — Write the failing test `src/tests/position-data.test.ts`:
  ```ts
  import "dotenv/config"; // @/lib/db builds the Prisma client from DATABASE_URL at import time
  import { afterAll, beforeAll, describe, expect, it } from "vitest";

  import { prisma } from "@/lib/db";
  import { ApiError } from "@/lib/api";
  import { assertNameAvailable, nextSortOrder } from "@/lib/position-data";
  import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  describe("assertNameAvailable", () => {
    it("resolves for a brand-new name", async () => {
      await expect(assertNameAvailable(f.locationId, "Bartender")).resolves.toBeUndefined();
    });

    it("throws 409 name_taken on a case-insensitive collision with an active position", async () => {
      // Fixture seeds an active "Server" position.
      await expect(assertNameAvailable(f.locationId, "server")).rejects.toMatchObject({
        status: 409,
        code: "name_taken",
      });
      await expect(assertNameAvailable(f.locationId, "  SERVER  ")).rejects.toBeInstanceOf(ApiError);
    });

    it("ignores the excluded id (rename to same name is allowed)", async () => {
      await expect(
        assertNameAvailable(f.locationId, "Server", { excludeId: f.positionIds.server }),
      ).resolves.toBeUndefined();
    });

    it("ignores archived positions when checking availability", async () => {
      const archived = await prisma.position.create({
        data: { locationId: f.locationId, name: "Barback", sortOrder: 99, archivedAt: new Date() },
      });
      // Same name as an archived role is allowed because archive frees the name for new scheduling.
      await expect(assertNameAvailable(f.locationId, "barback")).resolves.toBeUndefined();
      await prisma.position.delete({ where: { id: archived.id } });
    });
  });

  describe("nextSortOrder", () => {
    it("returns max active sortOrder + 1", async () => {
      // Fixture: Server sortOrder 0, Dishwasher sortOrder 1 → next is 2.
      await expect(nextSortOrder(f.locationId)).resolves.toBe(2);
    });

    it("returns 0 when the location has no active positions", async () => {
      const org = await prisma.organization.create({ data: { name: "Empty org for sortorder" } });
      const loc = await prisma.location.create({
        data: { organizationId: org.id, name: "Empty loc", timezone: "America/New_York" },
      });
      await expect(nextSortOrder(loc.id)).resolves.toBe(0);
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });
  ```

- [ ] 2.2 — Run it: `npm test -- src/tests/position-data.test.ts`. Expected FAIL (`Cannot find module '@/lib/position-data'`).

- [ ] 2.3 — Create `src/lib/position-schemas.ts`:
  ```ts
  import { z } from "zod";

  export const createPositionSchema = z.object({
    name: z.string().trim().min(1, { message: "Name your position" }).max(60, { message: "Keep it under 60 characters" }),
  });

  export const updatePositionSchema = z
    .object({
      name: z.string().trim().min(1, { message: "Name your position" }).max(60, { message: "Keep it under 60 characters" }).optional(),
      archived: z.boolean().optional(),
    })
    .refine((v) => v.name !== undefined || v.archived !== undefined, {
      message: "Nothing to update",
    });

  export const reorderPositionsSchema = z.object({
    orderedIds: z.array(z.string().min(1)).min(1, { message: "orderedIds must not be empty" }),
  });

  export type CreatePositionInput = z.infer<typeof createPositionSchema>;
  export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
  export type ReorderPositionsInput = z.infer<typeof reorderPositionsSchema>;
  ```

- [ ] 2.4 — Create `src/lib/position-data.ts`:
  ```ts
  import { ApiError } from "@/lib/api";
  import { prisma } from "@/lib/db";

  /**
   * Case-insensitive name uniqueness for ACTIVE positions, mirroring the
   * signup dedup (src/app/api/auth/signup/route.ts). Tighter than the DB's
   * case-sensitive @@unique([locationId, name]). Archived positions are
   * ignored: archiving frees the name for new scheduling.
   */
  export async function assertNameAvailable(
    locationId: string,
    name: string,
    opts: { excludeId?: string } = {},
  ): Promise<void> {
    const target = name.trim().toLowerCase();
    const actives = await prisma.position.findMany({
      where: { locationId, archivedAt: null },
      select: { id: true, name: true },
    });
    const clash = actives.some(
      (p) => p.id !== opts.excludeId && p.name.trim().toLowerCase() === target,
    );
    if (clash) {
      throw new ApiError(409, "name_taken", "A position with that name already exists");
    }
  }

  /** Next dense sortOrder = max(active sortOrder) + 1, or 0 when there are none. */
  export async function nextSortOrder(locationId: string): Promise<number> {
    const top = await prisma.position.findFirst({
      where: { locationId, archivedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return top ? top.sortOrder + 1 : 0;
  }
  ```

- [ ] 2.5 — Run it: `npm test -- src/tests/position-data.test.ts`. Expected PASS (all 5 assertions green).

- [ ] 2.6 — Commit: `git add src/lib/position-schemas.ts src/lib/position-data.ts src/tests/position-data.test.ts && git commit -m "feat: position schemas + case-insensitive name/sortOrder helpers"`.

---

## Task 3 — `POST /api/positions` (create) + `PATCH /api/positions/[positionId]` (rename/archive)

**Files:**
- Create: `src/app/api/positions/route.ts`
- Create: `src/app/api/positions/[positionId]/route.ts`
- Test: `src/tests/positions-api.test.ts`

**Interfaces:**
- Consumes: `requireManagerForApi` (`@/lib/manager-guard`); `handleApiError`, `jsonErr`, `jsonOk` (`@/lib/api`); `createPositionSchema`, `updatePositionSchema` (`@/lib/position-schemas`); `assertNameAvailable`, `nextSortOrder` (`@/lib/position-data`); `prisma` (`@/lib/db`).
- Produces:
  - `POST /api/positions` — body `{ name }` → `jsonOk({ position: { id, name, sortOrder, archivedAt } }, 201)`; 409 `name_taken` on case-insensitive dup.
  - `PATCH /api/positions/[positionId]` — body `{ name?, archived? }` → `jsonOk({ position: { id, name, sortOrder, archivedAt } })`; 404 if the position isn't at `guard.location.id`; 409 `name_taken` on rename collision.

**Steps:**

- [ ] 3.1 — Write the failing test `src/tests/positions-api.test.ts`:
  ```ts
  import "dotenv/config";
  import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

  const mockSession = vi.hoisted(() => ({
    current: null as null | {
      user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
    },
  }));
  vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mockSession.current) }));

  import { prisma } from "@/lib/db";
  import { POST as createPosition } from "@/app/api/positions/route";
  import { PATCH as patchPosition } from "@/app/api/positions/[positionId]/route";
  import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

  let f: Fixture;

  function jsonRequest(method: string, body: unknown): Request {
    return new Request("http://test/api/positions", {
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

  describe("POST /api/positions", () => {
    it("401s when signed out", async () => {
      const saved = mockSession.current;
      mockSession.current = null;
      const res = await createPosition(jsonRequest("POST", { name: "Bartender" }));
      expect(res.status).toBe(401);
      mockSession.current = saved;
    });

    it("creates a position with the next sortOrder", async () => {
      const res = await createPosition(jsonRequest("POST", { name: "Bartender" }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.position.name).toBe("Bartender");
      expect(body.data.position.sortOrder).toBe(2); // after Server(0), Dishwasher(1)
      expect(body.data.position.archivedAt).toBeNull();
    });

    it("409s on a case-insensitive duplicate name", async () => {
      const res = await createPosition(jsonRequest("POST", { name: "  server  " }));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("name_taken");
    });

    it("400s on an empty name", async () => {
      const res = await createPosition(jsonRequest("POST", { name: "   " }));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_input");
    });
  });

  describe("PATCH /api/positions/[positionId]", () => {
    it("renames a position", async () => {
      const created = await prisma.position.create({
        data: { locationId: f.locationId, name: "Runner", sortOrder: 50 },
      });
      const res = await patchPosition(
        jsonRequest("PATCH", { name: "Food runner" }),
        { params: Promise.resolve({ positionId: created.id }) },
      );
      expect(res.status).toBe(200);
      expect((await res.json()).data.position.name).toBe("Food runner");
    });

    it("409s renaming onto another active position's name (case-insensitive)", async () => {
      const created = await prisma.position.create({
        data: { locationId: f.locationId, name: "Expeditor", sortOrder: 51 },
      });
      const res = await patchPosition(
        jsonRequest("PATCH", { name: "SERVER" }),
        { params: Promise.resolve({ positionId: created.id }) },
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("name_taken");
    });

    it("allows renaming a position to its own name unchanged", async () => {
      const created = await prisma.position.create({
        data: { locationId: f.locationId, name: "Sommelier", sortOrder: 52 },
      });
      const res = await patchPosition(
        jsonRequest("PATCH", { name: "sommelier" }),
        { params: Promise.resolve({ positionId: created.id }) },
      );
      expect(res.status).toBe(200);
      expect((await res.json()).data.position.name).toBe("sommelier");
    });

    it("archives a position (sets archivedAt) and unarchives it (clears it)", async () => {
      const created = await prisma.position.create({
        data: { locationId: f.locationId, name: "Busser", sortOrder: 53 },
      });
      const archiveRes = await patchPosition(
        jsonRequest("PATCH", { archived: true }),
        { params: Promise.resolve({ positionId: created.id }) },
      );
      expect((await archiveRes.json()).data.position.archivedAt).not.toBeNull();

      const unarchiveRes = await patchPosition(
        jsonRequest("PATCH", { archived: false }),
        { params: Promise.resolve({ positionId: created.id }) },
      );
      expect((await unarchiveRes.json()).data.position.archivedAt).toBeNull();
    });

    it("404s for a position at another location (tenancy)", async () => {
      const other = await createFixture();
      try {
        const res = await patchPosition(
          jsonRequest("PATCH", { name: "Nope" }),
          { params: Promise.resolve({ positionId: other.positionIds.server }) },
        );
        expect(res.status).toBe(404);
      } finally {
        await destroyFixture(other);
      }
    });
  });
  ```

- [ ] 3.2 — Run it: `npm test -- src/tests/positions-api.test.ts`. Expected FAIL (`Cannot find module '@/app/api/positions/route'`).

- [ ] 3.3 — Create `src/app/api/positions/route.ts`:
  ```ts
  import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
  import { prisma } from "@/lib/db";
  import { requireManagerForApi } from "@/lib/manager-guard";
  import { assertNameAvailable, nextSortOrder } from "@/lib/position-data";
  import { createPositionSchema } from "@/lib/position-schemas";

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
      const parsed = createPositionSchema.safeParse(raw);
      if (!parsed.success) {
        return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
      }
      const name = parsed.data.name;

      await assertNameAvailable(guard.location.id, name); // throws ApiError(409) on collision
      const position = await prisma.position.create({
        data: {
          locationId: guard.location.id,
          name,
          sortOrder: await nextSortOrder(guard.location.id),
        },
        select: { id: true, name: true, sortOrder: true, archivedAt: true },
      });
      return jsonOk({ position }, 201);
    } catch (err) {
      return handleApiError(err);
    }
  }
  ```

- [ ] 3.4 — Create `src/app/api/positions/[positionId]/route.ts`:
  ```ts
  import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
  import { prisma } from "@/lib/db";
  import { requireManagerForApi } from "@/lib/manager-guard";
  import { assertNameAvailable } from "@/lib/position-data";
  import { updatePositionSchema } from "@/lib/position-schemas";

  export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ positionId: string }> },
  ) {
    try {
      const guard = await requireManagerForApi();
      if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
      const { positionId } = await params;

      const existing = await prisma.position.findFirst({
        where: { id: positionId, locationId: guard.location.id },
      });
      if (!existing) return jsonErr("not_found", "That position no longer exists", 404);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return jsonErr("invalid_input", "Request body must be JSON", 400);
      }
      const parsed = updatePositionSchema.safeParse(raw);
      if (!parsed.success) {
        return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
      }
      const input = parsed.data;

      const data: { name?: string; archivedAt?: Date | null } = {};
      if (input.name !== undefined) {
        await assertNameAvailable(guard.location.id, input.name, { excludeId: positionId });
        data.name = input.name;
      }
      if (input.archived !== undefined) {
        data.archivedAt = input.archived ? new Date() : null;
      }

      const position = await prisma.position.update({
        where: { id: positionId },
        data,
        select: { id: true, name: true, sortOrder: true, archivedAt: true },
      });
      return jsonOk({ position });
    } catch (err) {
      return handleApiError(err);
    }
  }
  ```

- [ ] 3.5 — Run it: `npm test -- src/tests/positions-api.test.ts`. Expected PASS (all POST + PATCH assertions green).

- [ ] 3.6 — Commit: `git add src/app/api/positions/route.ts "src/app/api/positions/[positionId]/route.ts" src/tests/positions-api.test.ts && git commit -m "feat: POST /api/positions + PATCH /api/positions/[positionId] (create/rename/archive)"`.

---

## Task 4 — `PATCH /api/positions/reorder` (bulk sortOrder)

**Files:**
- Create: `src/app/api/positions/reorder/route.ts`
- Test: append a `describe` block to `src/tests/positions-api.test.ts`

**Interfaces:**
- Consumes: `requireManagerForApi`; `handleApiError`, `jsonErr`, `jsonOk`; `reorderPositionsSchema` (`@/lib/position-schemas`); `prisma`.
- Produces: `PATCH /api/positions/reorder` — body `{ orderedIds: string[] }` → assigns `sortOrder = index` to each id in one `prisma.$transaction`; validates every id belongs to `guard.location.id` (403 `forbidden` otherwise); returns `jsonOk({ positions: { id, sortOrder }[] })` in the new order.

**Steps:**

- [ ] 4.1 — Append the failing test to `src/tests/positions-api.test.ts`. First add the import near the other route imports at the top of the file:
  ```ts
  import { PATCH as reorderPositions } from "@/app/api/positions/reorder/route";
  ```
  Then add a new `describe` block at the end of the file:
  ```ts
  describe("PATCH /api/positions/reorder", () => {
    function reorderRequest(body: unknown): Request {
      return new Request("http://test/api/positions/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("assigns sortOrder by index across the passed ids", async () => {
      const a = await prisma.position.create({ data: { locationId: f.locationId, name: "Reorder A", sortOrder: 60 } });
      const b = await prisma.position.create({ data: { locationId: f.locationId, name: "Reorder B", sortOrder: 61 } });
      const c = await prisma.position.create({ data: { locationId: f.locationId, name: "Reorder C", sortOrder: 62 } });

      const res = await reorderPositions(reorderRequest({ orderedIds: [c.id, a.id, b.id] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);

      const rows = await prisma.position.findMany({
        where: { id: { in: [a.id, b.id, c.id] } },
      });
      const byId = new Map(rows.map((r) => [r.id, r.sortOrder]));
      expect(byId.get(c.id)).toBe(0);
      expect(byId.get(a.id)).toBe(1);
      expect(byId.get(b.id)).toBe(2);
    });

    it("403s when an id belongs to another location (tenancy)", async () => {
      const other = await createFixture();
      try {
        const mine = await prisma.position.create({ data: { locationId: f.locationId, name: "Mine reorder", sortOrder: 70 } });
        const res = await reorderPositions(reorderRequest({ orderedIds: [mine.id, other.positionIds.server] }));
        expect(res.status).toBe(403);
        expect((await res.json()).error.code).toBe("forbidden");
      } finally {
        await destroyFixture(other);
      }
    });

    it("400s on an empty orderedIds array", async () => {
      const res = await reorderPositions(reorderRequest({ orderedIds: [] }));
      expect(res.status).toBe(400);
    });
  });
  ```

- [ ] 4.2 — Run it: `npm test -- src/tests/positions-api.test.ts`. Expected FAIL (`Cannot find module '@/app/api/positions/reorder/route'`).

- [ ] 4.3 — Create `src/app/api/positions/reorder/route.ts`:
  ```ts
  import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
  import { prisma } from "@/lib/db";
  import { requireManagerForApi } from "@/lib/manager-guard";
  import { reorderPositionsSchema } from "@/lib/position-schemas";

  export async function PATCH(req: Request) {
    try {
      const guard = await requireManagerForApi();
      if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return jsonErr("invalid_input", "Request body must be JSON", 400);
      }
      const parsed = reorderPositionsSchema.safeParse(raw);
      if (!parsed.success) {
        return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
      }
      const { orderedIds } = parsed.data;

      // Every id must belong to this location; anything else is a tenancy break.
      const owned = await prisma.position.findMany({
        where: { id: { in: orderedIds }, locationId: guard.location.id },
        select: { id: true },
      });
      if (owned.length !== orderedIds.length) {
        return jsonErr("forbidden", "Those positions aren't all at this location", 403);
      }

      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.position.update({ where: { id }, data: { sortOrder: index } }),
        ),
      );

      return jsonOk({ positions: orderedIds.map((id, index) => ({ id, sortOrder: index })) });
    } catch (err) {
      return handleApiError(err);
    }
  }
  ```

- [ ] 4.4 — Run it: `npm test -- src/tests/positions-api.test.ts`. Expected PASS (reorder assertions + all earlier blocks still green).

- [ ] 4.5 — Commit: `git add src/app/api/positions/reorder/route.ts src/tests/positions-api.test.ts && git commit -m "feat: PATCH /api/positions/reorder assigns sortOrder in one transaction"`.

---

## Task 5 — Make new-scheduling reads archive-aware + fix `getScheduleWeekData` grid rows

**Files:**
- Modify: `src/lib/schedule-data.ts` (`getScheduleWeekData` positions query + grid-row union)
- Modify: `src/app/manager/team/page.tsx` (positions picker)
- Modify: `src/app/manager/templates/[templateId]/page.tsx` (template editor positions)
- Test: `src/tests/positions-scheduling.test.ts`

**Interfaces:**
- Consumes: existing `getScheduleWeekData(locationId, weekStart)` returning `ScheduleWeekData` with `positions: { id: string; name: string }[]` and `shifts: ScheduleShift[]` (each shift has `positionId` + `positionName`).
- Produces (unchanged public shapes): `ScheduleWeekData.positions` now = **active positions ∪ positions referenced by this week's shifts**, still `{ id, name }[]`, still ordered by `sortOrder asc`. The three picker queries now exclude archived positions (`archivedAt: null`).

**Context — the 3 new-scheduling picker queries to make archive-aware** (verbatim current lines):
- `src/lib/schedule-data.ts:115` — `prisma.position.findMany({ where: { locationId }, orderBy: { sortOrder: "asc" } })` (inside `getScheduleWeekData`).
- `src/app/manager/team/page.tsx:17` — `prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } })`.
- `src/app/manager/templates/[templateId]/page.tsx:15` — `prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } })`.

> Note: `src/lib/template-data.ts:79` (`assertPositionsAtLocation`) validates ids the manager *already picked* against existing rows and must **not** get `archivedAt: null` — validation of already-referenced positions stays archive-agnostic. Leave it untouched.

**Steps:**

- [ ] 5.1 — Write the failing test `src/tests/positions-scheduling.test.ts`:
  ```ts
  import "dotenv/config";
  import { afterAll, beforeAll, describe, expect, it } from "vitest";

  import { prisma } from "@/lib/db";
  import { getScheduleWeekData } from "@/lib/schedule-data";
  import { createFixture, createShift, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";
  import { weekStartOfISO } from "@/lib/time";

  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  describe("getScheduleWeekData archive-awareness", () => {
    it("omits an archived position with NO shift this week from the grid rows", async () => {
      const lonely = await prisma.position.create({
        data: { locationId: f.locationId, name: "Lonely archived", sortOrder: 80, archivedAt: new Date() },
      });
      const weekStart = weekStartOfISO(isoDateFromNow(0, f.timezone));
      const data = await getScheduleWeekData(f.locationId, weekStart);
      expect(data.positions.some((p) => p.id === lonely.id)).toBe(false);
      // Active fixture positions still present.
      expect(data.positions.some((p) => p.id === f.positionIds.server)).toBe(true);
    });

    it("KEEPS an archived position that has a shift in the viewed week", async () => {
      const archivedWithShift = await prisma.position.create({
        data: { locationId: f.locationId, name: "Archived with shift", sortOrder: 81 },
      });
      const shift = await createShift(f, {
        positionId: archivedWithShift.id,
        employeeProfileId: null,
        daysFromNow: 0,
        startHour: 9,
        endHour: 17,
      });
      // Archive AFTER the shift exists — mirrors real archive-of-used-role.
      await prisma.position.update({ where: { id: archivedWithShift.id }, data: { archivedAt: new Date() } });

      const weekStart = weekStartOfISO(isoDateFromNow(0, f.timezone));
      const data = await getScheduleWeekData(f.locationId, weekStart);
      expect(data.positions.some((p) => p.id === archivedWithShift.id)).toBe(true);

      await prisma.shift.delete({ where: { id: shift.id } });
    });

    it("keeps grid rows ordered by sortOrder asc after the union", async () => {
      const data = await getScheduleWeekData(f.locationId, weekStartOfISO(isoDateFromNow(0, f.timezone)));
      const orders = data.positions
        .map((p) => p.id)
        .map((id) => data.positions.findIndex((q) => q.id === id));
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });
  });
  ```

- [ ] 5.2 — Run it: `npm test -- src/tests/positions-scheduling.test.ts`. Expected FAIL (the archived-with-no-shift assertion fails: current `getScheduleWeekData` returns ALL positions regardless of `archivedAt`).

- [ ] 5.3 — Edit `getScheduleWeekData` in `src/lib/schedule-data.ts`. Change the positions query (line ~115) to fetch only active positions:
  - Replace:
    ```ts
    prisma.position.findMany({ where: { locationId }, orderBy: { sortOrder: "asc" } }),
    ```
    with:
    ```ts
    prisma.position.findMany({ where: { locationId, archivedAt: null }, orderBy: { sortOrder: "asc" } }),
    ```

- [ ] 5.4 — In the same function, replace the final `positions:` line in the returned object (currently `positions: positions.map((p) => ({ id: p.id, name: p.name })),`) with a union of active positions and positions referenced by this week's shifts, preserving `sortOrder asc`. Insert this block **after** the `const annotated = shifts.map(...)` computation and **before** the `return {` (so it can read both `positions` and `shifts`):
  ```ts
    // Grid rows = active positions ∪ positions referenced by this week's shifts,
    // so an archived role that still has a shift this week keeps rendering.
    const gridPositions = new Map<string, { id: string; name: string; sortOrder: number }>();
    for (const p of positions) {
      gridPositions.set(p.id, { id: p.id, name: p.name, sortOrder: p.sortOrder });
    }
    for (const s of shifts) {
      if (!gridPositions.has(s.positionId)) {
        gridPositions.set(s.positionId, {
          id: s.positionId,
          name: s.position.name,
          sortOrder: s.position.sortOrder,
        });
      }
    }
    const orderedGridPositions = [...gridPositions.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ id: p.id, name: p.name }));
  ```
  Then change the return object's `positions:` line from:
  ```ts
    positions: positions.map((p) => ({ id: p.id, name: p.name })),
  ```
  to:
  ```ts
    positions: orderedGridPositions,
  ```
  (The `shifts.findMany` include already has `position: true`, so `s.position.name` and `s.position.sortOrder` are available; `ShiftWithJoins` includes the full `Position` row.)

- [ ] 5.5 — Make the team page picker archive-aware. In `src/app/manager/team/page.tsx`, change (line ~17):
  ```ts
    prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } }),
  ```
  to:
  ```ts
    prisma.position.findMany({ where: { locationId: location.id, archivedAt: null }, orderBy: { sortOrder: "asc" } }),
  ```

- [ ] 5.6 — Make the template editor picker archive-aware. In `src/app/manager/templates/[templateId]/page.tsx`, change (line ~15):
  ```ts
    prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } }),
  ```
  to:
  ```ts
    prisma.position.findMany({ where: { locationId: location.id, archivedAt: null }, orderBy: { sortOrder: "asc" } }),
  ```
  > If Phase 1 has already relocated this file to `src/app/manager/settings/templates/[templateId]/page.tsx`, apply the identical edit there instead — the query line is unchanged by the move.

- [ ] 5.7 — Run it: `npm test -- src/tests/positions-scheduling.test.ts`. Expected PASS (archived-no-shift omitted; archived-with-shift kept; ordering preserved).

- [ ] 5.8 — Regression: `npm test -- src/tests/shifts-api.test.ts`. Expected PASS (the schedule GET tests still see `positions.length > 0`; seeded positions are all active).

- [ ] 5.9 — Commit: `git add src/lib/schedule-data.ts src/app/manager/team/page.tsx "src/app/manager/templates/[templateId]/page.tsx" src/tests/positions-scheduling.test.ts && git commit -m "feat: archive-aware position pickers + schedule grid = active ∪ this-week's-shift positions"`.

---

## Task 6 — Positions server page + data loader

**Files:**
- Create: `src/lib/queries/positions.ts` (list loader split by active/archived)
- Create: `src/app/manager/settings/positions/page.tsx` (server page)
- Test: `src/tests/positions-list.test.ts`

**Interfaces:**
- Produces:
  - `type PositionRow = { id: string; name: string; sortOrder: number; archived: boolean }`
  - `getPositionsForSettings(locationId: string): Promise<{ active: PositionRow[]; archived: PositionRow[] }>` — active sorted by `sortOrder asc`, archived sorted by `name asc`.
  - Default export: an async server page rendering `<PositionsView active={…} archived={…} />` (component built in Task 7).
- Consumes: `requireManager` (`@/lib/auth`), `getManagerLocation` (`@/lib/authz`), `prisma` (`@/lib/db`), `PositionsView` (Task 7).

**Steps:**

- [ ] 6.1 — Write the failing test `src/tests/positions-list.test.ts`:
  ```ts
  import "dotenv/config";
  import { afterAll, beforeAll, describe, expect, it } from "vitest";

  import { prisma } from "@/lib/db";
  import { getPositionsForSettings } from "@/lib/queries/positions";
  import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  describe("getPositionsForSettings", () => {
    it("splits active (sortOrder asc) from archived (name asc)", async () => {
      // Fixture actives: Server(0), Dishwasher(1).
      const zed = await prisma.position.create({
        data: { locationId: f.locationId, name: "Zeta", sortOrder: 5, archivedAt: new Date() },
      });
      const alp = await prisma.position.create({
        data: { locationId: f.locationId, name: "Alpha", sortOrder: 6, archivedAt: new Date() },
      });

      const { active, archived } = await getPositionsForSettings(f.locationId);

      expect(active.map((p) => p.name)).toEqual(["Server", "Dishwasher"]);
      expect(active.every((p) => p.archived === false)).toBe(true);
      expect(archived.map((p) => p.name)).toEqual(["Alpha", "Zeta"]); // name asc
      expect(archived.every((p) => p.archived === true)).toBe(true);

      await prisma.position.deleteMany({ where: { id: { in: [zed.id, alp.id] } } });
    });
  });
  ```

- [ ] 6.2 — Run it: `npm test -- src/tests/positions-list.test.ts`. Expected FAIL (`Cannot find module '@/lib/queries/positions'`).

- [ ] 6.3 — Create `src/lib/queries/positions.ts`:
  ```ts
  import { prisma } from "@/lib/db";

  export type PositionRow = {
    id: string;
    name: string;
    sortOrder: number;
    archived: boolean;
  };

  /** Active positions (sortOrder asc) and archived positions (name asc). */
  export async function getPositionsForSettings(
    locationId: string,
  ): Promise<{ active: PositionRow[]; archived: PositionRow[] }> {
    const rows = await prisma.position.findMany({
      where: { locationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true, archivedAt: true },
    });
    const active: PositionRow[] = [];
    const archived: PositionRow[] = [];
    for (const r of rows) {
      const row: PositionRow = {
        id: r.id,
        name: r.name,
        sortOrder: r.sortOrder,
        archived: r.archivedAt !== null,
      };
      if (r.archivedAt === null) active.push(row);
      else archived.push(row);
    }
    archived.sort((a, b) => a.name.localeCompare(b.name));
    return { active, archived };
  }
  ```

- [ ] 6.4 — Run it: `npm test -- src/tests/positions-list.test.ts`. Expected PASS.

- [ ] 6.5 — Create `src/app/manager/settings/positions/page.tsx` (server page; `PositionsView` lands in Task 7). Write it now so the import target is fixed; Task 7 creates the component:
  ```tsx
  import type { Metadata } from "next";
  import { requireManager } from "@/lib/auth";
  import { getManagerLocation } from "@/lib/authz";
  import { getPositionsForSettings } from "@/lib/queries/positions";
  import { PositionsView } from "@/components/manager/PositionsView";

  export const metadata: Metadata = { title: "Positions — RosterHouse" };

  export default async function PositionsSettingsPage() {
    const user = await requireManager();
    const location = await getManagerLocation(user.id);
    const { active, archived } = await getPositionsForSettings(location.id);
    return <PositionsView active={active} archived={archived} />;
  }
  ```

- [ ] 6.6 — Commit: `git add src/lib/queries/positions.ts src/app/manager/settings/positions/page.tsx src/tests/positions-list.test.ts && git commit -m "feat: positions settings data loader + server page"`.

> The page will not typecheck/build until Task 7 creates `PositionsView`. That is expected — the two tasks land together. Do not run `next build` between Task 6 and Task 7.

---

## Task 7 — `PositionsView` client component (add / rename / reorder / archive / unarchive)

**Files:**
- Create: `src/components/manager/PositionsView.tsx`
- Create: `src/components/manager/PositionsView.module.css`
- Test: `src/components/manager/PositionsView.test.tsx`

**Interfaces:**
- Consumes:
  - `PositionRow` (`@/lib/queries/positions`) — `{ id, name, sortOrder, archived }`.
  - `useRouter` (`next/navigation`), `useToast` (`@/components/ui/Toaster`).
  - `Button`, `Input`, `EmptyState`, `Icon`, `Badge` (`@/components/ui/*`).
  - Endpoints from Tasks 3-4: `POST /api/positions`, `PATCH /api/positions/[id]`, `PATCH /api/positions/reorder`.
- Produces: `export function PositionsView({ active, archived }: { active: PositionRow[]; archived: PositionRow[] })`. On every successful mutation it calls `router.refresh()`.
- Reorder wire format: **move up** on index `i` sends `orderedIds` with items `i-1` and `i` swapped; **move down** swaps `i` and `i+1`. The whole active list's ids are sent so `sortOrder = index` stays dense.

**Steps:**

- [ ] 7.1 — Write the failing test `src/components/manager/PositionsView.test.tsx`:
  ```tsx
  // @vitest-environment jsdom
  import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

  const refreshMock = vi.fn();
  vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
  }));
  vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

  import { PositionsView } from "@/components/manager/PositionsView";
  import type { PositionRow } from "@/lib/queries/positions";

  const active: PositionRow[] = [
    { id: "p-server", name: "Server", sortOrder: 0, archived: false },
    { id: "p-cook", name: "Line cook", sortOrder: 1, archived: false },
    { id: "p-host", name: "Host", sortOrder: 2, archived: false },
  ];
  const archived: PositionRow[] = [
    { id: "p-busser", name: "Busser", sortOrder: 9, archived: true },
  ];

  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    refreshMock.mockClear();
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, data: { position: { id: "new", name: "New", sortOrder: 3, archivedAt: null } } }), {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  describe("PositionsView", () => {
    it("lists active positions and the archived section", () => {
      render(<PositionsView active={active} archived={archived} />);
      expect(screen.getByText("Server")).toBeInTheDocument();
      expect(screen.getByText("Line cook")).toBeInTheDocument();
      // Archived section header shows the count.
      expect(screen.getByText(/Archived \(1\)/)).toBeInTheDocument();
    });

    it("POSTs a new position name", async () => {
      render(<PositionsView active={active} archived={archived} />);
      fireEvent.change(screen.getByPlaceholderText("Add a position"), { target: { value: "Bartender" } });
      fireEvent.click(screen.getByText("Add"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/positions");
      expect((init as RequestInit).method).toBe("POST");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Bartender" });
      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    });

    it("does not POST an empty name", async () => {
      render(<PositionsView active={active} archived={archived} />);
      fireEvent.click(screen.getByText("Add"));
      await new Promise((r) => setTimeout(r, 30));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("moving Line cook up reorders via /api/positions/reorder with swapped ids", async () => {
      render(<PositionsView active={active} archived={archived} />);
      // Line cook is index 1; its up-button swaps it with Server (index 0).
      fireEvent.click(screen.getByLabelText("Move Line cook up"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/positions/reorder");
      expect((init as RequestInit).method).toBe("PATCH");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        orderedIds: ["p-cook", "p-server", "p-host"],
      });
    });

    it("disables Move up on the first row and Move down on the last row", () => {
      render(<PositionsView active={active} archived={archived} />);
      expect(screen.getByLabelText("Move Server up")).toBeDisabled();
      expect(screen.getByLabelText("Move Host down")).toBeDisabled();
    });

    it("archives an active position via PATCH { archived: true }", async () => {
      render(<PositionsView active={active} archived={archived} />);
      fireEvent.click(screen.getByLabelText("Archive Host"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/positions/p-host");
      expect((init as RequestInit).method).toBe("PATCH");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ archived: true });
    });

    it("unarchives via PATCH { archived: false }", async () => {
      render(<PositionsView active={active} archived={archived} />);
      fireEvent.click(screen.getByText("Unarchive"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/positions/p-busser");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ archived: false });
    });

    it("renames via PATCH { name } from the rename input", async () => {
      render(<PositionsView active={active} archived={archived} />);
      fireEvent.click(screen.getByLabelText("Rename Server"));
      // A rename input appears seeded with the current name.
      const renameInput = screen.getByDisplayValue("Server");
      fireEvent.change(renameInput, { target: { value: "Waiter" } });
      fireEvent.click(screen.getByText("Save"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/positions/p-server");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Waiter" });
    });
  });
  ```

- [ ] 7.2 — Run it: `npm test -- src/components/manager/PositionsView.test.tsx`. Expected FAIL (`Cannot find module '@/components/manager/PositionsView'`).

- [ ] 7.3 — Create `src/components/manager/PositionsView.module.css`:
  ```css
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    font-family: var(--font-sans);
    max-width: 640px;
  }

  .title {
    font-size: var(--text-h1-size);
    font-weight: var(--text-h1-weight);
    color: var(--text-primary);
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .addRow {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .addInput {
    flex: 1;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-card, var(--surface-page));
  }

  .rowArchived {
    opacity: 0.75;
  }

  .name {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .renameField {
    flex: 1;
  }

  .reorder {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .iconBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-page);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .iconBtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .rowActions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .archivedToggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .sectionLabel {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-tertiary);
    margin-top: var(--space-4);
  }
  ```

- [ ] 7.4 — Create `src/components/manager/PositionsView.tsx`:
  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { Button } from "@/components/ui/Button";
  import { Input } from "@/components/ui/Input";
  import { EmptyState } from "@/components/ui/EmptyState";
  import { Icon } from "@/components/ui/Icon";
  import { Badge } from "@/components/ui/Badge";
  import { useToast } from "@/components/ui/Toaster";
  import type { PositionRow } from "@/lib/queries/positions";
  import styles from "./PositionsView.module.css";

  type PositionsViewProps = {
    active: PositionRow[];
    archived: PositionRow[];
  };

  async function callJson(url: string, method: string, body: unknown): Promise<void> {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = await res.json();
    if (!parsed.ok) throw new Error(parsed.error?.message ?? "Something went wrong");
  }

  export function PositionsView({ active, archived }: PositionsViewProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [newName, setNewName] = useState("");
    const [addError, setAddError] = useState<string | undefined>(undefined);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renameError, setRenameError] = useState<string | undefined>(undefined);
    const [showArchived, setShowArchived] = useState(false);
    const [busy, setBusy] = useState(false);

    async function run(fn: () => Promise<void>, failTitle: string) {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        router.refresh();
      } catch (err) {
        toast({
          tone: "danger",
          title: failTitle,
          description: err instanceof Error ? err.message : "Try again.",
        });
      } finally {
        setBusy(false);
      }
    }

    async function addPosition() {
      const trimmed = newName.trim();
      if (!trimmed) {
        setAddError("Name your position");
        return;
      }
      setAddError(undefined);
      await run(async () => {
        await callJson("/api/positions", "POST", { name: trimmed });
        setNewName("");
        toast({ tone: "success", title: "Position added" });
      }, "Couldn't add position");
    }

    function reorder(ids: string[]) {
      return run(async () => {
        await callJson("/api/positions/reorder", "PATCH", { orderedIds: ids });
      }, "Couldn't reorder");
    }

    function move(index: number, delta: -1 | 1) {
      const ids = active.map((p) => p.id);
      const swapWith = index + delta;
      if (swapWith < 0 || swapWith >= ids.length) return;
      [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
      void reorder(ids);
    }

    function archive(id: string, archivedNext: boolean) {
      return run(async () => {
        await callJson(`/api/positions/${id}`, "PATCH", { archived: archivedNext });
        toast({ tone: "success", title: archivedNext ? "Position archived" : "Position restored" });
      }, archivedNext ? "Couldn't archive" : "Couldn't restore");
    }

    function startRename(row: PositionRow) {
      setRenamingId(row.id);
      setRenameValue(row.name);
      setRenameError(undefined);
    }

    async function saveRename(id: string) {
      const trimmed = renameValue.trim();
      if (!trimmed) {
        setRenameError("Name your position");
        return;
      }
      await run(async () => {
        await callJson(`/api/positions/${id}`, "PATCH", { name: trimmed });
        setRenamingId(null);
        toast({ tone: "success", title: "Position renamed" });
      }, "Couldn't rename");
    }

    return (
      <div className={styles.page}>
        <div>
          <h1 className={styles.title}>Positions</h1>
          <div className={styles.subtitle}>
            The roles you schedule for. Archived roles stay on past shifts but disappear from new scheduling.
          </div>
        </div>

        <div className={styles.addRow}>
          <Input
            className={styles.addInput}
            placeholder="Add a position"
            aria-label="New position name"
            value={newName}
            error={addError}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addPosition();
            }}
          />
          <Button variant="primary" onClick={() => void addPosition()} disabled={busy}>
            Add
          </Button>
        </div>

        {active.length === 0 ? (
          <EmptyState title="No active positions" description="Add your first role above." />
        ) : (
          <div className={styles.list}>
            {active.map((row, index) => (
              <div key={row.id} className={styles.row}>
                <div className={styles.reorder}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`Move ${row.name} up`}
                    disabled={index === 0 || busy}
                    onClick={() => move(index, -1)}
                  >
                    <Icon name="chevron-up" size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`Move ${row.name} down`}
                    disabled={index === active.length - 1 || busy}
                    onClick={() => move(index, 1)}
                  >
                    <Icon name="chevron-down" size={14} />
                  </button>
                </div>

                {renamingId === row.id ? (
                  <>
                    <Input
                      className={styles.renameField}
                      aria-label={`New name for ${row.name}`}
                      value={renameValue}
                      error={renameError}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveRename(row.id);
                      }}
                    />
                    <div className={styles.rowActions}>
                      <Button variant="primary" size="sm" onClick={() => void saveRename(row.id)} disabled={busy}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={styles.name}>{row.name}</span>
                    <div className={styles.rowActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Rename ${row.name}`}
                        onClick={() => startRename(row)}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Archive ${row.name}`}
                        onClick={() => void archive(row.id, true)}
                        disabled={busy}
                      >
                        Archive
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div>
            <button
              type="button"
              className={styles.archivedToggle}
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              <Icon name={showArchived ? "chevron-down" : "chevron-right"} size={16} />
              Archived ({archived.length})
            </button>
            {showArchived && (
              <div className={styles.list} style={{ marginTop: "8px" }}>
                {archived.map((row) => (
                  <div key={row.id} className={`${styles.row} ${styles.rowArchived}`}>
                    <span className={styles.name}>{row.name}</span>
                    <Badge tone="neutral">Archived</Badge>
                    <div className={styles.rowActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void archive(row.id, false)}
                        disabled={busy}
                      >
                        Unarchive
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] 7.5 — Register the two new glyphs used above (`chevron-up`, and confirm `chevron-right`/`chevron-down` exist). `chevron-down`, `chevron-left`, `chevron-right` are already in `src/components/ui/Icon.tsx`; **`chevron-up` is not**. Add it. In `src/components/ui/Icon.tsx`, add `ChevronUp` to the lucide import list (keep alphabetical grouping near the other chevrons):
  - In the import block, add `ChevronUp,` right after `ChevronRight,`:
    ```ts
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    ```
  - In the `ICONS` map, add `"chevron-up": ChevronUp,` right after `"chevron-right": ChevronRight,`:
    ```ts
    "chevron-right": ChevronRight,
    "chevron-up": ChevronUp,
    clock: Clock,
    ```

- [ ] 7.6 — Run it: `npm test -- src/components/manager/PositionsView.test.tsx`. Expected PASS (all 8 assertions green).

- [ ] 7.7 — Typecheck the page + component wire up: `npx tsc --noEmit`. Expected PASS (Task 6's page now resolves `PositionsView`; `PositionRow` matches).

- [ ] 7.8 — Commit: `git add src/components/manager/PositionsView.tsx src/components/manager/PositionsView.module.css src/components/manager/PositionsView.test.tsx src/components/ui/Icon.tsx && git commit -m "feat: PositionsView (add/rename/reorder/archive/unarchive) + chevron-up icon"`.

---

## Task 8 — Full-suite regression + build

**Files:** none (verification only).

**Interfaces:** none.

**Steps:**

- [ ] 8.1 — Run the whole test suite: `npm test`. Expected PASS (the four new files — `position-data`, `positions-api`, `positions-scheduling`, `positions-list`, `PositionsView` — plus every pre-existing test, including `shifts-api.test.ts` and `template-api.test.ts`, stay green).

- [ ] 8.2 — Typecheck: `npx tsc --noEmit`. Expected PASS.

- [ ] 8.3 — Production build (catches App-Router route/type issues the unit tests miss): `npm run build`. Expected PASS. If Phase 1's `src/app/manager/settings/layout.tsx` does not yet exist, the `settings/positions/page.tsx` route still builds standalone under the existing manager layout.

- [ ] 8.4 — Commit any incidental formatting only if the build/format step changed files: `git add -A && git commit -m "test: full positions phase-2 regression green"` (skip if nothing changed).

---

## Assumptions made

1. **Phase 1 not yet on disk.** At authoring time there is no `src/app/manager/settings/` directory and no positions stub. The plan therefore *creates* `src/app/manager/settings/positions/page.tsx` in full (Task 6) rather than editing a stub, and treats the Phase-1 settings sub-nav/layout as a soft prerequisite (stated in Global Constraints). The page renders correctly inside the existing `src/app/manager/layout.tsx` sidebar shell even without Phase 1.
2. **Test isolation via `createFixture()`.** Following `template-api.test.ts` (not the seed-dependent `shifts-api.test.ts`), all new DB tests build their own throwaway org so they never depend on `npx prisma db seed` having run. `createFixture` already seeds two active positions (Server sortOrder 0, Dishwasher sortOrder 1) and exposes `f.positionIds.server` / `f.positionIds.dishwasher`.
3. **`ShiftWithJoins` exposes the full `Position` row.** `getScheduleWeekData`'s shift query uses `include: { position: true }`, so `s.position.name` and `s.position.sortOrder` are available for the grid-row union without an extra query. Verified against `src/lib/schedule-data.ts` (`ShiftWithJoins` = `Prisma.ShiftGetPayload<{ include: { position: true; … } }>`).
4. **`assertPositionsAtLocation` (`src/lib/template-data.ts:79`) is deliberately left archive-agnostic.** It validates positions the manager *already referenced*, so archived-but-referenced ids must still validate; only the *picker* queries that offer *new* choices get `archivedAt: null`.
5. **Rename to the same name is allowed** (e.g. changing only case): `assertNameAvailable` excludes the row's own id. The case-sensitive DB `@@unique([locationId, name])` never fires here because we compare against active peers, not the DB constraint.
6. **Reorder sends the whole active list.** Move-up/down swaps two ids and PATCHes all active ids so `sortOrder = index` stays dense (no gaps). This mirrors the "assigns sortOrder by index in one transaction" spec wording.
7. **Archive frees the name.** `assertNameAvailable` only checks *active* peers, so a manager may add a new "Barback" after archiving an old "Barback". This matches Decision 2 ("Archived roles disappear from every new-scheduling picker") — the name is available for new scheduling. (The DB `@@unique([locationId, name])` still forbids two rows with the same exact-case name at the same location; if a same-name collision with an *archived* row is ever hit, the create throws Prisma `P2002` and surfaces via `handleApiError` as a 500 — acceptable for this phase since archived same-name reuse is an edge case; a follow-up could catch `P2002` → 409. Noted, not implemented, to avoid scope creep.)
