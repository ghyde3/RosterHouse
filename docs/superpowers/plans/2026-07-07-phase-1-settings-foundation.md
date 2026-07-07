# Settings Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the Templates nav entry with a Settings hub that edits location config (name/timezone/overtime/address) and re-homes the existing schedule-template management routes under `/manager/settings/templates`.

**Architecture:** A new `/manager/settings` route area gets a shared `layout.tsx` rendering a horizontal sub-nav (Location · Positions · Templates). The Location section is a client form that PATCHes a new `/api/locations/[locationId]` route (manager-guarded, tenancy-scoped, zod-validated with IANA timezone checking). The existing template list/editor routes physically move from `/manager/templates/**` to `/manager/settings/templates/**`, and every in-app link to the old path is repointed. The sidebar swaps the Templates entry for a Settings entry with a new gear glyph.

**Tech Stack:** Next.js 16, Prisma 7 + Postgres, zod 4, React 19, Vitest 4, CSS modules.

**Branch:** `feat/manager-settings` (already checked out), off the `feat/schedule-templates` HEAD.

## Global Constraints

- Next.js 16 App Router: route-handler dynamic params are `{ params: Promise<{ locationId: string }> }` and MUST be awaited; server pages receive `params`/`searchParams` as Promises and MUST await them.
- Tenancy on EVERY endpoint: `const guard = await requireManagerForApi(); if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);` then, when a `locationId` is in the path, `if (guard.location.id !== locationId) return jsonErr("forbidden", "You don't have access to this location", 403);`.
- JSON envelopes only: `jsonOk(data, status?)` → `{ok:true,data}`; `jsonErr(code,message,status)` → `{ok:false,error:{code,message}}`; wrap every handler body in `try { … } catch (err) { return handleApiError(err); }`. All from `@/lib/api`.
- Prisma: `import { prisma } from "@/lib/db";`. Generated types: `import { Prisma } from "@/generated/prisma/client";`.
- NO Tailwind. CSS modules + design tokens (`var(--…)`). Reuse existing tokens: `--text-h1-size`, `--text-h1-weight`, `--text-primary`, `--text-secondary`, `--surface-page`, `--surface-sunken`, `--border-default`, `--radius-sm`, `--radius-md`, `--space-2`..`--space-8`.
- UI kit (no barrel): import each from `@/components/ui/{Button,Select,Input,Icon}` and `useToast` from `@/components/ui/Toaster`. Call `useRouter().refresh()` after a successful mutation.
- Location config fields exposed now: `name` (non-empty), `timezone` (valid IANA zone), `overtimeHoursPerWeek` (nullable, non-negative int; blank ⇒ OT conflicts off), `address` (nullable). Geofence (lat/lng/radius) is deferred — do NOT touch it.
- Changing `timezone` retroactively shifts all wall-clock rendering, so the form MUST show a confirm before PATCHing a timezone change.
- Templates relocation is a MOVE: `git mv` the six template route files, repoint the three `/manager/templates` link literals, and delete nothing else. The schedule-builder Save/Apply dialogs are unchanged (they never link to `/manager/templates`).
- Tests: Vitest. DB-touching route tests live in `src/tests/` and mock auth with a hoisted session (see Task 3). Component tests live next to the component and mock `next/navigation` + `@/components/ui/Toaster` and stub `global.fetch`. Run one file with `npm test -- <path>`.
- Commit after EVERY task with a `feat:`/`test:`/`refactor:` message.
- Verify commands: `npm test` (vitest run), `npm run lint`, `npm run build` (runs `prisma generate` then `next build` — the typecheck gate).

---

## Task 1 — Add the `settings` gear glyph to the Icon set

**Files:**
- Modify: `src/components/ui/Icon.tsx`
- Test: `src/components/ui/Icon.test.tsx` (extend existing)

**Interfaces:**
- Produces: `IconName` union gains the member `"settings"`. `<Icon name="settings" />` renders an `<svg>`.
- Consumes: `Settings` from `lucide-react` (verified present in the installed version).

**Steps:**

1. - [ ] Write the failing test. Append this `it` block inside the existing `describe("Icon", …)` in `src/components/ui/Icon.test.tsx` (place it right after the first test that renders `name="calendar"`):

```tsx
  it("renders the settings gear glyph as an svg", () => {
    const { container } = render(<Icon name="settings" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
```

2. - [ ] Run it — expect FAIL (TypeScript/type error: `"settings"` is not assignable to `IconName`, or the icon is missing):

```
npm test -- src/components/ui/Icon.test.tsx
```

3. - [ ] Implement. In `src/components/ui/Icon.tsx`, add the `Settings` import to the alphabetical lucide import block (between `Repeat` and `Square`) and add the `"settings"` entry to the `ICONS` map (between `repeat` and `square`).

   Change the import block so the relevant lines read:

```tsx
  Play,
  Plus,
  Repeat,
  Settings,
  Square,
  Sun,
```

   Change the `ICONS` map so the relevant lines read:

```tsx
  play: Play,
  plus: Plus,
  repeat: Repeat,
  settings: Settings,
  square: Square,
  sun: Sun,
```

4. - [ ] Run it — expect PASS:

```
npm test -- src/components/ui/Icon.test.tsx
```

5. - [ ] Commit:

```
git add src/components/ui/Icon.tsx src/components/ui/Icon.test.tsx
git commit -m "feat: add settings gear glyph to Icon set"
```

---

## Task 2 — Swap the sidebar Templates entry for Settings

**Files:**
- Modify: `src/components/chrome/ManagerSidebar.tsx`
- Test: `src/components/chrome/chrome.test.tsx` (update the existing `ManagerSidebar` describe)

**Interfaces:**
- Consumes: `IconName` now includes `"settings"` (Task 1).
- Produces: `NAV` no longer contains `/manager/templates`; it contains `{ href: "/manager/settings", label: "Settings", icon: "settings" }`. Active-state logic is unchanged (prefix match via `pathname.startsWith(`${item.href}/`)`), so `/manager/settings/templates` keeps the Settings item active.

**Steps:**

1. - [ ] Write the failing test. In `src/components/chrome/chrome.test.tsx`, replace the first two `it` blocks of the `describe("ManagerSidebar", …)` (the "renders all six nav items as real links" and "marks the current section with aria-current" tests) with these updated versions. The `expected` list drops Templates and adds Settings; a new assertion proves Templates is gone and that a settings sub-route keeps Settings active:

```tsx
  it("renders all seven nav items as real links, with Settings replacing Templates", () => {
    pathnameMock.mockReturnValue("/manager");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    const expected: Array<[string, string]> = [
      ["Dashboard", "/manager"],
      ["Schedule", "/manager/schedule"],
      ["Settings", "/manager/settings"],
      ["Team", "/manager/team"],
      ["Availability", "/manager/availability"],
      ["Time off", "/manager/time-off"],
      ["Swaps & open shifts", "/manager/swaps"],
    ];
    for (const [name, href] of expected) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.queryByRole("link", { name: "Templates" })).not.toBeInTheDocument();
  });

  it("keeps Settings active on a settings sub-route (e.g. templates)", () => {
    pathnameMock.mockReturnValue("/manager/settings/templates");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current");
  });
```

2. - [ ] Run it — expect FAIL (there is no "Settings" link; the old "Templates" link still exists):

```
npm test -- src/components/chrome/chrome.test.tsx
```

3. - [ ] Implement. In `src/components/chrome/ManagerSidebar.tsx`, replace the single Templates line in the `NAV` array:

   Replace this line:

```tsx
  { href: "/manager/templates", label: "Templates", icon: "calendar-days" },
```

   with this line (note: it is placed where Templates was — between Schedule and Team — so Settings sits high in the nav, matching the spec's "all manager administration in one place"):

```tsx
  { href: "/manager/settings", label: "Settings", icon: "settings" },
```

4. - [ ] Run it — expect PASS:

```
npm test -- src/components/chrome/chrome.test.tsx
```

5. - [ ] Commit:

```
git add src/components/chrome/ManagerSidebar.tsx src/components/chrome/chrome.test.tsx
git commit -m "feat: replace Templates sidebar entry with Settings"
```

---

## Task 3 — `PATCH /api/locations/[locationId]` for location config

**Files:**
- Create: `src/lib/location-schemas.ts`
- Create: `src/app/api/locations/[locationId]/route.ts`
- Test: `src/tests/location-patch.api.test.ts`

**Interfaces:**
- Produces (`src/lib/location-schemas.ts`):
  - `IANA_TIMEZONES: Set<string>` — the set returned by `Intl.supportedValuesOf("timeZone")`, built once at module load.
  - `updateLocationSchema` — zod object:
    - `name: string` min 1 (message `"Enter a location name"`)
    - `timezone: string` refined to be in `IANA_TIMEZONES` (message `"Choose a valid time zone"`)
    - `overtimeHoursPerWeek: number | null` — integer ≥ 0 or `null` (message `"Overtime hours must be a whole number of 0 or more"`)
    - `address: string | null`
  - `UpdateLocationInput = z.infer<typeof updateLocationSchema>`
- Produces (`route.ts`): `PATCH(req, { params }: { params: Promise<{ locationId: string }> })` → `jsonOk({ location: { id, name, timezone, overtimeHoursPerWeek, address } })` on success; `403` on tenancy mismatch; `400` on bad input.
- Consumes: `requireManagerForApi` (`@/lib/manager-guard`), `parseJson`/`jsonOk`/`jsonErr`/`handleApiError` (`@/lib/api`), `prisma` (`@/lib/db`).

**Notes for the implementer:** `parseJson(req, schema)` (from `@/lib/api`) returns `{ data }` or `{ error }` (a ready 400 `Response`) and already prefixes the zod message with the field path (e.g. `"timezone: Choose a valid time zone"`). Mirror the tenancy check from `src/app/api/locations/[locationId]/schedule/route.ts`.

**Steps:**

1. - [ ] Write the failing test. Create `src/tests/location-patch.api.test.ts` with the full contents below. It follows the established route-integration pattern: hoisted `mockSession`, `vi.mock("@/lib/auth")`, seed manager (`jamie@harborvine.test`) for the happy path + tenancy owner, and a throwaway `createFixture()` org to prove cross-tenant 403. It restores the original location config in `afterAll` so it does not corrupt the shared seed DB.

```tsx
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
import { PATCH as patchLocation } from "@/app/api/locations/[locationId]/route";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let locationId: string;
let original: { name: string; timezone: string; overtimeHoursPerWeek: number | null; address: string | null };

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "PATCH",
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
  original = {
    name: location.name,
    timezone: location.timezone,
    overtimeHoursPerWeek: location.overtimeHoursPerWeek,
    address: location.address,
  };
});

afterAll(async () => {
  // Restore the shared seed location so other suites see original config.
  await prisma.location.update({ where: { id: locationId }, data: original });
});

describe("PATCH /api/locations/[locationId]", () => {
  it("updates name, timezone, overtime, and address", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: "Harbor & Vine — Downtown",
        timezone: "America/Los_Angeles",
        overtimeHoursPerWeek: 45,
        address: "500 Market St",
      }),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.location).toMatchObject({
      id: locationId,
      name: "Harbor & Vine — Downtown",
      timezone: "America/Los_Angeles",
      overtimeHoursPerWeek: 45,
      address: "500 Market St",
    });
    const row = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
    expect(row.timezone).toBe("America/Los_Angeles");
    expect(row.overtimeHoursPerWeek).toBe(45);
  });

  it("accepts a null overtimeHoursPerWeek (OT conflicts off)", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "America/New_York",
        overtimeHoursPerWeek: null,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.location.overtimeHoursPerWeek).toBeNull();
    expect(body.data.location.address).toBeNull();
  });

  it("rejects an invalid IANA timezone with 400", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "Mars/Olympus_Mons",
        overtimeHoursPerWeek: 40,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain("valid time zone");
  });

  it("rejects an empty name with 400", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: "   ",
        timezone: "America/New_York",
        overtimeHoursPerWeek: 40,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a negative overtimeHoursPerWeek with 400", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "America/New_York",
        overtimeHoursPerWeek: -5,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });

  it("401s when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "America/New_York",
        overtimeHoursPerWeek: 40,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(401);
    mockSession.current = saved;
  });

  it("403s when the manager doesn't own the target location", async () => {
    const orgB: Fixture = await createFixture();
    try {
      const res = await patchLocation(
        jsonRequest(`http://test/api/locations/${orgB.locationId}`, {
          name: "Hijack",
          timezone: "America/New_York",
          overtimeHoursPerWeek: 40,
          address: null,
        }),
        { params: Promise.resolve({ locationId: orgB.locationId }) },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
      // And the foreign location is untouched.
      const row = await prisma.location.findUniqueOrThrow({ where: { id: orgB.locationId } });
      expect(row.name).toBe("Test location");
    } finally {
      await destroyFixture(orgB);
    }
  });
});
```

2. - [ ] Run it — expect FAIL (module `@/app/api/locations/[locationId]/route` has no `PATCH` export yet):

```
npm test -- src/tests/location-patch.api.test.ts
```

3. - [ ] Implement the schema. Create `src/lib/location-schemas.ts` with the complete contents:

```ts
import { z } from "zod";

/**
 * Full IANA zone set from the runtime. Built once at import; used to validate
 * `timezone` on the location-config PATCH. Changing this field retroactively
 * shifts all wall-clock rendering, so it must be a zone the runtime knows.
 */
export const IANA_TIMEZONES = new Set<string>(Intl.supportedValuesOf("timeZone"));

export const updateLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Enter a location name" }),
  timezone: z
    .string()
    .refine((value) => IANA_TIMEZONES.has(value), { message: "Choose a valid time zone" }),
  overtimeHoursPerWeek: z
    .number()
    .int({ message: "Overtime hours must be a whole number of 0 or more" })
    .min(0, { message: "Overtime hours must be a whole number of 0 or more" })
    .nullable(),
  address: z.string().trim().max(500).nullable(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
```

4. - [ ] Implement the route. Create `src/app/api/locations/[locationId]/route.ts` with the complete contents:

```ts
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { updateLocationSchema } from "@/lib/location-schemas";

export async function PATCH(
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
    const parsed = await parseJson(req, updateLocationSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const updated = await prisma.location.update({
      where: { id: locationId },
      data: {
        name: input.name,
        timezone: input.timezone,
        overtimeHoursPerWeek: input.overtimeHoursPerWeek,
        address: input.address,
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        overtimeHoursPerWeek: true,
        address: true,
      },
    });
    return jsonOk({ location: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
```

5. - [ ] Run it — expect PASS (all seven `it` blocks green):

```
npm test -- src/tests/location-patch.api.test.ts
```

6. - [ ] Commit:

```
git add src/lib/location-schemas.ts src/app/api/locations/[locationId]/route.ts src/tests/location-patch.api.test.ts
git commit -m "feat: PATCH /api/locations/[locationId] for location config"
```

---

## Task 4 — Location config form (client component)

**Files:**
- Create: `src/app/manager/settings/LocationSettingsForm.tsx`
- Create: `src/app/manager/settings/settings.module.css`
- Test: `src/app/manager/settings/LocationSettingsForm.test.tsx`

**Interfaces:**
- Produces: `LocationSettingsForm` — a client component. Props:

```ts
export type LocationSettingsFormProps = {
  locationId: string;
  name: string;
  timezone: string;
  overtimeHoursPerWeek: number | null;
  address: string | null;
};
```

  - Renders an `Input` for name, a `Select` for timezone (`COMMON_US_TIMEZONES`), an `Input type="number"` for overtime (blank ⇒ null), an `Input` for address, and a primary Save `Button`.
  - On Save: if the chosen `timezone` differs from the initial prop value, `window.confirm("Changing the time zone changes how all existing times display. Save anyway?")` — if the manager cancels, abort without PATCHing. Otherwise PATCH `/api/locations/${locationId}` with `{ name, timezone, overtimeHoursPerWeek, address }` (overtime `""` → `null`, address `""` → `null`), then on success `toast({ tone: "success", … })` + `router.refresh()`; on `!body.ok` `toast({ tone: "danger", …, description: body.error.message })`.
- Produces (module): `COMMON_US_TIMEZONES: SelectOption[]` — a small exported list of common US zones for the Select.
- Consumes: `Button`, `Input`, `Select` (`SelectOption`), `useToast`, `useRouter`.

**Notes for the implementer:** Component tests mock `next/navigation` (`useRouter`) and `@/components/ui/Toaster` (`useToast`), and stub `global.fetch`. `window.confirm` is stubbed per-test with `vi.spyOn(window, "confirm")`. Reuse the `settings.module.css` you create here in Task 5's layout too.

**Steps:**

1. - [ ] Write the failing test. Create `src/app/manager/settings/LocationSettingsForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
const toastMock = vi.fn();
vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: toastMock }) }));

import { LocationSettingsForm } from "@/app/manager/settings/LocationSettingsForm";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, data: { location: {} } }), {
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  refreshMock.mockClear();
  toastMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

function renderForm() {
  return render(
    <LocationSettingsForm
      locationId="loc1"
      name="Harbor & Vine"
      timezone="America/New_York"
      overtimeHoursPerWeek={40}
      address="1 Dock St"
    />,
  );
}

describe("LocationSettingsForm", () => {
  it("prefills the current config", () => {
    renderForm();
    expect((screen.getByLabelText("Location name") as HTMLInputElement).value).toBe("Harbor & Vine");
    expect((screen.getByLabelText("Overtime threshold (hours/week)") as HTMLInputElement).value).toBe("40");
    expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe("1 Dock St");
  });

  it("PATCHes without a confirm when the timezone is unchanged", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/locations/loc1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      name: "New Name",
      timezone: "America/New_York",
      overtimeHoursPerWeek: 40,
      address: "1 Dock St",
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("confirms before saving a timezone change and aborts on cancel", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderForm();
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "America/Los_Angeles" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("sends null for a blank overtime and blank address", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.change(screen.getByLabelText("Overtime threshold (hours/week)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.overtimeHoursPerWeek).toBeNull();
    expect(body.address).toBeNull();
  });

  it("shows a danger toast when the API rejects", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: { code: "invalid_input", message: "Choose a valid time zone" } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock.mock.calls[0][0]).toMatchObject({ tone: "danger" });
  });
});
```

2. - [ ] Run it — expect FAIL (module `@/app/manager/settings/LocationSettingsForm` does not exist):

```
npm test -- src/app/manager/settings/LocationSettingsForm.test.tsx
```

3. - [ ] Implement the styles. Create `src/app/manager/settings/settings.module.css` with the complete contents (this file also serves Task 5's layout sub-nav):

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
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

.subnav {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-default);
  margin-bottom: var(--space-6);
}

.subnavLink {
  padding: var(--space-2) var(--space-3);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.subnavLinkActive {
  color: var(--text-primary);
  border-bottom-color: var(--text-primary);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 480px;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
```

4. - [ ] Implement the form. Create `src/app/manager/settings/LocationSettingsForm.tsx` with the complete contents:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import styles from "./settings.module.css";

/** Common US zones for the config Select. Server accepts any valid IANA zone. */
export const COMMON_US_TIMEZONES: SelectOption[] = [
  { value: "America/New_York", label: "Eastern — America/New_York" },
  { value: "America/Chicago", label: "Central — America/Chicago" },
  { value: "America/Denver", label: "Mountain — America/Denver" },
  { value: "America/Phoenix", label: "Mountain (no DST) — America/Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { value: "America/Anchorage", label: "Alaska — America/Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Pacific/Honolulu" },
];

export type LocationSettingsFormProps = {
  locationId: string;
  name: string;
  timezone: string;
  overtimeHoursPerWeek: number | null;
  address: string | null;
};

export function LocationSettingsForm({
  locationId,
  name: initialName,
  timezone: initialTimezone,
  overtimeHoursPerWeek: initialOvertime,
  address: initialAddress,
}: LocationSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [overtime, setOvertime] = useState(initialOvertime === null ? "" : String(initialOvertime));
  const [address, setAddress] = useState(initialAddress ?? "");
  const [saving, setSaving] = useState(false);

  // If the manager picked a zone not in the common list, add it so the Select
  // shows their current value instead of collapsing to the placeholder.
  const tzOptions: SelectOption[] = COMMON_US_TIMEZONES.some((o) => o.value === timezone)
    ? COMMON_US_TIMEZONES
    : [...COMMON_US_TIMEZONES, { value: timezone, label: timezone }];

  async function handleSave() {
    if (timezone !== initialTimezone) {
      const ok = window.confirm(
        "Changing the time zone changes how all existing times display. Save anyway?",
      );
      if (!ok) return;
    }
    const trimmedOvertime = overtime.trim();
    const trimmedAddress = address.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          timezone,
          overtimeHoursPerWeek: trimmedOvertime === "" ? null : Number(trimmedOvertime),
          address: trimmedAddress === "" ? null : trimmedAddress,
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Location saved" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save location",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <Input
        label="Location name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Select
        label="Time zone"
        value={timezone}
        options={tzOptions}
        onChange={(value) => setTimezone(value)}
      />
      <Input
        label="Overtime threshold (hours/week)"
        type="number"
        min={0}
        placeholder="Leave blank to turn off overtime conflicts"
        value={overtime}
        onChange={(e) => setOvertime(e.target.value)}
      />
      <Input
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
```

5. - [ ] Run it — expect PASS (all five `it` blocks green):

```
npm test -- src/app/manager/settings/LocationSettingsForm.test.tsx
```

6. - [ ] Commit:

```
git add src/app/manager/settings/LocationSettingsForm.tsx src/app/manager/settings/settings.module.css src/app/manager/settings/LocationSettingsForm.test.tsx
git commit -m "feat: location config form for manager settings"
```

---

## Task 5 — Settings layout (sub-nav) + Location page

**Files:**
- Create: `src/app/manager/settings/layout.tsx`
- Create: `src/app/manager/settings/SettingsSubnav.tsx`
- Create: `src/app/manager/settings/page.tsx`
- Test: `src/app/manager/settings/SettingsSubnav.test.tsx`

**Interfaces:**
- Produces (`SettingsSubnav.tsx`): a `"use client"` component `SettingsSubnav` (no props) rendering three links — Location (`/manager/settings`), Positions (`/manager/settings/positions`), Templates (`/manager/settings/templates`) — active-highlighted by `usePathname()`. Location matches exactly (`pathname === "/manager/settings"`); the other two match by prefix. Uses `settings.module.css` classes `.subnav`, `.subnavLink`, `.subnavLinkActive`.
- Produces (`layout.tsx`): a server component `SettingsLayout({ children })` that renders a page title, the `SettingsSubnav`, then `{children}`.
- Produces (`page.tsx`): a server component `SettingsLocationPage` — awaits `requireManager()` + `getManagerLocation(user.id)`, renders `LocationSettingsForm` with the location's current config, plus a `Metadata` export (`title: "Settings — RosterHouse"`).
- Consumes: `requireManager` (`@/lib/auth`), `getManagerLocation` (`@/lib/authz`), `LocationSettingsForm` (Task 4), `cx` (`@/components/ui/cx`), `Link`, `usePathname`.

**Notes for the implementer:** The Positions sub-nav page is a Phase 2 stub — do NOT create `/manager/settings/positions/page.tsx` in this phase (visiting it will 404 until Phase 2; that is expected and acceptable per the spec). The Templates sub-nav link resolves to the relocated route created in Task 6.

**Steps:**

1. - [ ] Write the failing test. Create `src/app/manager/settings/SettingsSubnav.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathnameMock }));

import { SettingsSubnav } from "@/app/manager/settings/SettingsSubnav";

afterEach(() => cleanup());

describe("SettingsSubnav", () => {
  it("renders Location, Positions, and Templates links", () => {
    pathnameMock.mockReturnValue("/manager/settings");
    render(<SettingsSubnav />);
    expect(screen.getByRole("link", { name: "Location" })).toHaveAttribute("href", "/manager/settings");
    expect(screen.getByRole("link", { name: "Positions" })).toHaveAttribute(
      "href",
      "/manager/settings/positions",
    );
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/manager/settings/templates",
    );
  });

  it("marks Location active only on the exact settings root", () => {
    pathnameMock.mockReturnValue("/manager/settings");
    render(<SettingsSubnav />);
    expect(screen.getByRole("link", { name: "Location" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Templates" })).not.toHaveAttribute("aria-current");
  });

  it("marks Templates active on a templates sub-route", () => {
    pathnameMock.mockReturnValue("/manager/settings/templates/abc");
    render(<SettingsSubnav />);
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Location" })).not.toHaveAttribute("aria-current");
  });
});
```

2. - [ ] Run it — expect FAIL (module `@/app/manager/settings/SettingsSubnav` does not exist):

```
npm test -- src/app/manager/settings/SettingsSubnav.test.tsx
```

3. - [ ] Implement the sub-nav. Create `src/app/manager/settings/SettingsSubnav.tsx` with the complete contents:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import styles from "./settings.module.css";

const LINKS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/manager/settings", label: "Location", exact: true },
  { href: "/manager/settings/positions", label: "Positions" },
  { href: "/manager/settings/templates", label: "Templates" },
];

export function SettingsSubnav() {
  const pathname = usePathname();
  return (
    <nav className={styles.subnav} aria-label="Settings">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(styles.subnavLink, active && styles.subnavLinkActive)}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

4. - [ ] Run it — expect PASS:

```
npm test -- src/app/manager/settings/SettingsSubnav.test.tsx
```

5. - [ ] Implement the layout. Create `src/app/manager/settings/layout.tsx` with the complete contents:

```tsx
import { SettingsSubnav } from "./SettingsSubnav";
import styles from "./settings.module.css";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Settings</h1>
        <div className={styles.subtitle}>Manage your location, positions, and schedule templates.</div>
      </div>
      <SettingsSubnav />
      <div>{children}</div>
    </div>
  );
}
```

6. - [ ] Implement the Location page. Create `src/app/manager/settings/page.tsx` with the complete contents:

```tsx
import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { LocationSettingsForm } from "./LocationSettingsForm";

export const metadata: Metadata = { title: "Settings — RosterHouse" };

export default async function SettingsLocationPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  return (
    <LocationSettingsForm
      locationId={location.id}
      name={location.name}
      timezone={location.timezone}
      overtimeHoursPerWeek={location.overtimeHoursPerWeek}
      address={location.address}
    />
  );
}
```

7. - [ ] Verify the whole settings suite still passes and typecheck is clean:

```
npm test -- src/app/manager/settings/
```

8. - [ ] Commit:

```
git add src/app/manager/settings/layout.tsx src/app/manager/settings/SettingsSubnav.tsx src/app/manager/settings/page.tsx src/app/manager/settings/SettingsSubnav.test.tsx
git commit -m "feat: settings layout sub-nav and Location config page"
```

---

## Task 6 — Relocate template routes under `/manager/settings/templates`

**Files:**
- Move (via `git mv`): `src/app/manager/templates/page.tsx` → `src/app/manager/settings/templates/page.tsx`
- Move (via `git mv`): `src/app/manager/templates/loading.tsx` → `src/app/manager/settings/templates/loading.tsx`
- Move (via `git mv`): `src/app/manager/templates/error.tsx` → `src/app/manager/settings/templates/error.tsx`
- Move (via `git mv`): `src/app/manager/templates/[templateId]/page.tsx` → `src/app/manager/settings/templates/[templateId]/page.tsx`
- Move (via `git mv`): `src/app/manager/templates/[templateId]/loading.tsx` → `src/app/manager/settings/templates/[templateId]/loading.tsx`
- Move (via `git mv`): `src/app/manager/templates/[templateId]/error.tsx` → `src/app/manager/settings/templates/[templateId]/error.tsx`
- Modify: `src/components/manager/TemplatesView.tsx` (repoint two `/manager/templates` link literals)
- Test: `src/components/manager/TemplatesView.test.tsx` (extend with a link-target assertion for the new path)

**Interfaces:**
- Consumes: nothing new. The moved files import only from `@/…` absolute paths, so no import edits are required — only the physical location changes.
- Produces: routes now resolve at `/manager/settings/templates` and `/manager/settings/templates/[templateId]`. `TemplatesView` navigates/links to the new base path. The old `/manager/templates/**` routes no longer exist.

**Notes for the implementer:** After moving, run `find src/app/manager/templates -type f` — it MUST return nothing (empty directory removed by `git mv`). The grep for `/manager/templates` across `src` MUST return zero hits after this task. `SaveAsTemplateDialog.tsx` and `ApplyTemplateDialog.tsx` do NOT reference `/manager/templates` (they only call APIs) — leave them untouched.

**Steps:**

1. - [ ] Write the failing test. In `src/components/manager/TemplatesView.test.tsx`, add this `it` block at the end of the `describe("TemplatesView", …)` block. It asserts the card "Edit" link points at the relocated path:

```tsx
  it("links Edit to the relocated settings/templates path", () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={templates} />);
    const editLinks = screen.getAllByRole("link", { name: "Edit" });
    expect(editLinks[0]).toHaveAttribute("href", "/manager/settings/templates/t1");
  });
```

2. - [ ] Run it — expect FAIL (the Edit link still points at `/manager/templates/t1`):

```
npm test -- src/components/manager/TemplatesView.test.tsx
```

3. - [ ] Move the route files with `git mv` (creates the destination directories):

```
mkdir -p src/app/manager/settings/templates/[templateId]
git mv src/app/manager/templates/page.tsx src/app/manager/settings/templates/page.tsx
git mv src/app/manager/templates/loading.tsx src/app/manager/settings/templates/loading.tsx
git mv src/app/manager/templates/error.tsx src/app/manager/settings/templates/error.tsx
git mv "src/app/manager/templates/[templateId]/page.tsx" "src/app/manager/settings/templates/[templateId]/page.tsx"
git mv "src/app/manager/templates/[templateId]/loading.tsx" "src/app/manager/settings/templates/[templateId]/loading.tsx"
git mv "src/app/manager/templates/[templateId]/error.tsx" "src/app/manager/settings/templates/[templateId]/error.tsx"
```

4. - [ ] Confirm the old directory is gone (this command MUST print nothing):

```
find src/app/manager/templates -type f
```

5. - [ ] Repoint the two link literals in `src/components/manager/TemplatesView.tsx`.

   Replace this line (in `createTemplate`):

```tsx
      router.push(`/manager/templates/${body.data.template.id}`);
```

   with:

```tsx
      router.push(`/manager/settings/templates/${body.data.template.id}`);
```

   Replace this line (the card Edit link):

```tsx
                <Link href={`/manager/templates/${t.id}`} className={styles.editLink}>
```

   with:

```tsx
                <Link href={`/manager/settings/templates/${t.id}`} className={styles.editLink}>
```

6. - [ ] Confirm no `/manager/templates` literal remains anywhere in `src` (this command MUST print nothing):

```
grep -rn "/manager/templates" src
```

7. - [ ] Run the TemplatesView test — expect PASS (including the pre-existing tests and the new link assertion):

```
npm test -- src/components/manager/TemplatesView.test.tsx
```

8. - [ ] Commit:

```
git add -A
git commit -m "refactor: relocate template routes under /manager/settings/templates"
```

---

## Task 7 — Full-suite verification

**Files:** none (verification only).

**Steps:**

1. - [ ] Run the whole test suite and confirm every file passes (in particular: `Icon.test.tsx`, `chrome.test.tsx`, `location-patch.api.test.ts`, `LocationSettingsForm.test.tsx`, `SettingsSubnav.test.tsx`, `TemplatesView.test.tsx`):

```
npm test
```

2. - [ ] Confirm there are no stray references to the old template path and the settings routes exist:

```
grep -rn "/manager/templates" src ; echo "should be empty above"
find src/app/manager/settings -type f
```

   Expected `find` output (order may vary):

```
src/app/manager/settings/layout.tsx
src/app/manager/settings/SettingsSubnav.tsx
src/app/manager/settings/SettingsSubnav.test.tsx
src/app/manager/settings/page.tsx
src/app/manager/settings/LocationSettingsForm.tsx
src/app/manager/settings/LocationSettingsForm.test.tsx
src/app/manager/settings/settings.module.css
src/app/manager/settings/templates/page.tsx
src/app/manager/settings/templates/loading.tsx
src/app/manager/settings/templates/error.tsx
src/app/manager/settings/templates/[templateId]/page.tsx
src/app/manager/settings/templates/[templateId]/loading.tsx
src/app/manager/settings/templates/[templateId]/error.tsx
```

3. - [ ] Run lint — confirm it is clean:

```
npm run lint
```

4. - [ ] Run the build (this is the project's typecheck gate — `prisma generate && next build`) — confirm it succeeds:

```
npm run build
```

5. - [ ] No commit needed unless step 3 or 4 required a fix; if so:

```
git add -A
git commit -m "test: verify Phase 1 settings foundation suite is green"
```

---

## Phase 1 completion checklist

- [ ] Sidebar shows **Settings** (gear), not Templates.
- [ ] `/manager/settings` renders the Location config form; Save PATCHes `/api/locations/[locationId]`; a timezone change confirms first.
- [ ] `PATCH /api/locations/[locationId]` is manager-guarded + tenancy-scoped, validates IANA timezone, accepts nullable `overtimeHoursPerWeek`/`address`.
- [ ] Settings sub-nav (Location · Positions · Templates) highlights by pathname.
- [ ] Template list/editor live at `/manager/settings/templates/**`; every in-app link points there; zero `/manager/templates` literals remain.
- [ ] Positions sub-nav link exists but its page is a Phase-2 stub (404 until Phase 2) — intentional.
- [ ] Full `npm test` is green; `npm run lint` is clean; `npm run build` succeeds.
