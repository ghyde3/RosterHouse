# RosterHouse Phase 2 — Auth & Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire authentication and multi-tenancy into RosterHouse: manager signup (org + location + positions bootstrap), phone-or-email login for both roles, invite creation/acceptance, team management, role-based middleware, and a coherent seed dataset.

**Architecture:** Auth.js v5 (`next-auth@beta`) Credentials provider with JWT sessions carrying `{id, name, role, organizationId}`; an edge-safe `auth.config.ts` consumed by `src/middleware.ts` for redirect rules while `auth.ts` adds the Prisma/bcrypt-backed provider. All mutations are `/api` route handlers that zod-validate → authenticate → tenancy-check → act → return the `{ok:true|false}` envelope. Pages are server components that read via `src/lib` helpers; interactivity lives in small client components built from Phase 1 primitives.

**Tech Stack:** Next.js 16.2 / React 19 / TypeScript · Prisma 7 + `@prisma/adapter-pg` (client in `src/generated/prisma`) · PostgreSQL 17 (docker) · `next-auth@beta` (Auth.js v5) · `bcryptjs` · `zod@4` · `date-fns@4` + `@date-fns/tz` (seed only in this phase) · `vitest` + `@testing-library/react` (set up in Phase 1).

## Global Constraints

These apply to **every** task below (copied from the roadmap; the executing engineer must re-read this section before each task):

- **Copy rules:** sentence case everywhere ("Invite employee", never "Invite Employee"); 12-hour times ("7:00 AM – 3:00 PM", en dash, never military); durations as "8 hrs"; no emoji in UI chrome; calm confirmations (no exclamation points); errors specific and actionable, never blaming.
- **Styling:** design tokens only — no raw hex colors; the only font is Figtree via `var(--font-sans)` (already set on `body`, so don't repeat `fontFamily` in inline styles). Focus states come from the Phase 1 primitives.
- **Real elements:** every interactive element is a real `<button>`/`<a>`/`<input>` with keyboard focus — never an onClick div (the export's dominant defect). Use the Phase 1 primitives, which are built this way.
- **Every screen ships loading, empty, and error states** (Next.js `loading.tsx`/`error.tsx` + explicit empty-state JSX).
- **Every API handler:** zod-validate input → authenticate → tenancy check → act → typed JSON envelope `{ ok: true, data }` / `{ ok: false, error: { code, message } }`.
- **Server code imports the Prisma client from `@/lib/db`** (never instantiate a new `PrismaClient` in app code); Prisma types import from `@/generated/prisma/client`.
- **Weeks start Monday.** `Location.timezone` (IANA) drives all wall-clock rendering.
- **Test-first (vitest).** Phase 1 set up vitest with the `@/` path alias and jsdom available; `npx vitest run <file>` works from the repo root. Integration tests run against the docker Postgres (`docker compose up -d` first) and must clean up every row they create.
- **Commit at the end of every task.** Working tree clean between tasks.
- The design export path contains spaces — always quote it: `"RosterHouse Design System"`.
- Prerequisites: Phase 1 complete (primitives + chrome + vitest), `docker compose up -d` running, `.env` has `DATABASE_URL`, init migration applied.

## Consumed component contract (from Phase 1)

Import primitives from `@/components/ui/<Name>` (named exports), chrome from `@/components/chrome/<Name>`. All primitives additionally accept `className?: string`, spread rest props, and forward refs. Prop shapes this plan relies on:

```ts
Button:  { variant?: "primary"|"secondary"|"ghost"|"accent"|"danger"; size?: "sm"|"md"|"lg";
           disabled?: boolean; icon?: ReactNode; fullWidth?: boolean; onClick?: () => void;
           type?: "button"|"submit"; children?: ReactNode }        // renders <button>
Input:   { label?: string; placeholder?: string; value?: string;
           onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string;
           error?: string; disabled?: boolean; icon?: ReactNode }
           // label is associated with the input (getByLabelText works); error renders visibly
Select:  { label?: string; value?: string; onChange?: (value: string) => void;
           options?: { value: string; label: string }[]; placeholder?: string }
Checkbox:{ label?: string; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }
Dialog:  { open: boolean; onClose?: () => void; title?: string; children?: ReactNode; footer?: ReactNode }
Card:    { children?: ReactNode; padding?: string; hoverable?: boolean; style?: CSSProperties }
Badge:   { tone?: "success"|"warning"|"danger"|"info"|"neutral"; children?: ReactNode }
Tag:     { children?: ReactNode; onRemove?: () => void; color?: "neutral"|"brand"|"accent" }
AvatarStatus: { name: string; status?: "available"|"unavailable"|"pending"|"off"; size?: number }
```

Net-new Phase 1 primitives this plan assumes (pinned here because the roadmap names but does not type them — **verify against Phase 1's plan before starting; if Phase 1 exported different shapes, adapt call sites, not the primitives**):

```ts
// @/components/ui/Toaster — exports ToasterProvider + useToast (there is no <Toaster /> export)
ToasterProvider: { children: ReactNode }   // context provider + bottom-right portal;
                                           // this plan wraps the /manager and /(employee) layouts with it (Task 5)
useToast(): { toast: (t: { title: string; description?: string; tone?: "success"|"warning"|"danger"|"info" }) => void }
// @/components/ui/EmptyState
EmptyState: { title: string; description?: string; action?: ReactNode }
// @/components/ui/Spinner
Spinner: { size?: number }
// @/components/chrome/ManagerSidebar — fixed 232px left rail; renders its own nav links
// (Dashboard /manager, Schedule /manager/schedule, Team /manager/team,
//  Availability /manager/availability, Time off /manager/time-off, Swaps /manager/swaps)
ManagerSidebar: { locationName: string; userName: string }   // userName feeds the initials avatar chip
// @/components/chrome/EmployeeTabBar — fixed bottom tab bar; renders its own links
// (Shifts /, Availability /availability, Clock /clock, Open shifts /swaps, Profile /profile)
EmployeeTabBar: { className?: string }     // no required props
```

## File structure

```
src/lib/api.ts                     envelope + ApiError + parseJson          (Task 1)
src/lib/phone.ts                   normalizePhone                           (Task 2)
src/lib/authz.ts                   password + tenancy + credential helpers  (Tasks 2–3)
src/lib/auth.config.ts             edge-safe Auth.js config                 (Task 4)
src/lib/auth.ts                    NextAuth + requireUser/requireManager    (Task 4)
src/types/next-auth.d.ts           session/JWT type augmentation            (Task 4)
src/app/api/auth/[...nextauth]/route.ts                                     (Task 4)
src/lib/routes.ts                  pure redirect rules                      (Task 5)
src/middleware.ts                  auth middleware                          (Task 5)
src/app/manager/layout.tsx + page.tsx        manager shell + placeholder    (Task 5)
src/app/(employee)/layout.tsx + page.tsx     employee shell + placeholder   (Task 5)
prisma/seed.ts + prisma.config.ts changes    Harbor & Vine demo data        (Task 6)
src/app/login/*  src/app/forgot-password/*                                  (Task 7)
src/app/signup/* + src/app/api/auth/signup/route.ts                         (Task 8)
src/lib/invites.ts + invite API routes                                      (Task 9)
src/app/invite/[token]/*                                                    (Task 10)
src/lib/team.ts + team API routes + src/app/manager/team/*                  (Task 11)
```

Task ↔ scope mapping: Task 1 = envelope helpers · Tasks 2–3 = authz · Task 4 = Auth.js · Task 5 = middleware · Task 6 = seed · Task 7 = login/forgot · Task 8 = signup wizard · Tasks 9–10 = invites · Task 11 = team · Task 12 = phase gate. Integration tests for signup and invite-accept transactions live inside Tasks 8 and 9 (test-first).

---

### Task 1: API envelope helpers (`src/lib/api.ts`)

**Files:**
- Create: `src/lib/api.ts`
- Test: `src/lib/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `zod@4` (already installed).
- Produces (every later task and phase consumes these):
  - `type ApiOk<T> = { ok: true; data: T }`
  - `type ApiErr = { ok: false; error: { code: string; message: string } }`
  - `jsonOk<T>(data: T, status = 200): Response`
  - `jsonErr(code: string, message: string, status: number): Response`
  - `class ApiError extends Error { status: number; code: string }` — constructor `(status, code, message)`
  - `handleApiError(err: unknown): Response` — maps `ApiError` to its status/code, anything else to 500 `internal`
  - `parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T; error?: undefined } | { data?: undefined; error: Response }>` — the zod parse helper; on failure `error` is a 400 `invalid_input` (or `invalid_json`) envelope response naming the first bad field

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/api.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ApiError, handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";

describe("jsonOk", () => {
  it("wraps data in the ok envelope with status 200", async () => {
    const res = jsonOk({ id: "abc" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: "abc" } });
  });

  it("accepts a custom status", () => {
    expect(jsonOk({ id: "abc" }, 201).status).toBe(201);
  });
});

describe("jsonErr", () => {
  it("wraps code and message in the error envelope", async () => {
    const res = jsonErr("not_found", "That location doesn't exist.", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "not_found", message: "That location doesn't exist." },
    });
  });
});

describe("parseJson", () => {
  const schema = z.object({ name: z.string().min(1, "Enter a name.") });

  function jsonRequest(body: unknown): Request {
    return new Request("http://test.local/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns parsed data for valid input", async () => {
    const result = await parseJson(jsonRequest({ name: "Maria" }), schema);
    expect(result.data).toEqual({ name: "Maria" });
    expect(result.error).toBeUndefined();
  });

  it("returns a 400 response naming the invalid field", async () => {
    const result = await parseJson(jsonRequest({ name: "" }), schema);
    expect(result.data).toBeUndefined();
    const res = result.error as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toBe("name: Enter a name.");
  });

  it("returns a 400 response for a non-JSON body", async () => {
    const req = new Request("http://test.local/api/x", { method: "POST", body: "not json" });
    const result = await parseJson(req, schema);
    const res = result.error as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_json");
  });
});

describe("handleApiError", () => {
  it("maps ApiError to its status and code", async () => {
    const res = handleApiError(new ApiError(403, "forbidden", "You don't have access to this location."));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toEqual({ code: "forbidden", message: "You don't have access to this location." });
  });

  it("maps unknown errors to a 500 internal error", async () => {
    const res = handleApiError(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/api.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/api"` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/api.ts`:

```ts
import { z } from "zod";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };

/** Throwable error that maps cleanly onto the JSON error envelope. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, status = 200): Response {
  const body: ApiOk<T> = { ok: true, data };
  return Response.json(body, { status });
}

export function jsonErr(code: string, message: string, status: number): Response {
  const body: ApiErr = { ok: false, error: { code, message } };
  return Response.json(body, { status });
}

/** Catch-all for route handlers: `catch (err) { return handleApiError(err); }` */
export function handleApiError(err: unknown): Response {
  if (err instanceof ApiError) return jsonErr(err.code, err.message, err.status);
  console.error(err);
  return jsonErr("internal", "Something went wrong on our end. Please try again.", 500);
}

/**
 * Parse and validate a JSON request body. Returns `{ data }` on success or
 * `{ error }` (a ready-to-return 400 Response) on failure.
 */
export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonErr("invalid_json", "The request body isn't valid JSON.", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    const message = path ? `${path}: ${issue.message}` : issue.message;
    return { error: jsonErr("invalid_input", message, 400) };
  }
  return { data: result.data };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/api.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/__tests__/api.test.ts
git commit -m "feat: add typed JSON API envelope helpers (jsonOk/jsonErr/parseJson)"
```

---

### Task 2: Password and phone helpers

**Files:**
- Create: `src/lib/phone.ts`
- Create: `src/lib/authz.ts` (password helpers only in this task; Task 3 completes the file)
- Test: `src/lib/__tests__/phone.test.ts`
- Test: `src/lib/__tests__/password.test.ts`
- Modify: `package.json` (bcryptjs dependency, via npm)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `normalizePhone(input: string): string | null` in `@/lib/phone` — E.164 (`"+15551234567"`) or `null` if unparseable. US 10-digit numbers get `+1`.
  - `hashPassword(plain: string): Promise<string>` in `@/lib/authz` — bcryptjs, 10 rounds (roadmap contract).
  - `verifyPassword(plain: string, hash: string): Promise<boolean>` in `@/lib/authz` (roadmap contract).

- [ ] **Step 1: Install bcryptjs**

```bash
npm install bcryptjs
```

Expected: `added 1 package` (bcryptjs v3 — promise-based API, no native compilation).

- [ ] **Step 2: Write the failing tests**

Create `src/lib/__tests__/phone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("normalizes a formatted US number to E.164", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("normalizes 11 digits starting with 1", () => {
    expect(normalizePhone("1 555 123 4567")).toBe("+15551234567");
  });

  it("keeps international numbers that start with +", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("returns null for anything unparseable", () => {
    expect(normalizePhone("hello")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
```

Create `src/lib/__tests__/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/authz";

describe("hashPassword / verifyPassword", () => {
  it("produces a bcrypt hash that does not contain the plain text", async () => {
    const hash = await hashPassword("rosterhouse1");
    expect(hash).not.toContain("rosterhouse1");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt marker
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("rosterhouse1");
    await expect(verifyPassword("rosterhouse1", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("rosterhouse1");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("salts: two hashes of the same password differ", async () => {
    const [a, b] = await Promise.all([hashPassword("rosterhouse1"), hashPassword("rosterhouse1")]);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/phone.test.ts src/lib/__tests__/password.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/phone"` and `"@/lib/authz"`.

- [ ] **Step 4: Write the implementations**

Create `src/lib/phone.ts`:

```ts
/**
 * Normalize user-entered phone numbers to E.164 (best-effort, US-first).
 * Returns null when the input can't be a phone number — callers must
 * surface a specific error, not store garbage.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}
```

Create `src/lib/authz.ts`:

```ts
import { compare, hash } from "bcryptjs";

/** bcryptjs, 10 rounds (roadmap contract). */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, hashValue: string): Promise<boolean> {
  return compare(plain, hashValue);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/phone.test.ts src/lib/__tests__/password.test.ts`
Expected: PASS (8 tests; the password suite takes ~1s because bcrypt is deliberately slow).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/phone.ts src/lib/authz.ts src/lib/__tests__/phone.test.ts src/lib/__tests__/password.test.ts
git commit -m "feat: add password hashing (bcryptjs, 10 rounds) and phone normalization"
```

---

### Task 3: Tenancy and credential helpers (`src/lib/authz.ts` complete)

**Files:**
- Modify: `src/lib/authz.ts` (replace with the full version below)
- Test: `src/lib/__tests__/authz.integration.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `ApiError` from `@/lib/api` (Task 1); `normalizePhone` from `@/lib/phone` (Task 2); Prisma types from `@/generated/prisma/client`.
- Produces (roadmap contract — Phases 3/4/5 consume these exact signatures):
  - `getManagerLocation(userId: string): Promise<Location>` — v1: the sole (oldest) location of the user's org; throws `ApiError(404, "no_location", …)` if none.
  - `getEmployeeProfile(userId: string): Promise<EmployeeProfile & { location: Location; primaryPosition: Position | null }>` — throws `ApiError(404, "no_profile", …)` if none.
  - `assertLocationMember(userId: string, locationId: string): Promise<void>` — resolves for managers of the location's org and for users with an `EmployeeProfile` at the location; otherwise throws `ApiError(403, "forbidden", "You don't have access to this location.")`.
  - `authenticateUser(identifier: string, password: string): Promise<User | null>` — NEW contract (not in roadmap): looks up by lowercased email when the identifier contains `@`, else by normalized phone; verifies password; `null` on any miss. `src/lib/auth.ts` (Task 4) consumes it.

- [ ] **Step 1: Make sure the database is up**

```bash
docker compose up -d && npx prisma migrate deploy
```

Expected: container healthy; `No pending migrations to apply.` (or migrations applied).

- [ ] **Step 2: Write the failing integration test**

Create `src/lib/__tests__/authz.integration.test.ts` (note: `import "dotenv/config"` must be the FIRST import so `DATABASE_URL` is set before `@/lib/db` constructs the client):

```ts
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertLocationMember,
  authenticateUser,
  getEmployeeProfile,
  getManagerLocation,
  hashPassword,
} from "@/lib/authz";

const suffix = `authz-${Date.now()}`;
const MANAGER_EMAIL = `manager-${suffix}@test.local`;
const EMPLOYEE_PHONE = `+1999${String(Date.now()).slice(-7)}`;

let orgAId: string;
let orgBId: string;
let locAId: string;
let locBId: string;
let managerAId: string;
let employeeAId: string;

beforeAll(async () => {
  const orgA = await prisma.organization.create({ data: { name: `Test Org A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `Test Org B ${suffix}` } });
  orgAId = orgA.id;
  orgBId = orgB.id;

  const locA = await prisma.location.create({
    data: { organizationId: orgA.id, name: "A Downtown", timezone: "America/New_York" },
  });
  const locB = await prisma.location.create({
    data: { organizationId: orgB.id, name: "B Uptown", timezone: "America/Chicago" },
  });
  locAId = locA.id;
  locBId = locB.id;

  const passwordHash = await hashPassword("rosterhouse1");
  const managerA = await prisma.user.create({
    data: { organizationId: orgA.id, name: "Manager A", email: MANAGER_EMAIL, passwordHash, role: "manager" },
  });
  const employeeA = await prisma.user.create({
    data: { organizationId: orgA.id, name: "Employee A", phone: EMPLOYEE_PHONE, passwordHash, role: "employee" },
  });
  managerAId = managerA.id;
  employeeAId = employeeA.id;

  const positionA = await prisma.position.create({ data: { locationId: locA.id, name: "Server" } });
  await prisma.employeeProfile.create({
    data: { userId: employeeA.id, locationId: locA.id, primaryPositionId: positionA.id, status: "active" },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }); // cascades
  await prisma.$disconnect();
});

describe("getManagerLocation", () => {
  it("returns the org's sole location for a manager", async () => {
    const location = await getManagerLocation(managerAId);
    expect(location.id).toBe(locAId);
    expect(location.timezone).toBe("America/New_York");
  });
});

describe("getEmployeeProfile", () => {
  it("returns the profile with location and primary position", async () => {
    const profile = await getEmployeeProfile(employeeAId);
    expect(profile.location.id).toBe(locAId);
    expect(profile.primaryPosition?.name).toBe("Server");
  });

  it("throws a 404 ApiError for a user with no profile", async () => {
    await expect(getEmployeeProfile(managerAId)).rejects.toMatchObject({ status: 404, code: "no_profile" });
  });
});

describe("assertLocationMember", () => {
  it("resolves for a manager of the location's org", async () => {
    await expect(assertLocationMember(managerAId, locAId)).resolves.toBeUndefined();
  });

  it("resolves for an employee with a profile at the location", async () => {
    await expect(assertLocationMember(employeeAId, locAId)).resolves.toBeUndefined();
  });

  it("throws 403 for a manager of a different org", async () => {
    await expect(assertLocationMember(managerAId, locBId)).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("throws 403 for an employee with no profile at the location", async () => {
    await expect(assertLocationMember(employeeAId, locBId)).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});

describe("authenticateUser", () => {
  it("authenticates by email and password", async () => {
    const user = await authenticateUser(MANAGER_EMAIL, "rosterhouse1");
    expect(user?.id).toBe(managerAId);
  });

  it("authenticates by phone in any common format", async () => {
    const pretty = `(${EMPLOYEE_PHONE.slice(2, 5)}) ${EMPLOYEE_PHONE.slice(5, 8)}-${EMPLOYEE_PHONE.slice(8)}`;
    const user = await authenticateUser(pretty, "rosterhouse1");
    expect(user?.id).toBe(employeeAId);
  });

  it("returns null for a wrong password", async () => {
    await expect(authenticateUser(MANAGER_EMAIL, "wrong-password")).resolves.toBeNull();
  });

  it("returns null for an unknown identifier", async () => {
    await expect(authenticateUser("nobody@test.local", "rosterhouse1")).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/authz.integration.test.ts`
Expected: FAIL — the new functions are not exported from `@/lib/authz`.

- [ ] **Step 4: Complete the implementation**

Replace `src/lib/authz.ts` entirely with:

```ts
import { compare, hash } from "bcryptjs";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import type { EmployeeProfile, Location, Position, User } from "@/generated/prisma/client";

/** bcryptjs, 10 rounds (roadmap contract). */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, hashValue: string): Promise<boolean> {
  return compare(plain, hashValue);
}

/**
 * Look a user up by phone-or-email identifier and verify their password.
 * Returns null on any miss — callers show one generic "doesn't match"
 * message and never reveal which part was wrong.
 */
export async function authenticateUser(identifier: string, password: string): Promise<User | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  let where: { email: string } | { phone: string };
  if (trimmed.includes("@")) {
    where = { email: trimmed.toLowerCase() };
  } else {
    const phone = normalizePhone(trimmed);
    if (!phone) return null;
    where = { phone };
  }

  const user = await prisma.user.findFirst({ where });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

/** v1: a manager's location is the sole (oldest) location of their org. */
export async function getManagerLocation(userId: string): Promise<Location> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, "unauthorized", "Your session is no longer valid. Please log in again.");
  }
  const location = await prisma.location.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    throw new ApiError(404, "no_location", "No location is set up for this business yet.");
  }
  return location;
}

export async function getEmployeeProfile(
  userId: string,
): Promise<EmployeeProfile & { location: Location; primaryPosition: Position | null }> {
  const profile = await prisma.employeeProfile.findFirst({
    where: { userId },
    include: { location: true, primaryPosition: true },
  });
  if (!profile) {
    throw new ApiError(404, "no_profile", "This account isn't linked to a team yet.");
  }
  return profile;
}

/**
 * Tenancy gate for API handlers. Passes when the user is a manager in the
 * location's organization, or holds an EmployeeProfile at the location.
 */
export async function assertLocationMember(userId: string, locationId: string): Promise<void> {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new ApiError(404, "location_not_found", "That location doesn't exist.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, "unauthorized", "Your session is no longer valid. Please log in again.");
  }
  if (user.role === "manager" && user.organizationId === location.organizationId) return;

  const profile = await prisma.employeeProfile.findFirst({ where: { userId, locationId } });
  if (profile) return;

  throw new ApiError(403, "forbidden", "You don't have access to this location.");
}
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/authz.integration.test.ts src/lib/__tests__/password.test.ts`
Expected: PASS (14 tests). Task 2's password tests still pass against the rewritten file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/authz.ts src/lib/__tests__/authz.integration.test.ts
git commit -m "feat: add tenancy helpers and credential authentication to authz"
```

---

### Task 4: Auth.js v5 — Credentials provider, JWT sessions, session helpers

**Files:**
- Create: `src/lib/auth.config.ts`
- Create: `src/lib/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `.env` (append `AUTH_SECRET`)
- Modify: `.env.example` (append `AUTH_SECRET` placeholder)
- Test: `src/lib/__tests__/auth-config.test.ts`

**Interfaces:**
- Consumes: `authenticateUser` from `@/lib/authz` (Task 3).
- Produces (roadmap contract — all later tasks and phases consume):
  - `export const { handlers, auth, signIn, signOut }` from `@/lib/auth` (NextAuth result; JWT strategy).
  - `session.user: { id: string; name: string; role: "manager"|"employee"; organizationId: string }` (plus default email/name fields).
  - `type SessionUser = { id: string; name: string; role: "manager"|"employee"; organizationId: string }` from `@/lib/auth`.
  - `requireUser(): Promise<SessionUser>` — for pages/layouts; `redirect("/login")` when unauthenticated.
  - `requireManager(): Promise<SessionUser>` — additionally `redirect("/")` for employees.
  - `apiUser(): Promise<SessionUser | null>` — NEW contract (not in roadmap): non-redirecting session read for API route handlers; handlers return a 401 envelope when it is null.
  - `authConfig` from `@/lib/auth.config` — edge-safe config (no Prisma/bcrypt imports) that `src/middleware.ts` (Task 5) consumes.
  - Credentials field names are exactly `identifier` and `password` (the login/signup/invite pages call `signIn("credentials", { identifier, password, redirect: false })`).

- [ ] **Step 1: Install next-auth v5 and generate the secret**

```bash
npm install next-auth@beta
echo "" >> .env
echo "# Auth.js session signing secret" >> .env
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env
```

Expected: `next-auth@5.0.0-beta.x` added; `.env` now contains an `AUTH_SECRET` line. Then append to `.env.example` (do NOT put a real secret here):

```bash
cat >> .env.example << 'EOF'

# Auth.js session signing secret — generate with: openssl rand -base64 32
AUTH_SECRET="replace-me"
EOF
```

- [ ] **Step 2: Write the failing test for the JWT/session callbacks**

Create `src/lib/__tests__/auth-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authConfig } from "@/lib/auth.config";

describe("authConfig", () => {
  it("uses JWT sessions and the /login page", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.pages?.signIn).toBe("/login");
  });

  it("copies id, role, and organizationId onto the JWT at sign-in", async () => {
    const token = await authConfig.callbacks!.jwt!({
      token: { name: "Jamie Park" },
      user: { id: "user_1", name: "Jamie Park", role: "manager", organizationId: "org_1" },
    } as never);
    expect(token).toMatchObject({ id: "user_1", role: "manager", organizationId: "org_1" });
  });

  it("exposes id, role, and organizationId on the session user", async () => {
    const session = await authConfig.callbacks!.session!({
      session: { user: { name: "Jamie Park", email: "jamie@harborvine.test" }, expires: "" },
      token: { id: "user_1", role: "manager", organizationId: "org_1", name: "Jamie Park" },
    } as never);
    expect(session.user).toMatchObject({ id: "user_1", role: "manager", organizationId: "org_1" });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/auth-config.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth.config"`.

- [ ] **Step 4: Write the type augmentation**

Create `src/types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "manager" | "employee";
      organizationId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: "manager" | "employee";
    organizationId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "manager" | "employee";
    organizationId: string;
  }
}
```

- [ ] **Step 5: Write the edge-safe config**

Create `src/lib/auth.config.ts`. This file must never import Prisma or bcryptjs — the middleware (edge-adjacent) imports it. The Credentials provider is added only in `auth.ts`.

```ts
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config: no Prisma, no bcrypt. src/middleware.ts builds
 * its own NextAuth(authConfig) from this to decode the session JWT;
 * src/lib/auth.ts spreads it and adds the Credentials provider.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true, // Railway/localhost are not Vercel; hosts come from env
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 6: Write `src/lib/auth.ts` and the route handler**

Create `src/lib/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";
import { authenticateUser } from "@/lib/authz";

export type SessionUser = {
  id: string;
  name: string;
  role: "manager" | "employee";
  organizationId: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Phone or email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = typeof credentials?.identifier === "string" ? credentials.identifier : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!identifier || !password) return null;

        const user = await authenticateUser(identifier, password);
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});

/** For server components/layouts: redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, name, role, organizationId } = session.user;
  return { id, name: name ?? "", role, organizationId };
}

/** For manager pages: employees are sent to their home ("/"). */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/");
  return user;
}

/** For API route handlers: no redirect — handlers return a 401 envelope on null. */
export async function apiUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id, name, role, organizationId } = session.user;
  return { id, name: name ?? "", role, organizationId };
}
```

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 7: Run the test and the type check**

Run: `npx vitest run src/lib/__tests__/auth-config.test.ts`
Expected: PASS (3 tests).

Run: `npx tsc --noEmit`
Expected: no errors (the augmentation in `src/types/next-auth.d.ts` makes `user.role`, `token.id`, `session.user.id` type-check).

- [ ] **Step 8: Smoke-test the auth endpoint**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/api/auth/providers
kill %1
```

Expected output includes: `"credentials":{"id":"credentials","name":"Credentials","type":"credentials"...}`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth.config.ts src/lib/auth.ts src/types/next-auth.d.ts "src/app/api/auth/[...nextauth]/route.ts" src/lib/__tests__/auth-config.test.ts .env.example package.json package-lock.json
git commit -m "feat: add Auth.js v5 credentials auth with JWT sessions and session helpers"
```

(`.env` is gitignored — never commit it.)

---

### Task 5: Middleware redirect rules + app shells

**Files:**
- Create: `src/lib/routes.ts`
- Create: `src/middleware.ts`
- Create: `src/app/manager/layout.tsx`
- Create: `src/app/manager/page.tsx` (placeholder dashboard; Phase 3 replaces it)
- Create: `src/app/(employee)/layout.tsx`
- Create: `src/app/(employee)/page.tsx` (placeholder home; Phase 4 replaces it)
- Delete: `src/app/page.tsx` (the scaffold splash — it would collide with `(employee)/page.tsx` on `/`)
- Test: `src/lib/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `authConfig` (Task 4), `requireUser`/`requireManager` (Task 4), `getManagerLocation` (Task 3), `ManagerSidebar`/`EmployeeTabBar`/`ToasterProvider` (Phase 1 — see "Consumed component contract").
- Produces:
  - `redirectTargetFor(pathname: string, user: { role: "manager"|"employee" } | null): string | null` in `@/lib/routes` — pure redirect-rule function (also exports `isPublicPath`, `isEmployeePath`).
  - `src/app/manager/layout.tsx` — Phases 3+ add pages under it; it provides `requireManager()` + sidebar + `<main>` with `var(--space-8)` padding, all wrapped in `<ToasterProvider>` (so `useToast()` works on every `/manager/*` page).
  - `src/app/(employee)/layout.tsx` — Phase 4 adds pages under it; it provides `requireUser()` + bottom tab bar, content max width 480px, all wrapped in `<ToasterProvider>` (so `useToast()` works on every employee page).
  - Redirect behavior (roadmap contract): unauthenticated → `/login`; employee at `/manager/*` → `/`; manager at employee tabs (`/`, `/shifts/*`, `/availability`, `/clock`, `/swaps`, `/notifications`, `/profile`) → `/manager`; signed-in users at `/login` or `/signup` → their home.

- [ ] **Step 1: Write the failing test for the redirect rules**

Create `src/lib/__tests__/routes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isEmployeePath, isPublicPath, redirectTargetFor } from "@/lib/routes";

const manager = { role: "manager" as const };
const employee = { role: "employee" as const };

describe("isPublicPath", () => {
  it("allows auth pages and invite links", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/invite/some-token-123")).toBe(true);
    expect(isPublicPath("/design-system")).toBe(true);
  });

  it("does not allow app pages", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/manager")).toBe(false);
    expect(isPublicPath("/manager/team")).toBe(false);
  });
});

describe("isEmployeePath", () => {
  it("matches the employee tab routes", () => {
    expect(isEmployeePath("/")).toBe(true);
    expect(isEmployeePath("/shifts/abc")).toBe(true);
    expect(isEmployeePath("/availability")).toBe(true);
    expect(isEmployeePath("/clock")).toBe(true);
    expect(isEmployeePath("/swaps")).toBe(true);
    expect(isEmployeePath("/notifications")).toBe(true);
    expect(isEmployeePath("/profile")).toBe(true);
  });

  it("does not match manager routes, even overlapping names", () => {
    expect(isEmployeePath("/manager")).toBe(false);
    expect(isEmployeePath("/manager/availability")).toBe(false);
    expect(isEmployeePath("/manager/swaps")).toBe(false);
  });
});

describe("redirectTargetFor", () => {
  it("sends unauthenticated users to /login except on public paths", () => {
    expect(redirectTargetFor("/manager", null)).toBe("/login");
    expect(redirectTargetFor("/", null)).toBe("/login");
    expect(redirectTargetFor("/login", null)).toBeNull();
    expect(redirectTargetFor("/invite/tok", null)).toBeNull();
  });

  it("sends employees at /manager/* to /", () => {
    expect(redirectTargetFor("/manager", employee)).toBe("/");
    expect(redirectTargetFor("/manager/schedule", employee)).toBe("/");
  });

  it("sends managers at employee tabs to /manager", () => {
    expect(redirectTargetFor("/", manager)).toBe("/manager");
    expect(redirectTargetFor("/clock", manager)).toBe("/manager");
    expect(redirectTargetFor("/shifts/abc", manager)).toBe("/manager");
  });

  it("leaves users alone on their own turf", () => {
    expect(redirectTargetFor("/manager/team", manager)).toBeNull();
    expect(redirectTargetFor("/manager/availability", manager)).toBeNull();
    expect(redirectTargetFor("/availability", employee)).toBeNull();
    expect(redirectTargetFor("/", employee)).toBeNull();
  });

  it("bounces signed-in users off /login and /signup to their home", () => {
    expect(redirectTargetFor("/login", manager)).toBe("/manager");
    expect(redirectTargetFor("/login", employee)).toBe("/");
    expect(redirectTargetFor("/signup", manager)).toBe("/manager");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/routes.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/routes"`.

- [ ] **Step 3: Implement the pure redirect rules**

Create `src/lib/routes.ts`:

```ts
type RouteUser = { role: "manager" | "employee" };

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/design-system"];
const EMPLOYEE_PREFIXES = ["/shifts", "/availability", "/clock", "/swaps", "/notifications", "/profile"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  if (matchesPrefix(pathname, "/invite")) return true;
  return PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p));
}

export function isEmployeePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return EMPLOYEE_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * The roadmap's redirect rules as a pure function.
 * Returns the path to redirect to, or null to let the request through.
 */
export function redirectTargetFor(pathname: string, user: RouteUser | null): string | null {
  if (!user) return isPublicPath(pathname) ? null : "/login";

  const home = user.role === "manager" ? "/manager" : "/";
  if (pathname === "/login" || pathname === "/signup") return home;
  if (user.role === "employee" && matchesPrefix(pathname, "/manager")) return "/";
  if (user.role === "manager" && isEmployeePath(pathname)) return "/manager";
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/routes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the middleware**

Create `src/middleware.ts` (note: it lives in `src/`, next to `app/`, because this project uses a `src` directory. If `next build` ever reports that `middleware.ts` is unsupported in this Next 16 version, rename the file to `src/proxy.ts` and the default export to `proxy` — Next 16 renamed the convention but keeps `middleware.ts` working):

```ts
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { redirectTargetFor } from "@/lib/routes";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const role = req.auth?.user?.role ?? null;
  const target = redirectTargetFor(req.nextUrl.pathname, role ? { role } : null);
  if (target) return Response.redirect(new URL(target, req.nextUrl));
});

export const config = {
  // Skip API routes (handlers return 401 JSON themselves), Next internals,
  // and any file with an extension (static assets).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

- [ ] **Step 6: Create the manager shell and placeholder dashboard**

Create `src/app/manager/layout.tsx`:

```tsx
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";
import { ToasterProvider } from "@/components/ui/Toaster";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);

  return (
    <ToasterProvider>
      <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface-page)" }}>
        <ManagerSidebar locationName={location.name} userName={user.name} />
        <main style={{ flex: 1, padding: "var(--space-8)", overflow: "auto" }}>{children}</main>
      </div>
    </ToasterProvider>
  );
}
```

Create `src/app/manager/page.tsx`:

```tsx
import { requireManager } from "@/lib/auth";
import { Card } from "@/components/ui/Card";

export default async function ManagerDashboardPage() {
  const user = await requireManager();
  const firstName = user.name.split(" ")[0] || "there";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Dashboard
      </h1>
      <Card>
        <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Welcome, {firstName}.</p>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          Schedule insights will appear here. Start by inviting your team on the team page.
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Create the employee shell and placeholder home; remove the splash page**

Create `src/app/(employee)/layout.tsx`:

```tsx
import { requireUser } from "@/lib/auth";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { ToasterProvider } from "@/components/ui/Toaster";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <ToasterProvider>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-page)",
        }}
      >
        <div style={{ flex: 1, paddingBottom: 80 }}>{children}</div>
        <EmployeeTabBar />
      </div>
    </ToasterProvider>
  );
}
```

Create `src/app/(employee)/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function EmployeeHomePage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0] || "there";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px 20px" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Hi, {firstName}
      </h1>
      <EmptyState
        title="No shifts to show yet"
        description="Your shifts will appear here once your manager publishes a schedule."
      />
    </div>
  );
}
```

Delete the scaffold splash page (it would collide with the employee home on `/`):

```bash
rm src/app/page.tsx
```

- [ ] **Step 8: Confirm the toast provider mounts — no root-layout change**

Phase 1's `@/components/ui/Toaster` exports `ToasterProvider` and `useToast` — there is no `<Toaster />` component to mount, and a sibling mount would provide no React context anyway. Steps 6 and 7 already wrap the manager and employee shells in `<ToasterProvider>`, so every page under `/manager/*` and the `(employee)` group can call `useToast()`. Do **not** modify `src/app/layout.tsx` in this task; confirm both layout files wrap their content in `<ToasterProvider>` before moving on.

- [ ] **Step 9: Verify redirects by hand**

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/manager
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
kill %1
```

Expected:
- `/manager` → `30x -> http://localhost:3000/login`
- `/` → `30x -> http://localhost:3000/login`
- `/login` → `200`

- [ ] **Step 10: Run the type check and commit**

Run: `npx tsc --noEmit` — expected: no errors.

```bash
git add -A src/lib/routes.ts src/middleware.ts src/app src/lib/__tests__/routes.test.ts
git commit -m "feat: add auth middleware, manager/employee shells, and placeholder pages"
```

(`git add -A src/app` also stages the deletion of `src/app/page.tsx`.)

---

### Task 6: Seed data (`prisma/seed.ts`)

**Files:**
- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts` (wire `migrations.seed` per Prisma 7)
- Modify: `package.json` (add `db:seed` script; deps via npm)

**Interfaces:**
- Consumes: `hashPassword` from `src/lib/authz` (Task 3); `prisma` from `src/lib/db` (relative imports from `prisma/` — tsx resolves the `@/` aliases inside those files via tsconfig paths).
- Produces (roadmap Seed contract — later phases and all QA rely on this exact dataset):
  - Org **"Harbor & Vine"**, location **"Downtown"** (America/New_York, OT 40), positions **Line cook / Server / Dishwasher / Host**.
  - Manager **Jamie Park** — `jamie@harborvine.test` / `rosterhouse1`.
  - 10 employees incl. **Maria Garcia** — `maria@harborvine.test` / `rosterhouse1`; all employee passwords `rosterhouse1`; multi-position qualifications; per-day availability rules; one inactive employee (Morgan Reyes).
  - Current week schedule **published** (20 shifts, one crossing midnight) + next week **draft** (13 shifts) containing **one open shift** (Saturday Server 4:00 PM – 10:00 PM) and **one deliberate double-booking** (Maria, Wednesday).
  - One pending time-off (Alex Kim), one pending swap (Sam Torres, open to anyone), one pending open-shift claim (Chris Nguyen).
  - One pending demo invite with fixed token **`demo-invite-riley`** (Riley Quinn, Server) — Tasks 10/11 QA uses `http://localhost:3000/invite/demo-invite-riley`.
  - `npm run db:seed` — re-runnable: deletes the previous "Harbor & Vine" org (cascade) and recreates everything.
  - Installs `date-fns@4`, `@date-fns/tz`, `tsx` (Phase 3 also uses date-fns; installing here is fine and idempotent).

- [ ] **Step 1: Install dependencies**

```bash
npm install date-fns@^4 @date-fns/tz
npm install -D tsx
```

Expected: packages added without peer warnings.

- [ ] **Step 2: Wire the seed command into Prisma 7 config**

Replace `prisma.config.ts` with:

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

Add to `package.json` `"scripts"` (keep the existing scripts):

```json
"db:seed": "prisma db seed"
```

- [ ] **Step 3: Write the seed script**

Create `prisma/seed.ts`. Notes for the implementer: the export's mock data is contradictory and must NOT be translated — this is a fresh, coherent dataset. `@db.Date` columns get UTC-midnight `Date`s for the local calendar day. Shifts store UTC instants computed from America/New_York wall-clock times via `TZDate`. End-before-start means the shift crosses midnight.

```ts
// prisma/seed.ts — fresh, coherent demo org ("Harbor & Vine").
// Re-runnable: deletes any existing "Harbor & Vine" org (cascades to every
// child row) and recreates everything. Run with: npm run db:seed
import "dotenv/config";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/authz";

const TZ = "America/New_York";
const ORG_NAME = "Harbor & Vine";
const PASSWORD = "rosterhouse1";

type EmployeeSpec = {
  name: string;
  email: string;
  phone: string;
  primary: string; // position name
  also: string[]; // extra qualified positions
  hourlyRate: string; // Decimal as string
  status?: "active" | "inactive";
};

const EMPLOYEES: EmployeeSpec[] = [
  { name: "Maria Garcia", email: "maria@harborvine.test", phone: "+15550100101", primary: "Line cook", also: ["Server"], hourlyRate: "19.50" },
  { name: "Sam Torres", email: "sam@harborvine.test", phone: "+15550100102", primary: "Line cook", also: [], hourlyRate: "18.00" },
  { name: "Alex Kim", email: "alex@harborvine.test", phone: "+15550100103", primary: "Server", also: ["Host"], hourlyRate: "12.50" },
  { name: "Priya Shah", email: "priya@harborvine.test", phone: "+15550100104", primary: "Server", also: [], hourlyRate: "12.50" },
  { name: "Jordan Park", email: "jordan@harborvine.test", phone: "+15550100105", primary: "Dishwasher", also: ["Line cook"], hourlyRate: "15.00" },
  { name: "Dana Lee", email: "dana@harborvine.test", phone: "+15550100106", primary: "Host", also: ["Server"], hourlyRate: "14.00" },
  { name: "Chris Nguyen", email: "chris@harborvine.test", phone: "+15550100107", primary: "Server", also: ["Dishwasher"], hourlyRate: "12.50" },
  { name: "Taylor Brooks", email: "taylor@harborvine.test", phone: "+15550100108", primary: "Line cook", also: [], hourlyRate: "18.50" },
  { name: "Morgan Reyes", email: "morgan@harborvine.test", phone: "+15550100109", primary: "Dishwasher", also: [], hourlyRate: "15.00", status: "inactive" },
  { name: "Jessie Chen", email: "jessie@harborvine.test", phone: "+15550100110", primary: "Host", also: [], hourlyRate: "14.00" },
];

// Weekly availability exceptions; any (employee, day) not listed = available
// all day. dayOfWeek: 0=Mon .. 6=Sun (matches AvailabilityRule and the UI).
const AVAILABILITY_EXCEPTIONS: Record<
  string,
  Record<number, { isAvailable: boolean; startTime?: string; endTime?: string }>
> = {
  "maria@harborvine.test": { 6: { isAvailable: false } }, // Sundays off
  "alex@harborvine.test": {
    0: { isAvailable: true, startTime: "09:00", endTime: "21:00" },
    1: { isAvailable: true, startTime: "09:00", endTime: "21:00" },
  },
  "dana@harborvine.test": { 5: { isAvailable: false }, 6: { isAvailable: false } }, // weekends off
  "sam@harborvine.test": { 3: { isAvailable: true, startTime: "07:00", endTime: "15:00" } },
};

type ShiftSpec = {
  day: number; // 0=Mon .. 6=Sun offset from the week's Monday
  start: [number, number]; // [hour, minute], location-local 24h
  end: [number, number]; // end <= start means the shift crosses midnight
  position: string;
  employee: string | null; // employee email, or null = open shift
  notes?: string;
};

const CURRENT_WEEK_SHIFTS: ShiftSpec[] = [
  { day: 0, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 0, start: [11, 0], end: [19, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 0, start: [16, 0], end: [22, 0], position: "Dishwasher", employee: "jordan@harborvine.test" },
  { day: 1, start: [7, 0], end: [15, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 1, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
  { day: 1, start: [16, 0], end: [22, 0], position: "Dishwasher", employee: "chris@harborvine.test" },
  { day: 2, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 2, start: [11, 0], end: [19, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 2, start: [10, 0], end: [16, 0], position: "Host", employee: "dana@harborvine.test" },
  { day: 3, start: [7, 0], end: [15, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 3, start: [10, 0], end: [16, 0], position: "Host", employee: "dana@harborvine.test" },
  { day: 3, start: [16, 0], end: [22, 0], position: "Server", employee: "chris@harborvine.test" },
  { day: 4, start: [14, 0], end: [20, 0], position: "Line cook", employee: "maria@harborvine.test", notes: "Inventory count at close." },
  { day: 4, start: [16, 0], end: [22, 0], position: "Server", employee: "priya@harborvine.test" },
  { day: 4, start: [18, 0], end: [0, 0], position: "Dishwasher", employee: "jordan@harborvine.test" }, // crosses midnight
  { day: 5, start: [10, 0], end: [18, 0], position: "Line cook", employee: "taylor@harborvine.test" },
  { day: 5, start: [16, 0], end: [22, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 5, start: [17, 0], end: [23, 0], position: "Dishwasher", employee: "chris@harborvine.test" },
  { day: 6, start: [9, 0], end: [17, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 6, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
];

const NEXT_WEEK_SHIFTS: ShiftSpec[] = [
  { day: 0, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 0, start: [11, 0], end: [19, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 0, start: [16, 0], end: [22, 0], position: "Dishwasher", employee: "jordan@harborvine.test" },
  { day: 1, start: [7, 0], end: [15, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 1, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
  // Deliberate double-booking: Maria holds two overlapping Wednesday shifts.
  { day: 2, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 2, start: [12, 0], end: [18, 0], position: "Server", employee: "maria@harborvine.test" },
  { day: 3, start: [7, 0], end: [15, 0], position: "Line cook", employee: "taylor@harborvine.test" },
  { day: 3, start: [10, 0], end: [16, 0], position: "Host", employee: "dana@harborvine.test" },
  { day: 4, start: [16, 0], end: [22, 0], position: "Server", employee: "chris@harborvine.test" },
  { day: 4, start: [18, 0], end: [0, 0], position: "Dishwasher", employee: "jordan@harborvine.test" },
  // Open (unassigned) shift — Saturday evening server.
  { day: 5, start: [16, 0], end: [22, 0], position: "Server", employee: null },
  { day: 6, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
];

/** Monday 00:00 of the current week in the location's timezone. */
function mondayOfCurrentWeek(): TZDate {
  const now = TZDate.tz(TZ);
  const sinceMonday = (now.getDay() + 6) % 7; // getDay(): 0=Sun .. 6=Sat
  const monday = addDays(now, -sinceMonday);
  return new TZDate(monday.getFullYear(), monday.getMonth(), monday.getDate(), TZ);
}

/** UTC-midnight Date for a local calendar day — what Prisma @db.Date expects. */
function dateOnly(d: TZDate): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function shiftInstants(weekMonday: TZDate, spec: ShiftSpec) {
  const day = addDays(weekMonday, spec.day);
  const startsAt = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), spec.start[0], spec.start[1], TZ);
  let endsAt = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), spec.end[0], spec.end[1], TZ);
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = addDays(endsAt, 1); // end-before-start = crosses midnight
  }
  return { date: dateOnly(day), startsAt: new Date(startsAt.getTime()), endsAt: new Date(endsAt.getTime()) };
}

async function main() {
  console.log(`Seeding "${ORG_NAME}" demo data...`);
  await prisma.organization.deleteMany({ where: { name: ORG_NAME } }); // cascade wipes the old demo

  const org = await prisma.organization.create({ data: { name: ORG_NAME } });
  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Downtown",
      timezone: TZ,
      address: "214 Harbor St",
      overtimeHoursPerWeek: 40,
    },
  });

  const positionNames = ["Line cook", "Server", "Dishwasher", "Host"];
  const positions: Record<string, string> = {};
  for (const [i, name] of positionNames.entries()) {
    const position = await prisma.position.create({
      data: { locationId: location.id, name, sortOrder: i },
    });
    positions[name] = position.id;
  }

  const passwordHash = await hashPassword(PASSWORD);

  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Jamie Park",
      email: "jamie@harborvine.test",
      phone: "+15550100100",
      passwordHash,
      role: "manager",
    },
  });

  const profileIdByEmail: Record<string, string> = {};
  for (const spec of EMPLOYEES) {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: spec.name,
        email: spec.email,
        phone: spec.phone,
        passwordHash,
        role: "employee",
      },
    });
    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        locationId: location.id,
        primaryPositionId: positions[spec.primary],
        hourlyRate: spec.hourlyRate,
        status: spec.status ?? "active",
      },
    });
    profileIdByEmail[spec.email] = profile.id;

    const qualified = [spec.primary, ...spec.also];
    await prisma.employeePosition.createMany({
      data: qualified.map((positionName) => ({
        employeeProfileId: profile.id,
        positionId: positions[positionName],
      })),
    });

    const exceptions = AVAILABILITY_EXCEPTIONS[spec.email] ?? {};
    await prisma.availabilityRule.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => {
        const ex = exceptions[dayOfWeek];
        return {
          employeeProfileId: profile.id,
          dayOfWeek,
          isAvailable: ex ? ex.isAvailable : true,
          startTime: ex?.startTime ?? null,
          endTime: ex?.endTime ?? null,
        };
      }),
    });
  }

  const currentMonday = mondayOfCurrentWeek();
  const nextMonday = addDays(currentMonday, 7);

  const currentSchedule = await prisma.schedule.create({
    data: {
      locationId: location.id,
      weekStartDate: dateOnly(currentMonday),
      status: "published",
      publishedAt: new Date(),
      publishedByUserId: manager.id,
    },
  });
  const nextSchedule = await prisma.schedule.create({
    data: { locationId: location.id, weekStartDate: dateOnly(nextMonday), status: "draft" },
  });

  async function createShifts(
    scheduleId: string,
    weekMonday: TZDate,
    specs: ShiftSpec[],
    status: "draft" | "published",
  ) {
    for (const spec of specs) {
      const { date, startsAt, endsAt } = shiftInstants(weekMonday, spec);
      await prisma.shift.create({
        data: {
          scheduleId,
          locationId: location.id,
          positionId: positions[spec.position],
          employeeProfileId: spec.employee ? profileIdByEmail[spec.employee] : null,
          date,
          startsAt,
          endsAt,
          status,
          notes: spec.notes ?? null,
        },
      });
    }
  }

  await createShifts(currentSchedule.id, currentMonday, CURRENT_WEEK_SHIFTS, "published");
  await createShifts(nextSchedule.id, nextMonday, NEXT_WEEK_SHIFTS, "draft");

  // One pending time-off request: Alex Kim, Thu-Fri of next week.
  await prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileIdByEmail["alex@harborvine.test"],
      startDate: dateOnly(addDays(nextMonday, 3)),
      endDate: dateOnly(addDays(nextMonday, 4)),
      reason: "vacation",
      note: "Family visit",
      status: "pending",
    },
  });

  // One pending swap: Sam wants his Sunday shift covered, open to anyone qualified.
  const samSundayShift = await prisma.shift.findFirst({
    where: { scheduleId: currentSchedule.id, employeeProfileId: profileIdByEmail["sam@harborvine.test"] },
    orderBy: { startsAt: "desc" },
  });
  await prisma.swapRequest.create({
    data: {
      shiftId: samSundayShift!.id,
      requestingEmployeeProfileId: profileIdByEmail["sam@harborvine.test"],
      coveringEmployeeProfileId: null,
      note: "Something came up on Sunday. Can anyone cover?",
      status: "pending",
    },
  });

  // One pending open-shift claim: Chris claims next week's open Server shift.
  const openShift = await prisma.shift.findFirst({
    where: { scheduleId: nextSchedule.id, employeeProfileId: null },
  });
  await prisma.openShiftClaim.create({
    data: {
      shiftId: openShift!.id,
      employeeProfileId: profileIdByEmail["chris@harborvine.test"],
      status: "pending",
    },
  });

  // One pending demo invite with a fixed token so QA can open
  // /invite/demo-invite-riley directly. Safe to recreate: the old org
  // (and its invites) were deleted above.
  await prisma.invite.create({
    data: {
      organizationId: org.id,
      locationId: location.id,
      invitedByUserId: manager.id,
      positionId: positions["Server"],
      name: "Riley Quinn",
      phone: "+15550100111",
      token: "demo-invite-riley",
      status: "pending",
      expiresAt: addDays(new Date(), 14),
    },
  });

  const counts = {
    users: await prisma.user.count({ where: { organizationId: org.id } }),
    profiles: await prisma.employeeProfile.count({ where: { locationId: location.id } }),
    shifts: await prisma.shift.count({ where: { locationId: location.id } }),
  };
  console.log(`Seeded "${ORG_NAME}": ${counts.users} users, ${counts.profiles} profiles, ${counts.shifts} shifts.`);
  console.log("Manager login: jamie@harborvine.test / rosterhouse1");
  console.log("Employee login: maria@harborvine.test / rosterhouse1");
  console.log("Demo invite: http://localhost:3000/invite/demo-invite-riley");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run the seed and verify the output**

Run: `npm run db:seed`
Expected output (order may vary slightly):

```
Seeding "Harbor & Vine" demo data...
Seeded "Harbor & Vine": 11 users, 10 profiles, 33 shifts.
Manager login: jamie@harborvine.test / rosterhouse1
Employee login: maria@harborvine.test / rosterhouse1
Demo invite: http://localhost:3000/invite/demo-invite-riley
```

- [ ] **Step 5: Verify it is re-runnable**

Run: `npm run db:seed` again.
Expected: identical output, no unique-constraint errors (the old org was deleted first).

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts prisma.config.ts package.json package-lock.json
git commit -m "feat: add re-runnable Harbor & Vine seed dataset"
```

---

### Task 7: Login page and forgot-password stub

**Files:**
- Create: `src/app/login/page.tsx` (server wrapper, metadata)
- Create: `src/app/login/LoginForm.tsx` (client)
- Create: `src/app/forgot-password/page.tsx`
- Test: `src/app/login/__tests__/login-form.test.tsx`

**Interfaces:**
- Consumes: `signIn` from `next-auth/react` (Task 4 wired the provider; credentials fields are `identifier` + `password`); `Button`, `Input`, `Card` primitives; seed users (Task 6) for manual verification; middleware role routing (Task 5) — after sign-in the form navigates to `/` and middleware forwards managers to `/manager`.
- Produces: `/login` (shared by both roles) and `/forgot-password` (honest v1 stub — explains asking the manager for a reset link; no dead links). Design reference: `LoginScreen` in `"RosterHouse Design System/ui_kits/employee-mobile/EmployeeApp.jsx"` (brand wordmark, "Log in" heading, two inputs, full-width primary button) — but with a real form, real links, and a specific error state, fixing the export's onClick-div defects.

- [ ] **Step 1: Write the failing component test**

Create `src/app/login/__tests__/login-form.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginForm } from "@/app/login/LoginForm";

const signInMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn: signInMock }));

beforeEach(() => {
  signInMock.mockReset();
  // jsdom defines window.location as non-configurable, so it can't be replaced
  // with Object.defineProperty. `assign` is a writable method, so spy on it instead.
  vi.spyOn(window.location, "assign").mockImplementation(() => {});
});

function fillAndSubmit(identifier: string, password: string) {
  fireEvent.change(screen.getByLabelText("Phone or email"), { target: { value: identifier } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  it("asks for both fields before calling signIn", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter your phone or email and your password.")).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("shows the specific mismatch error when credentials fail", async () => {
    signInMock.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    render(<LoginForm />);
    fillAndSubmit("maria@harborvine.test", "wrong-password");
    expect(await screen.findByText("That phone/email or password doesn't match.")).toBeTruthy();
  });

  it("navigates to / on success (middleware routes managers onward)", async () => {
    signInMock.mockResolvedValue({ error: null, ok: true });
    render(<LoginForm />);
    fillAndSubmit("maria@harborvine.test", "rosterhouse1");
    await vi.waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/"));
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      identifier: "maria@harborvine.test",
      password: "rosterhouse1",
      redirect: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/login/__tests__/login-form.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/login/LoginForm"`.

- [ ] **Step 3: Implement the login form**

Create `src/app/login/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Enter your phone or email and your password.");
      return;
    }
    setSubmitting(true);
    const res = await signIn("credentials", {
      identifier: identifier.trim(),
      password,
      redirect: false,
    });
    if (res?.error) {
      setSubmitting(false);
      setError("That phone/email or password doesn't match.");
      return;
    }
    // Middleware routes managers from "/" to "/manager"; a full navigation
    // makes sure the new session cookie is picked up.
    window.location.assign("/");
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "72px 24px 24px",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-brand)" }}>RosterHouse</div>
      <h1 style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", marginTop: 12 }}>
        Log in
      </h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Input
          label="Phone or email"
          placeholder="maria@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
            {error}
          </p>
        )}
        <Button variant="primary" size="lg" fullWidth type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <div style={{ textAlign: "center" }}>
        <Link href="/forgot-password" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Forgot password?
        </Link>
      </div>
      <div style={{ marginTop: "auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          New here? Use the invite link your manager sent you.
        </span>
        <Link href="/signup" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
          Setting up a business? Create an account
        </Link>
      </div>
    </main>
  );
}
```

Create `src/app/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in — RosterHouse" };

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/login/__tests__/login-form.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the forgot-password stub**

Create `src/app/forgot-password/page.tsx` — an honest placeholder, not a dead link (there is no email infrastructure in v1):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Forgot password — RosterHouse" };

export default function ForgotPasswordPage() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "72px 24px 24px",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-brand)" }}>RosterHouse</div>
      <h1 style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", marginTop: 12 }}>
        Forgot your password?
      </h1>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 14, color: "var(--text-primary)" }}>
            Password reset by email isn't available yet.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Ask your manager for a reset link — they can send you a fresh invite that lets you set a
            new password. If you manage this account, hold tight: self-serve reset is coming soon.
          </p>
        </div>
      </Card>
      <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600, textAlign: "center" }}>
        Back to log in
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Verify by logging in as both seed users (roadmap seed-contract check)**

```bash
docker compose up -d
npm run db:seed
npm run dev
```

In a browser:
1. Visit `http://localhost:3000/login`. Log in as `jamie@harborvine.test` / `rosterhouse1` → you land on `/manager` (dashboard placeholder with sidebar).
2. Visit `http://localhost:3000/api/auth/signout`, confirm sign out (there is no in-app logout button until Phase 4's profile page — this built-in page is the way to switch users during QA).
3. Log in as `maria@harborvine.test` / `rosterhouse1` → you land on `/` ("Hi, Maria" with the tab bar).
4. Log in with a wrong password → the form shows "That phone/email or password doesn't match." and stays on `/login`.
5. Click "Forgot password?" → the stub page renders with a working "Back to log in" link.

- [ ] **Step 7: Commit**

```bash
git add src/app/login src/app/forgot-password
git commit -m "feat: add shared login page and honest forgot-password stub"
```

---

### Task 8: Signup wizard + `POST /api/auth/signup`

The design export has **no manager signup screen** (blocker #1 in the review findings). This screen is net-new UI composed from the Phase 1 primitives, following the design system's conventions: a single centered card, one step visible at a time, sentence-case copy, specific inline errors.

**Files:**
- Create: `src/app/api/auth/signup/route.ts`
- Create: `src/app/signup/page.tsx`
- Create: `src/app/signup/SignupWizard.tsx`
- Test: `src/app/api/__tests__/signup.integration.test.ts`
- Test: `src/app/signup/__tests__/signup-wizard.test.tsx`

**Interfaces:**
- Consumes: `jsonOk`/`jsonErr`/`parseJson`/`handleApiError` (Task 1); `hashPassword` (Task 2); `normalizePhone` (Task 2); `prisma` from `@/lib/db`; `signIn` from `next-auth/react` (Task 4); `Button`/`Input`/`Select`/`Card`/`Tag` primitives.
- Produces:
  - `POST /api/auth/signup` — body `{ name, email, phone?, password, businessName, locationName, timezone, positions: string[] }` → `201 { ok: true, data: { organizationId, locationId, userId } }`. Creates Organization + Location + Positions + manager User in **one transaction**. Errors: `400 invalid_input` / `invalid_phone`, `409 account_exists`.
  - `/signup` page — 4-step wizard (your details → business name → location + IANA timezone select → position tag input defaulting to Line cook/Server/Dishwasher/Host). On success it signs in client-side and hard-navigates to `/manager`.

- [ ] **Step 1: Write the failing integration test for the signup transaction**

Create `src/app/api/__tests__/signup.integration.test.ts`:

```ts
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/authz";
import { POST } from "@/app/api/auth/signup/route";

const createdOrgIds: string[] = [];

function uniqueEmail() {
  return `signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

function signupRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://test.local/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Jamie Park",
      email: uniqueEmail(),
      password: "rosterhouse1",
      businessName: "Test Harbor",
      locationName: "Downtown",
      timezone: "America/New_York",
      positions: ["Line cook", "Server", "Dishwasher", "Host"],
      ...overrides,
    }),
  });
}

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  await prisma.$disconnect();
});

describe("POST /api/auth/signup", () => {
  it("creates org, location, positions, and manager in one transaction", async () => {
    const email = uniqueEmail();
    const res = await POST(signupRequest({ email }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    createdOrgIds.push(body.data.organizationId);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("manager");
    expect(user!.organizationId).toBe(body.data.organizationId);
    await expect(verifyPassword("rosterhouse1", user!.passwordHash)).resolves.toBe(true);

    const location = await prisma.location.findUnique({ where: { id: body.data.locationId } });
    expect(location!.timezone).toBe("America/New_York");

    const positions = await prisma.position.findMany({
      where: { locationId: body.data.locationId },
      orderBy: { sortOrder: "asc" },
    });
    expect(positions.map((p) => p.name)).toEqual(["Line cook", "Server", "Dishwasher", "Host"]);
  });

  it("rejects a duplicate email with a specific 409", async () => {
    const email = uniqueEmail();
    const first = await POST(signupRequest({ email }));
    const firstBody = await first.json();
    createdOrgIds.push(firstBody.data.organizationId);

    const res = await POST(signupRequest({ email }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("account_exists");
  });

  it("rejects a missing business name with a 400 naming the field", async () => {
    const res = await POST(signupRequest({ businessName: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toContain("businessName");
  });

  it("rejects an unknown timezone", async () => {
    const res = await POST(signupRequest({ timezone: "Mars/Olympus" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("timezone");
  });

  it("rejects an unparseable phone with a specific message", async () => {
    const res = await POST(signupRequest({ phone: "12" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_phone");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/__tests__/signup.integration.test.ts`
Expected: FAIL — cannot resolve `@/app/api/auth/signup/route`.

- [ ] **Step 3: Implement the signup handler**

Create `src/app/api/auth/signup/route.ts`:

```ts
import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { hashPassword } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email address."),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password needs at least 8 characters."),
  businessName: z.string().trim().min(1, "Enter your business name."),
  locationName: z.string().trim().min(1, "Enter a location name."),
  timezone: z
    .string()
    .refine((tz) => (Intl.supportedValuesOf("timeZone") as string[]).includes(tz), "Choose a timezone from the list."),
  positions: z.array(z.string().trim().min(1)).min(1, "Add at least one position."),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, signupSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const email = input.email.toLowerCase();
    let phone: string | null = null;
    if (input.phone) {
      phone = normalizePhone(input.phone);
      if (!phone) {
        return jsonErr(
          "invalid_phone",
          "That phone number doesn't look right. Use 10 digits, like (555) 123-4567.",
          400,
        );
      }
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
    });
    if (existing) {
      return jsonErr("account_exists", "An account with that email or phone already exists. Try logging in instead.", 409);
    }

    const positionNames = [...new Set(input.positions.map((p) => p.trim()).filter(Boolean))];
    const passwordHash = await hashPassword(input.password); // slow — keep it outside the transaction

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: input.businessName } });
      const location = await tx.location.create({
        data: { organizationId: organization.id, name: input.locationName, timezone: input.timezone },
      });
      await tx.position.createMany({
        data: positionNames.map((name, i) => ({ locationId: location.id, name, sortOrder: i })),
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: input.name,
          email,
          phone,
          passwordHash,
          role: "manager",
        },
      });
      return { organizationId: organization.id, locationId: location.id, userId: user.id };
    });

    return jsonOk(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `npx vitest run src/app/api/__tests__/signup.integration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing wizard component test**

Create `src/app/signup/__tests__/signup-wizard.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignupWizard } from "@/app/signup/SignupWizard";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

describe("SignupWizard", () => {
  it("starts on the details step", () => {
    render(<SignupWizard />);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Your name")).toBeTruthy();
  });

  it("blocks continue until the details are valid", async () => {
    render(<SignupWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("moves to the business step when details are valid", async () => {
    render(<SignupWizard />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jamie Park" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jamie@harborvine.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Step 2 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Business name")).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/app/signup/__tests__/signup-wizard.test.tsx`
Expected: FAIL — cannot resolve `@/app/signup/SignupWizard`.

- [ ] **Step 7: Implement the wizard**

Create `src/app/signup/SignupWizard.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";

const DEFAULT_POSITIONS = ["Line cook", "Server", "Dishwasher", "Host"];
const STEP_TITLES = ["Your details", "Your business", "Your first location", "Positions"];

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "password" | "businessName" | "locationName" | "timezone" | "positions" | "form", string>
>;

export function SignupWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [positions, setPositions] = useState<string[]>(DEFAULT_POSITIONS);
  const [newPosition, setNewPosition] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const timezoneOptions = useMemo(
    () => Intl.supportedValuesOf("timeZone").map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") })),
    [],
  );

  function validateStep(current: number): FieldErrors {
    const next: FieldErrors = {};
    if (current === 0) {
      if (!name.trim()) next.name = "Enter your name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
      if (phone.trim() && phone.trim().replace(/\D/g, "").length < 10) {
        next.phone = "That phone number doesn't look right. Use 10 digits, like (555) 123-4567.";
      }
      if (password.length < 8) next.password = "Password needs at least 8 characters.";
    }
    if (current === 1 && !businessName.trim()) next.businessName = "Enter your business name.";
    if (current === 2) {
      if (!locationName.trim()) next.locationName = "Enter a location name.";
      if (!timezone) next.timezone = "Choose a timezone.";
    }
    if (current === 3 && positions.length === 0) next.positions = "Add at least one position.";
    return next;
  }

  function handleContinue() {
    const stepErrors = validateStep(step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep(step + 1);
  }

  function addPosition() {
    const value = newPosition.trim();
    if (!value) return;
    if (positions.some((p) => p.toLowerCase() === value.toLowerCase())) {
      setErrors({ positions: `"${value}" is already on the list.` });
      return;
    }
    setPositions([...positions, value]);
    setNewPosition("");
    setErrors({});
  }

  async function handleSubmit() {
    const stepErrors = validateStep(3);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setSubmitting(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        businessName: businessName.trim(),
        locationName: locationName.trim(),
        timezone,
        positions,
      }),
    });
    const body = await res.json();
    if (!body.ok) {
      setSubmitting(false);
      setErrors({ form: body.error.message });
      return;
    }
    const signInRes = await signIn("credentials", {
      identifier: email.trim(),
      password,
      redirect: false,
    });
    if (signInRes?.error) {
      setSubmitting(false);
      setErrors({ form: "Your account was created, but logging in failed. Go to the login page and use your new details." });
      return;
    }
    window.location.assign("/manager");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "72px 24px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-brand)" }}>RosterHouse</div>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 3) handleContinue();
              else void handleSubmit();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Step {step + 1} of 4
              </div>
              <h1 style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                {STEP_TITLES[step]}
              </h1>
            </div>

            {step === 0 && (
              <>
                <Input label="Your name" placeholder="Jamie Park" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
                <Input label="Email" placeholder="jamie@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
                <Input label="Phone (optional)" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
                <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
              </>
            )}

            {step === 1 && (
              <Input label="Business name" placeholder="Harbor & Vine" value={businessName} onChange={(e) => setBusinessName(e.target.value)} error={errors.businessName} />
            )}

            {step === 2 && (
              <>
                <Input label="Location name" placeholder="Downtown" value={locationName} onChange={(e) => setLocationName(e.target.value)} error={errors.locationName} />
                <Select label="Timezone" value={timezone} onChange={setTimezone} options={timezoneOptions} placeholder="Choose a timezone" />
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  All shift times are shown in this location's timezone.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  These are the roles you schedule people into. You can add more later.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {positions.map((position) => (
                    <Tag key={position} onRemove={() => setPositions(positions.filter((p) => p !== position))}>
                      {position}
                    </Tag>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Input label="Add a position" placeholder="Bartender" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
                  </div>
                  <Button variant="secondary" type="button" onClick={addPosition}>
                    Add
                  </Button>
                </div>
                {errors.positions && (
                  <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{errors.positions}</p>
                )}
              </>
            )}

            {errors.form && (
              <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{errors.form}</p>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              {step > 0 ? (
                <Button variant="ghost" type="button" onClick={() => { setErrors({}); setStep(step - 1); }}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button variant="primary" type="submit" disabled={submitting}>
                {step < 3 ? "Continue" : submitting ? "Creating your account…" : "Create account"}
              </Button>
            </div>
          </form>
        </Card>
        <div style={{ textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--text-brand)", fontWeight: 600 }}>
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
```

Create `src/app/signup/page.tsx`:

```tsx
import type { Metadata } from "next";
import { SignupWizard } from "./SignupWizard";

export const metadata: Metadata = { title: "Create your account — RosterHouse" };

export default function SignupPage() {
  return <SignupWizard />;
}
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `npx vitest run src/app/signup/__tests__/signup-wizard.test.tsx src/app/api/__tests__/signup.integration.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 9: Manual QA of the full flow**

With `npm run dev` running and signed out (`http://localhost:3000/api/auth/signout`):
1. Visit `/signup`. Complete all four steps with a fresh email (e.g. `owner@testcafe.local`), business "Test Cafe", location "Main St", your local timezone, default positions plus one added ("Bartender") and one removed.
2. Click "Create account" → you land on `/manager` signed in as the new manager.
3. Re-run signup with the same email → the form shows "An account with that email or phone already exists. Try logging in instead."

- [ ] **Step 10: Commit**

```bash
git add src/app/signup src/app/api/auth/signup src/app/api/__tests__/signup.integration.test.ts
git commit -m "feat: add manager signup wizard with org/location/positions bootstrap"
```

---

### Task 9: Invite API — create, resolve, accept

**Files:**
- Create: `src/lib/invites.ts`
- Create: `src/app/api/locations/[locationId]/invites/route.ts`
- Create: `src/app/api/invites/[token]/route.ts`
- Create: `src/app/api/invites/[token]/accept/route.ts`
- Test: `src/app/api/__tests__/invites.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 envelope helpers; Task 2 `normalizePhone`/`hashPassword`; Task 3 `assertLocationMember`; Task 4 `apiUser`; `prisma` from `@/lib/db`.
- Produces:
  - `getInviteByToken(token: string): Promise<ResolvedInvite | null>` in `@/lib/invites`, where `ResolvedInvite = { token: string; locationName: string; organizationName: string; inviterName: string; positionName: string | null; inviteeName: string | null; status: "pending" | "accepted" | "expired" }` — Task 10's page consumes this.
  - `POST /api/locations/[locationId]/invites` (manager only) — body `{ name, contact, positionId }` (`contact` is phone or email; classified by `@`) → `201 { ok: true, data: { inviteId, token, inviteUrl } }`. Token via `crypto.randomUUID()`; expires in 14 days. v1 delivery is the copyable `inviteUrl` (SMS arrives with the Phase 5 notifier).
  - `GET /api/invites/[token]` (public) → `200 { ok: true, data: ResolvedInvite }` or `404 invite_not_found` / `410 invite_used` / `410 invite_expired`.
  - `POST /api/invites/[token]/accept` (public) — body `{ name, phone, password }` → creates User (employee) + EmployeeProfile (active) + EmployeePosition row and marks the invite accepted, all in one transaction → `201 { ok: true, data: { signedUp: true } }`. Errors: `400 invalid_phone`, `404 invite_not_found`, `409 phone_taken`, `410 invite_used` / `invite_expired`.

- [ ] **Step 1: Write the failing integration test**

Create `src/app/api/__tests__/invites.integration.test.ts`. It mocks `@/lib/auth` (so no real session machinery runs) and hits the real docker DB:

```ts
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/authz";

vi.mock("@/lib/auth", () => ({ apiUser: vi.fn() }));
import { apiUser } from "@/lib/auth";
import { POST as createInvite } from "@/app/api/locations/[locationId]/invites/route";
import { GET as resolveInvite } from "@/app/api/invites/[token]/route";
import { POST as acceptInvite } from "@/app/api/invites/[token]/accept/route";

const apiUserMock = vi.mocked(apiUser);
const suffix = `invites-${Date.now()}`;

let orgId: string;
let otherOrgId: string;
let locationId: string;
let positionId: string;
let managerId: string;
let otherManagerId: string;

function asManager() {
  apiUserMock.mockResolvedValue({ id: managerId, name: "Manager", role: "manager", organizationId: orgId });
}

function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

function jsonPost(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Invite Org ${suffix}` } });
  const otherOrg = await prisma.organization.create({ data: { name: `Other Org ${suffix}` } });
  orgId = org.id;
  otherOrgId = otherOrg.id;
  const location = await prisma.location.create({
    data: { organizationId: org.id, name: "Downtown", timezone: "America/New_York" },
  });
  locationId = location.id;
  const position = await prisma.position.create({ data: { locationId, name: "Server" } });
  positionId = position.id;
  const passwordHash = await hashPassword("rosterhouse1");
  const manager = await prisma.user.create({
    data: { organizationId: org.id, name: "Manager", email: `mgr-${suffix}@test.local`, passwordHash, role: "manager" },
  });
  managerId = manager.id;
  const otherManager = await prisma.user.create({
    data: { organizationId: otherOrg.id, name: "Other", email: `other-${suffix}@test.local`, passwordHash, role: "manager" },
  });
  otherManagerId = otherManager.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await prisma.$disconnect();
});

describe("POST /api/locations/[locationId]/invites", () => {
  it("creates a pending invite with a copyable link", async () => {
    asManager();
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, {
        name: "Riley Quinn",
        contact: "(555) 010-2222",
        positionId,
      }),
      params({ locationId }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.inviteUrl).toBe(`http://test.local/invite/${body.data.token}`);

    const invite = await prisma.invite.findUnique({ where: { token: body.data.token } });
    expect(invite!.status).toBe("pending");
    expect(invite!.phone).toBe("+15550102222");
    expect(invite!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1000);
  });

  it("returns 401 when signed out", async () => {
    apiUserMock.mockResolvedValue(null);
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, { name: "A", contact: "a@b.co", positionId }),
      params({ locationId }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for employees", async () => {
    apiUserMock.mockResolvedValue({ id: managerId, name: "E", role: "employee", organizationId: orgId });
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, { name: "A", contact: "a@b.co", positionId }),
      params({ locationId }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for a manager from another org (tenancy)", async () => {
    apiUserMock.mockResolvedValue({ id: otherManagerId, name: "Other", role: "manager", organizationId: otherOrgId });
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, { name: "A", contact: "a@b.co", positionId }),
      params({ locationId }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/invites/[token]", () => {
  it("resolves a pending invite for the landing page", async () => {
    asManager();
    const created = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, {
        name: "Casey Fox",
        contact: `casey-${suffix}@test.local`,
        positionId,
      }),
      params({ locationId }),
    );
    const { data } = await created.json();
    const res = await resolveInvite(new Request(`http://test.local/api/invites/${data.token}`), params({ token: data.token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      locationName: "Downtown",
      inviterName: "Manager",
      positionName: "Server",
      inviteeName: "Casey Fox",
      status: "pending",
    });
  });

  it("404s an unknown token", async () => {
    const res = await resolveInvite(new Request("http://test.local/api/invites/nope"), params({ token: "nope" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/invites/[token]/accept", () => {
  async function freshInvite() {
    asManager();
    const created = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, {
        name: "New Hire",
        contact: `hire-${Date.now()}@test.local`,
        positionId,
      }),
      params({ locationId }),
    );
    const { data } = await created.json();
    return data.token as string;
  }

  it("creates user, profile, and qualification in one transaction, then marks the invite accepted", async () => {
    const token = await freshInvite();
    const phone = `+1777${String(Date.now()).slice(-7)}`;
    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "New Hire", phone, password: "rosterhouse1" }),
      params({ token }),
    );
    expect(res.status).toBe(201);

    const user = await prisma.user.findFirst({ where: { phone } });
    expect(user!.role).toBe("employee");
    expect(user!.organizationId).toBe(orgId);
    await expect(verifyPassword("rosterhouse1", user!.passwordHash)).resolves.toBe(true);

    const profile = await prisma.employeeProfile.findFirst({ where: { userId: user!.id } });
    expect(profile!.locationId).toBe(locationId);
    expect(profile!.primaryPositionId).toBe(positionId);
    expect(profile!.status).toBe("active");

    const qualifications = await prisma.employeePosition.findMany({ where: { employeeProfileId: profile!.id } });
    expect(qualifications.map((q) => q.positionId)).toEqual([positionId]);

    const invite = await prisma.invite.findUnique({ where: { token } });
    expect(invite!.status).toBe("accepted");
  });

  it("410s a second acceptance of the same invite", async () => {
    const token = await freshInvite();
    const phone = `+1888${String(Date.now()).slice(-7)}`;
    await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "A", phone, password: "rosterhouse1" }),
      params({ token }),
    );
    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "B", phone: `+1889${String(Date.now()).slice(-7)}`, password: "rosterhouse1" }),
      params({ token }),
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe("invite_used");
  });

  it("409s a phone number that is already on an account", async () => {
    const firstToken = await freshInvite();
    const secondToken = await freshInvite();
    const phone = `+1666${String(Date.now()).slice(-7)}`;

    const first = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${firstToken}/accept`, { name: "First", phone, password: "rosterhouse1" }),
      params({ token: firstToken }),
    );
    expect(first.status).toBe(201);

    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${secondToken}/accept`, { name: "Second", phone, password: "rosterhouse1" }),
      params({ token: secondToken }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("phone_taken");
  });

  it("400s an unparseable phone", async () => {
    const token = await freshInvite();
    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "A", phone: "12", password: "rosterhouse1" }),
      params({ token }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_phone");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/__tests__/invites.integration.test.ts`
Expected: FAIL — route modules do not exist.

- [ ] **Step 3: Implement `src/lib/invites.ts`**

```ts
import { prisma } from "@/lib/db";

export type ResolvedInvite = {
  token: string;
  locationName: string;
  organizationName: string;
  inviterName: string;
  positionName: string | null;
  inviteeName: string | null;
  status: "pending" | "accepted" | "expired";
};

/** Shared by GET /api/invites/[token] and the /invite/[token] page. */
export async function getInviteByToken(token: string): Promise<ResolvedInvite | null> {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      location: { include: { organization: true } },
      invitedBy: true,
      position: true,
    },
  });
  if (!invite) return null;

  const expired =
    invite.status === "expired" || (invite.expiresAt !== null && invite.expiresAt.getTime() < Date.now());

  return {
    token: invite.token,
    locationName: invite.location.name,
    organizationName: invite.location.organization.name,
    inviterName: invite.invitedBy.name,
    positionName: invite.position?.name ?? null,
    inviteeName: invite.name,
    status: invite.status === "accepted" ? "accepted" : expired ? "expired" : "pending",
  };
}
```

- [ ] **Step 4: Implement the three route handlers**

Create `src/app/api/locations/[locationId]/invites/route.ts`:

```ts
import { randomUUID } from "crypto";
import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { assertLocationMember } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter the employee's name."),
  contact: z.string().trim().min(1, "Enter a phone number or email."),
  positionId: z.string().min(1, "Choose a position."),
});

export async function POST(req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  try {
    const { locationId } = await params;
    const user = await apiUser();
    if (!user) return jsonErr("unauthorized", "You need to log in to do that.", 401);
    if (user.role !== "manager") return jsonErr("forbidden", "Only managers can invite employees.", 403);
    await assertLocationMember(user.id, locationId);

    const parsed = await parseJson(req, inviteSchema);
    if (parsed.error) return parsed.error;
    const { name, contact, positionId } = parsed.data;

    let email: string | null = null;
    let phone: string | null = null;
    if (contact.includes("@")) {
      email = contact.toLowerCase();
    } else {
      phone = normalizePhone(contact);
      if (!phone) {
        return jsonErr("invalid_contact", "That doesn't look like a phone number or an email address.", 400);
      }
    }

    const position = await prisma.position.findFirst({ where: { id: positionId, locationId } });
    if (!position) return jsonErr("position_not_found", "That position doesn't exist at this location.", 404);

    const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
    const invite = await prisma.invite.create({
      data: {
        organizationId: location.organizationId,
        locationId,
        invitedByUserId: user.id,
        positionId,
        name,
        email,
        phone,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // v1 delivery: the manager copies this link into a text or email.
    // SMS delivery lands with the Phase 5 notifier.
    const inviteUrl = `${new URL(req.url).origin}/invite/${invite.token}`;
    return jsonOk({ inviteId: invite.id, token: invite.token, inviteUrl }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
```

Create `src/app/api/invites/[token]/route.ts`:

```ts
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { getInviteByToken } from "@/lib/invites";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const invite = await getInviteByToken(token);
    if (!invite) return jsonErr("invite_not_found", "That invite link isn't valid.", 404);
    if (invite.status === "accepted") {
      return jsonErr("invite_used", "That invite has already been used. Try logging in instead.", 410);
    }
    if (invite.status === "expired") {
      return jsonErr("invite_expired", "That invite has expired. Ask your manager to send a new one.", 410);
    }
    return jsonOk(invite);
  } catch (err) {
    return handleApiError(err);
  }
}
```

Create `src/app/api/invites/[token]/accept/route.ts`:

```ts
import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { hashPassword } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

const acceptSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  phone: z.string().trim().min(1, "Enter your phone number."),
  password: z.string().min(8, "Password needs at least 8 characters."),
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const parsed = await parseJson(req, acceptSchema);
    if (parsed.error) return parsed.error;
    const { name, password } = parsed.data;

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return jsonErr("invalid_phone", "That phone number doesn't look right. Use 10 digits, like (555) 123-4567.", 400);
    }

    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return jsonErr("invite_not_found", "That invite link isn't valid.", 404);
    if (invite.status === "accepted") {
      return jsonErr("invite_used", "That invite has already been used. Try logging in instead.", 410);
    }
    if (invite.status === "expired" || (invite.expiresAt !== null && invite.expiresAt.getTime() < Date.now())) {
      return jsonErr("invite_expired", "That invite has expired. Ask your manager to send a new one.", 410);
    }

    const phoneTaken = await prisma.user.findFirst({ where: { phone } });
    if (phoneTaken) {
      return jsonErr("phone_taken", "That phone number is already on an account. Try logging in instead.", 409);
    }

    const passwordHash = await hashPassword(password); // slow — outside the transaction

    await prisma.$transaction(async (tx) => {
      // The invitee didn't choose the invite's email; if it's taken, drop it
      // rather than block them — they log in by phone.
      let email = invite.email?.toLowerCase() ?? null;
      if (email) {
        const emailTaken = await tx.user.findFirst({ where: { email } });
        if (emailTaken) email = null;
      }

      const user = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          name,
          email,
          phone,
          passwordHash,
          role: "employee",
        },
      });
      const profile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          locationId: invite.locationId,
          primaryPositionId: invite.positionId,
          status: "active",
        },
      });
      if (invite.positionId) {
        await tx.employeePosition.create({
          data: { employeeProfileId: profile.id, positionId: invite.positionId },
        });
      }
      await tx.invite.update({ where: { id: invite.id }, data: { status: "accepted" } });
    });

    return jsonOk({ signedUp: true }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/api/__tests__/invites.integration.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/invites.ts src/app/api/locations src/app/api/invites src/app/api/__tests__/invites.integration.test.ts
git commit -m "feat: add invite create/resolve/accept API with copyable-link delivery"
```

---

### Task 10: `/invite/[token]` accept page

Design reference: `AcceptInviteScreen` in `"RosterHouse Design System/ui_kits/employee-mobile/EmployeeApp.jsx"` — "Accept invite" heading, "{inviter} invited you to join **{location}** on RosterHouse" copy, Full name / Phone number / Create password inputs, full-width "Join team" button. This implementation adds what the export omitted: invalid/used/expired states, field validation, server-error surfacing, and a real form.

**Files:**
- Create: `src/app/invite/[token]/page.tsx` (server component)
- Create: `src/app/invite/[token]/AcceptInviteForm.tsx` (client)
- Test: `src/app/invite/[token]/__tests__/accept-invite-form.test.tsx`

**Interfaces:**
- Consumes: `getInviteByToken`/`ResolvedInvite` (Task 9); `POST /api/invites/[token]/accept` (Task 9); `signIn` from `next-auth/react` (Task 4); `Button`/`Input` primitives; seed demo invite `demo-invite-riley` (Task 6) for manual QA.
- Produces: public page `/invite/[token]` with four states (pending form / not found / used / expired). After a successful join it signs in with the phone number and hard-navigates to `/`.

- [ ] **Step 1: Write the failing component test**

Create `src/app/invite/[token]/__tests__/accept-invite-form.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AcceptInviteForm } from "@/app/invite/[token]/AcceptInviteForm";

const signInMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn: signInMock }));

function renderForm() {
  return render(
    <AcceptInviteForm
      token="tok-1"
      inviterName="Jamie Park"
      locationName="Downtown"
      positionName="Server"
      defaultName="Riley Quinn"
    />,
  );
}

beforeEach(() => {
  signInMock.mockReset();
  vi.unstubAllGlobals();
});

describe("AcceptInviteForm", () => {
  it("explains who invited you and where", () => {
    renderForm();
    expect(screen.getByText(/invited you to join/)).toBeTruthy();
    expect(screen.getByText("Downtown")).toBeTruthy();
  });

  it("validates fields before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Join team" }));
    expect(await screen.findByText("Enter your name.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the server's message when the phone is taken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: false,
            error: { code: "phone_taken", message: "That phone number is already on an account. Try logging in instead." },
          }),
      }),
    );
    renderForm();
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "(555) 123-4567" } });
    fireEvent.change(screen.getByLabelText("Create password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Join team" }));
    expect(
      await screen.findByText("That phone number is already on an account. Try logging in instead."),
    ).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/invite/[token]/__tests__/accept-invite-form.test.tsx"`
Expected: FAIL — cannot resolve `@/app/invite/[token]/AcceptInviteForm`.

- [ ] **Step 3: Implement the form**

Create `src/app/invite/[token]/AcceptInviteForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  token: string;
  inviterName: string;
  locationName: string;
  positionName: string | null;
  defaultName: string;
};

type FieldErrors = { name?: string; phone?: string; password?: string; form?: string };

export function AcceptInviteForm({ token, inviterName, locationName, positionName, defaultName }: Props) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!phone.trim()) next.phone = "Enter your phone number.";
    if (password.length < 8) next.password = "Password needs at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const res = await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password }),
    });
    const body = await res.json();
    if (!body.ok) {
      setSubmitting(false);
      const { code, message } = body.error;
      if (code === "invalid_phone" || code === "phone_taken") setErrors({ phone: message });
      else setErrors({ form: message });
      return;
    }

    const signInRes = await signIn("credentials", {
      identifier: phone.trim(),
      password,
      redirect: false,
    });
    if (signInRes?.error) {
      setSubmitting(false);
      setErrors({
        form: "Your account was created, but logging in failed. Go to the login page and use your phone number and password.",
      });
      return;
    }
    window.location.assign("/");
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "48px 24px 24px",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Accept invite
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        {inviterName} invited you to join <strong style={{ color: "var(--text-primary)" }}>{locationName}</strong> on
        RosterHouse{positionName ? ` as a ${positionName.toLowerCase()}` : ""}.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Full name" placeholder="Maria Garcia" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Phone number" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        <Input label="Create password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        {errors.form && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{errors.form}</p>
        )}
        <Button variant="primary" fullWidth size="lg" type="submit" disabled={submitting}>
          {submitting ? "Joining…" : "Join team"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Implement the server page with its problem states**

Create `src/app/invite/[token]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getInviteByToken } from "@/lib/invites";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata: Metadata = { title: "Accept invite — RosterHouse" };

function InviteProblem({ title, description }: { title: string; description: string }) {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "72px 24px 24px",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{description}</p>
      <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
        Go to log in
      </Link>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <InviteProblem
        title="This invite link isn't valid"
        description="Check that you copied the whole link from your message, or ask your manager to send a new one."
      />
    );
  }
  if (invite.status === "accepted") {
    return (
      <InviteProblem
        title="This invite was already used"
        description="If that was you, log in with your phone number and password."
      />
    );
  }
  if (invite.status === "expired") {
    return <InviteProblem title="This invite has expired" description="Ask your manager to send a new one." />;
  }

  return (
    <AcceptInviteForm
      token={invite.token}
      inviterName={invite.inviterName}
      locationName={invite.locationName}
      positionName={invite.positionName}
      defaultName={invite.inviteeName ?? ""}
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run "src/app/invite/[token]/__tests__/accept-invite-form.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 6: Manual QA with the seeded demo invite**

With `npm run dev` running and signed out:
1. Visit `http://localhost:3000/invite/demo-invite-riley` → the form shows "Jamie Park invited you to join Downtown on RosterHouse as a server." with "Riley Quinn" prefilled.
2. Join with phone `(555) 010-0112` and password `rosterhouse1` → you land on `/` as Riley.
3. Sign out, revisit the same URL → "This invite was already used".
4. Visit `http://localhost:3000/invite/not-a-token` → "This invite link isn't valid".
5. Re-run `npm run db:seed` to restore the demo invite.

- [ ] **Step 7: Commit**

```bash
git add src/app/invite
git commit -m "feat: add invite accept page with pending/used/expired/invalid states"
```

---

### Task 11: Team page + team API

Design reference: the `team` view in `"RosterHouse Design System/ui_kits/manager-web/ManagerApp.jsx"` — a stack of Cards with `AvatarStatus`, name, and role line. The export's team view is read-only (blocker #2 in the findings); this task adds the invite dialog, the member edit dialog, and pending-invite rows with copyable links.

**Files:**
- Create: `src/lib/team.ts`
- Create: `src/app/api/locations/[locationId]/team/route.ts`
- Create: `src/app/api/employee-profiles/[id]/route.ts`
- Create: `src/app/manager/team/page.tsx`
- Create: `src/app/manager/team/TeamView.tsx`
- Create: `src/app/manager/team/loading.tsx`
- Create: `src/app/manager/team/error.tsx`
- Test: `src/app/api/__tests__/team.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 envelope helpers; Task 3 `assertLocationMember`/`getManagerLocation`; Task 4 `apiUser`/`requireManager`; Task 9's `POST /api/locations/[locationId]/invites` (the invite dialog calls it); primitives `Button`/`Input`/`Select`/`Checkbox`/`Dialog`/`Card`/`Badge`/`AvatarStatus`/`EmptyState`/`Spinner`/`useToast`.
- Produces:
  - `getTeam(locationId: string): Promise<TeamMember[]>` and `getPendingInvites(locationId: string): Promise<PendingInvite[]>` in `@/lib/team`, where
    `TeamMember = { id: string; userId: string; name: string; email: string | null; phone: string | null; status: "invited"|"active"|"inactive"; primaryPositionId: string | null; primaryPositionName: string | null; positionIds: string[]; hourlyRate: number | null }` (`id` is the EmployeeProfile id) and
    `PendingInvite = { id: string; name: string | null; contact: string; positionName: string | null; token: string; createdAt: string }`.
    Phase 3's assign dialog may reuse `getTeam` for the employee picker.
  - `GET /api/locations/[locationId]/team` (manager only) → `200 { ok: true, data: { members: TeamMember[] } }`.
  - `PATCH /api/employee-profiles/[id]` (manager only, tenancy-checked) — body `{ primaryPositionId?: string|null, positionIds?: string[], hourlyRate?: number|null, status?: "active"|"inactive" }` → `200 { ok: true, data: { member: TeamMember } }`. Replaces the qualification join rows when `positionIds` is present; auto-includes the primary position; validates all positions belong to the member's location.
  - `/manager/team` page with loading/empty/error states, invite dialog (shows the copyable link on success), member edit dialog (primary position, qualified-position checkboxes, hourly rate, deactivate/reactivate with calm confirmation).

- [ ] **Step 1: Write the failing integration test**

Create `src/app/api/__tests__/team.integration.test.ts`:

```ts
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/authz";

vi.mock("@/lib/auth", () => ({ apiUser: vi.fn() }));
import { apiUser } from "@/lib/auth";
import { GET as getTeamRoute } from "@/app/api/locations/[locationId]/team/route";
import { PATCH as patchProfile } from "@/app/api/employee-profiles/[id]/route";

const apiUserMock = vi.mocked(apiUser);
const suffix = `team-${Date.now()}`;

let orgId: string;
let locationId: string;
let managerId: string;
let profileId: string;
let serverPositionId: string;
let hostPositionId: string;
let foreignPositionId: string;

function asManager() {
  apiUserMock.mockResolvedValue({ id: managerId, name: "Manager", role: "manager", organizationId: orgId });
}

function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

function jsonPatch(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Team Org ${suffix}` } });
  orgId = org.id;
  const location = await prisma.location.create({
    data: { organizationId: org.id, name: "Downtown", timezone: "America/New_York" },
  });
  locationId = location.id;

  const server = await prisma.position.create({ data: { locationId, name: "Server", sortOrder: 0 } });
  const host = await prisma.position.create({ data: { locationId, name: "Host", sortOrder: 1 } });
  serverPositionId = server.id;
  hostPositionId = host.id;

  // A position at a different location in the same org — must be rejected.
  const otherLocation = await prisma.location.create({
    data: { organizationId: org.id, name: "Uptown", timezone: "America/New_York" },
  });
  const foreign = await prisma.position.create({ data: { locationId: otherLocation.id, name: "Server", sortOrder: 0 } });
  foreignPositionId = foreign.id;

  const passwordHash = await hashPassword("rosterhouse1");
  const manager = await prisma.user.create({
    data: { organizationId: org.id, name: "Manager", email: `tm-${suffix}@test.local`, passwordHash, role: "manager" },
  });
  managerId = manager.id;

  const employee = await prisma.user.create({
    data: { organizationId: org.id, name: "Maria Garcia", phone: `+1444${String(Date.now()).slice(-7)}`, passwordHash, role: "employee" },
  });
  const profile = await prisma.employeeProfile.create({
    data: { userId: employee.id, locationId, primaryPositionId: serverPositionId, hourlyRate: "12.50", status: "active" },
  });
  profileId = profile.id;
  await prisma.employeePosition.create({ data: { employeeProfileId: profile.id, positionId: serverPositionId } });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("GET /api/locations/[locationId]/team", () => {
  it("returns the members with primary position name and numeric rate", async () => {
    asManager();
    const res = await getTeamRoute(new Request(`http://test.local/api/locations/${locationId}/team`), params({ locationId }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const member = body.data.members.find((m: { id: string }) => m.id === profileId);
    expect(member).toMatchObject({
      name: "Maria Garcia",
      status: "active",
      primaryPositionName: "Server",
      positionIds: [serverPositionId],
      hourlyRate: 12.5,
    });
  });

  it("403s employees", async () => {
    apiUserMock.mockResolvedValue({ id: managerId, name: "E", role: "employee", organizationId: orgId });
    const res = await getTeamRoute(new Request(`http://test.local/api/locations/${locationId}/team`), params({ locationId }));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/employee-profiles/[id]", () => {
  it("updates rate, qualifications, and primary position in one transaction", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, {
        primaryPositionId: hostPositionId,
        positionIds: [serverPositionId, hostPositionId],
        hourlyRate: 16.5,
      }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.primaryPositionId).toBe(hostPositionId);
    expect(body.data.member.hourlyRate).toBe(16.5);
    expect([...body.data.member.positionIds].sort()).toEqual([serverPositionId, hostPositionId].sort());
  });

  it("auto-includes the primary position in the qualification list", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, {
        primaryPositionId: hostPositionId,
        positionIds: [serverPositionId], // primary missing on purpose
      }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.positionIds).toContain(hostPositionId);
  });

  it("rejects a position from another location", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { positionIds: [foreignPositionId] }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("position_not_found");
  });

  it("deactivates a member", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { status: "inactive" }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.status).toBe("inactive");
  });

  it("404s an unknown profile", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch("http://test.local/api/employee-profiles/nope", { status: "inactive" }),
      params({ id: "nope" }),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/__tests__/team.integration.test.ts`
Expected: FAIL — route modules do not exist.

- [ ] **Step 3: Implement `src/lib/team.ts`**

```ts
import { prisma } from "@/lib/db";

export type TeamMember = {
  id: string; // EmployeeProfile id
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "invited" | "active" | "inactive";
  primaryPositionId: string | null;
  primaryPositionName: string | null;
  positionIds: string[];
  hourlyRate: number | null;
};

export type PendingInvite = {
  id: string;
  name: string | null;
  contact: string;
  positionName: string | null;
  token: string;
  createdAt: string; // ISO
};

/** Serializable team list — shared by the team page and GET .../team. */
export async function getTeam(locationId: string): Promise<TeamMember[]> {
  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId },
    include: { user: true, primaryPosition: true, positions: true },
    orderBy: { user: { name: "asc" } },
  });
  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.user.name,
    email: p.user.email,
    phone: p.user.phone,
    status: p.status,
    primaryPositionId: p.primaryPositionId,
    primaryPositionName: p.primaryPosition?.name ?? null,
    positionIds: p.positions.map((ep) => ep.positionId),
    hourlyRate: p.hourlyRate === null ? null : Number(p.hourlyRate),
  }));
}

export async function getPendingInvites(locationId: string): Promise<PendingInvite[]> {
  const invites = await prisma.invite.findMany({
    where: { locationId, status: "pending" },
    include: { position: true },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  return invites
    .filter((i) => i.expiresAt === null || i.expiresAt.getTime() > now)
    .map((i) => ({
      id: i.id,
      name: i.name,
      contact: i.email ?? i.phone ?? "",
      positionName: i.position?.name ?? null,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
    }));
}
```

- [ ] **Step 4: Implement the two route handlers**

Create `src/app/api/locations/[locationId]/team/route.ts`:

```ts
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { assertLocationMember } from "@/lib/authz";
import { getTeam } from "@/lib/team";

export async function GET(_req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  try {
    const { locationId } = await params;
    const user = await apiUser();
    if (!user) return jsonErr("unauthorized", "You need to log in to do that.", 401);
    if (user.role !== "manager") return jsonErr("forbidden", "Only managers can view the team list.", 403);
    await assertLocationMember(user.id, locationId);

    const members = await getTeam(locationId);
    return jsonOk({ members });
  } catch (err) {
    return handleApiError(err);
  }
}
```

Create `src/app/api/employee-profiles/[id]/route.ts`:

```ts
import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { assertLocationMember } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getTeam } from "@/lib/team";

const patchSchema = z.object({
  primaryPositionId: z.string().nullable().optional(),
  positionIds: z.array(z.string()).optional(),
  hourlyRate: z.number().min(0, "Hourly rate can't be negative.").nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await apiUser();
    if (!user) return jsonErr("unauthorized", "You need to log in to do that.", 401);
    if (user.role !== "manager") return jsonErr("forbidden", "Only managers can edit team members.", 403);

    const profile = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!profile) return jsonErr("profile_not_found", "That team member doesn't exist.", 404);
    await assertLocationMember(user.id, profile.locationId);

    const parsed = await parseJson(req, patchSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    // Every referenced position must belong to this member's location.
    const idsToCheck = new Set<string>([
      ...(input.positionIds ?? []),
      ...(input.primaryPositionId ? [input.primaryPositionId] : []),
    ]);
    if (idsToCheck.size > 0) {
      const count = await prisma.position.count({
        where: { id: { in: [...idsToCheck] }, locationId: profile.locationId },
      });
      if (count !== idsToCheck.size) {
        return jsonErr("position_not_found", "One of those positions doesn't exist at this location.", 400);
      }
    }

    // The primary position is always part of the qualified list.
    const effectivePrimary =
      input.primaryPositionId === undefined ? profile.primaryPositionId : input.primaryPositionId;
    let effectivePositions = input.positionIds;
    if (effectivePositions && effectivePrimary && !effectivePositions.includes(effectivePrimary)) {
      effectivePositions = [...effectivePositions, effectivePrimary];
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeProfile.update({
        where: { id },
        data: {
          ...(input.primaryPositionId !== undefined ? { primaryPositionId: input.primaryPositionId } : {}),
          ...(input.hourlyRate !== undefined ? { hourlyRate: input.hourlyRate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      if (effectivePositions) {
        await tx.employeePosition.deleteMany({ where: { employeeProfileId: id } });
        await tx.employeePosition.createMany({
          data: effectivePositions.map((positionId) => ({ employeeProfileId: id, positionId })),
        });
      } else if (input.primaryPositionId) {
        // Primary changed without an explicit list — make sure it's qualified.
        await tx.employeePosition.upsert({
          where: { employeeProfileId_positionId: { employeeProfileId: id, positionId: input.primaryPositionId } },
          update: {},
          create: { employeeProfileId: id, positionId: input.primaryPositionId },
        });
      }
    });

    const members = await getTeam(profile.locationId);
    const member = members.find((m) => m.id === id);
    return jsonOk({ member });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/api/__tests__/team.integration.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Implement the team page (server) with loading and error states**

Create `src/app/manager/team/page.tsx`:

```tsx
import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getPendingInvites, getTeam } from "@/lib/team";
import { TeamView } from "./TeamView";

export const metadata: Metadata = { title: "Team — RosterHouse" };

export default async function TeamPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);

  const [members, pendingInvites, positions] = await Promise.all([
    getTeam(location.id),
    getPendingInvites(location.id),
    prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <TeamView
      locationId={location.id}
      members={members}
      pendingInvites={pendingInvites}
      positions={positions.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
```

Create `src/app/manager/team/loading.tsx`:

```tsx
import { Spinner } from "@/components/ui/Spinner";

export default function TeamLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
      <Spinner />
    </div>
  );
}
```

Create `src/app/manager/team/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TeamError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="Something went wrong loading your team"
      description="Give it another try. If it keeps happening, check your connection."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
```

- [ ] **Step 7: Implement the client view with both dialogs**

Create `src/app/manager/team/TeamView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarStatus } from "@/components/ui/AvatarStatus";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import type { PendingInvite, TeamMember } from "@/lib/team";

type PositionOption = { id: string; name: string };

type Props = {
  locationId: string;
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  positions: PositionOption[];
};

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const AVATAR_STATUS: Record<TeamMember["status"], "available" | "pending" | "off"> = {
  active: "available",
  invited: "pending",
  inactive: "off",
};

export function TeamView({ locationId, members, pendingInvites, positions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Invite link copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", description: url, tone: "danger" });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
            Team
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
            {members.length === 1 ? "1 team member" : `${members.length} team members`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)}>
          Invite employee
        </Button>
      </div>

      {pendingInvites.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)" }}>
            Pending invites
          </h2>
          {pendingInvites.map((invite) => (
            <Card key={invite.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{invite.name ?? invite.contact}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {invite.contact}
                  {invite.positionName ? ` · ${invite.positionName}` : ""}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => copyInviteLink(invite.token)}>
                Copy link
              </Button>
            </Card>
          ))}
        </section>
      )}

      {members.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Invite your first employee to start building schedules."
          action={
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              Invite employee
            </Button>
          }
        />
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((member) => (
            <Card key={member.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <AvatarStatus name={member.name} status={AVATAR_STATUS[member.status]} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{member.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {member.primaryPositionName ?? "No position yet"}
                </div>
              </div>
              {member.status === "inactive" && <Badge tone="neutral">Deactivated</Badge>}
              {member.status === "invited" && <Badge tone="warning">Invited</Badge>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(member)}>
                Edit
              </Button>
            </Card>
          ))}
        </section>
      )}

      <InviteEmployeeDialog
        open={inviteOpen}
        locationId={locationId}
        positions={positions}
        onClose={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />
      {editing && (
        <EditMemberDialog
          member={editing}
          positions={positions}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            toast({ title: message, tone: "success" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function InviteEmployeeDialog({
  open,
  locationId,
  positions,
  onClose,
}: {
  open: boolean;
  locationId: string;
  positions: PositionOption[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function reset() {
    setName("");
    setContact("");
    setPositionId(positions[0]?.id ?? "");
    setError(null);
    setSubmitting(false);
    setInviteUrl(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleInvite() {
    setError(null);
    if (!name.trim()) return setError("Enter the employee's name.");
    if (!contact.trim()) return setError("Enter a phone number or email.");
    if (!positionId) return setError("Choose a position.");
    setSubmitting(true);
    const res = await fetch(`/api/locations/${locationId}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), contact: contact.trim(), positionId }),
    });
    const body = (await res.json()) as ApiEnvelope<{ inviteUrl: string }>;
    setSubmitting(false);
    if (!body.ok) return setError(body.error.message);
    setInviteUrl(body.data.inviteUrl);
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: "Invite link copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", description: "Select the link and copy it manually.", tone: "danger" });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={inviteUrl ? "Invite created" : "Invite employee"}
      footer={
        inviteUrl ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInvite} disabled={submitting}>
              {submitting ? "Creating…" : "Create invite"}
            </Button>
          </>
        )
      }
    >
      {inviteUrl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Text or email this link to {name.trim() || "your employee"}. It expires in 14 days.
          </p>
          <Input label="Invite link" value={inviteUrl} onChange={() => undefined} />
          <Button variant="secondary" onClick={copy}>
            Copy link
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Name" placeholder="Riley Quinn" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Phone or email"
            placeholder="(555) 123-4567"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Select
            label="Position"
            value={positionId}
            onChange={setPositionId}
            options={positions.map((p) => ({ value: p.id, label: p.name }))}
          />
          {error && (
            <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{error}</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function EditMemberDialog({
  member,
  positions,
  onClose,
  onSaved,
}: {
  member: TeamMember;
  positions: PositionOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [primaryPositionId, setPrimaryPositionId] = useState(member.primaryPositionId ?? "");
  const [positionIds, setPositionIds] = useState<string[]>(member.positionIds);
  const [hourlyRate, setHourlyRate] = useState(member.hourlyRate === null ? "" : String(member.hourlyRate));
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePosition(id: string, checked: boolean) {
    setPositionIds((current) => (checked ? [...current, id] : current.filter((p) => p !== id)));
  }

  async function patch(payload: Record<string, unknown>, successMessage: string) {
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/employee-profiles/${member.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as ApiEnvelope<{ member: TeamMember }>;
    setSubmitting(false);
    if (!body.ok) return setError(body.error.message);
    onSaved(successMessage);
  }

  async function handleSave() {
    if (hourlyRate.trim() !== "" && Number.isNaN(Number(hourlyRate))) {
      setError("Hourly rate needs to be a number, like 16.50.");
      return;
    }
    await patch(
      {
        primaryPositionId: primaryPositionId || null,
        positionIds,
        hourlyRate: hourlyRate.trim() === "" ? null : Number(hourlyRate),
      },
      "Changes saved",
    );
  }

  if (confirmingDeactivate) {
    return (
      <Dialog
        open
        onClose={() => setConfirmingDeactivate(false)}
        title={`Deactivate ${member.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingDeactivate(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => patch({ status: "inactive" }, `${member.name} deactivated`)} disabled={submitting}>
              {submitting ? "Deactivating…" : "Deactivate"}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          They'll no longer appear when you build schedules. You can reactivate them anytime.
        </p>
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)", marginTop: 10 }}>{error}</p>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={member.name}
      footer={
        <>
          {member.status === "inactive" ? (
            <Button variant="secondary" onClick={() => patch({ status: "active" }, `${member.name} reactivated`)} disabled={submitting}>
              Reactivate
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDeactivate(true)}>
              Deactivate
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select
          label="Primary position"
          value={primaryPositionId}
          onChange={setPrimaryPositionId}
          options={positions.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Choose a position"
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Qualified positions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {positions.map((p) => (
              <Checkbox
                key={p.id}
                label={p.name}
                checked={positionIds.includes(p.id)}
                onChange={(checked) => togglePosition(p.id, checked)}
              />
            ))}
          </div>
        </div>
        <Input label="Hourly rate ($)" placeholder="16.50" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{error}</p>
        )}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 8: Manual QA of the team flows**

With the seed loaded (`npm run db:seed`) and `npm run dev` running, logged in as `jamie@harborvine.test`:
1. Visit `/manager/team` → 10 members sorted by name; Maria shows "Line cook"; Morgan Reyes shows the "Deactivated" badge and an "off" avatar dot; "Pending invites" shows Riley Quinn with a working "Copy link" button (toast: "Invite link copied").
2. "Invite employee" → fill "Pat Doyle" / `pat@harborvine.test` / Server → "Create invite" → the dialog shows the copyable link; "Done" refreshes the list and Pat appears under pending invites.
3. Edit Maria → check "Dishwasher", set hourly rate 21, "Save changes" → toast "Changes saved"; reopening shows the new values.
4. Edit Jessie Chen → "Deactivate" → confirmation dialog → confirm → toast "Jessie Chen deactivated"; the row shows the badge. Reopen and "Reactivate" → toast "Jessie Chen reactivated".
5. Empty state: log in as a freshly signed-up manager (Task 8 QA account) and visit `/manager/team` → "No team members yet" with a working invite button.

- [ ] **Step 9: Commit**

```bash
git add src/lib/team.ts "src/app/api/locations/[locationId]/team" "src/app/api/employee-profiles" src/app/manager/team src/app/api/__tests__/team.integration.test.ts
git commit -m "feat: add team page with invite and member edit dialogs"
```

---

### Task 12: Phase verification gate

**Files:** none created — verification only (fix anything that fails, then re-run).

**Interfaces:**
- Consumes: everything above.
- Produces: a green Phase 2 — Phase 3 (manager scheduling) starts from this state.

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all Phase 1 + Phase 2 tests pass, 0 failures.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds. If the build warns that `middleware.ts` is deprecated in favor of `proxy.ts`, follow Task 5's rename note.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable only if pre-existing).

- [ ] **Step 4: End-to-end manual QA pass**

Reset and walk the whole loop (or run the `/qa` skill against `npm run dev` with this checklist):

```bash
docker compose up -d && npm run db:seed && npm run dev
```

1. Signed out: `/manager` → redirected to `/login`; `/` → `/login`; `/invite/demo-invite-riley` loads without a session.
2. Log in as `jamie@harborvine.test` / `rosterhouse1` → `/manager`. Visiting `/` or `/clock` bounces back to `/manager`. `/login` bounces to `/manager`.
3. Team flow: invite "Pat Doyle" (Server), copy the link, open it in a private window, join as Pat with a new phone + password → lands on `/` as Pat. In the private window, `/manager` bounces to `/`.
4. Sign out (`/api/auth/signout`); log in as `maria@harborvine.test` → `/` shows "Hi, Maria"; `/manager/team` bounces to `/`.
5. Signup: `/signup` end-to-end with a fresh email → lands on `/manager` for the new org; `/manager/team` shows the empty state.
6. Wrong password at login → "That phone/email or password doesn't match." — no redirect, no console errors.
7. `npm run db:seed` again → re-runs cleanly (restores Riley's demo invite; removes Pat, who belonged to the demo org).

- [ ] **Step 5: Repo hygiene and Railway note**

Run: `git status` → clean tree. Run: `git log --oneline -12` → one commit per task (Tasks 1–11).

Railway: before the next deploy, set `AUTH_SECRET` in the Railway service variables (generate a fresh one with `openssl rand -base64 32` — do not reuse the local value). `railway.json` already runs `prisma migrate deploy` pre-deploy and health-checks `/api/health`.

- [ ] **Step 6: Commit any QA fixes**

```bash
git add -A
git commit -m "fix: phase 2 QA fixes"   # only if QA required changes
```

---

## Notes for the plan executor

- **Task order matters:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Each task's Consumes block lists exactly what it needs from earlier tasks.
- **Do not redesign `prisma/schema.prisma`** — it is complete and migrated. All model/field/enum names in this plan match it exactly.
- **Do not translate the export's mock data or copy its onClick-div patterns.** The design export is a visual reference only; this plan deliberately fixes its defects (dead controls, missing states, free-text-everything).
- **jsdom component tests** use the `/** @vitest-environment jsdom */` pragma so they work regardless of the vitest default environment Phase 1 chose.
- **Integration tests** must start with `import "dotenv/config"` as the first import (the Prisma client reads `DATABASE_URL` at module load) and clean up their orgs in `afterAll` (org deletion cascades to everything).
