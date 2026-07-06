# Phase 4 — Employee App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the employee-facing mobile-web app (bottom-tab shell, home/my-shifts, shift detail, availability editor with a real save flow, notifications feed with unread bell) plus the manager availability overview, on top of the Phase 1–3 primitives, auth, and time libraries.

**Architecture:** All employee screens live in the `src/app/(employee)/` route group behind a mobile-width shell with `EmployeeTabBar`; server components read via `src/lib/queries/*` helpers; every mutation goes through `/api` route handlers that zod-validate → authenticate (`auth()`) → tenancy-check → act → return the `{ ok }` envelope. The manager availability overview is a server page under `/manager/availability` fed by the same query helper as its API route.

**Tech Stack:** Next.js 16.2 App Router / React 19 / TypeScript · Prisma 7 + `@prisma/adapter-pg` (client generated to `src/generated/prisma`) · PostgreSQL 17 (docker compose) · Auth.js v5 (Phase 2) · `zod@4` · `lucide-react` (via the Phase 1 `Icon` primitive) · `date-fns@4` + `@date-fns/tz` (via Phase 3 `src/lib/time.ts`) · vitest · CSS Modules on design tokens (no Tailwind).

## Global Constraints

Copied from the roadmap (`docs/superpowers/plans/2026-07-05-rosterhouse-wiring-roadmap.md`); every task below implicitly includes these:

- Copy rules: sentence case everywhere; 12-hour times ("7:00 AM – 3:00 PM", en dash `–`, never military); durations as "8 hrs"; no emoji in UI chrome; calm confirmations (no exclamation points); errors specific and actionable, never blaming.
- Styling: design tokens only — no raw hex colors, no font-family other than Figtree (`var(--font-sans)`, applied globally in `globals.css`; do not restate it per element). Hover/press via CSS `:hover`/`:active` classes in CSS Modules, not JS state. Focus states use `--shadow-focus` + brand ring (the Phase 1 primitives already do this).
- All interactive elements are real `<button>`/`<a>`/`<input>` elements with keyboard focus — never onClick divs.
- Weeks start Monday (`dayOfWeek` 0 = Monday everywhere, matching `AvailabilityRule`). `Location.timezone` (IANA) drives all wall-clock rendering; shifts store UTC instants + location-local service `date`.
- Every screen ships loading, empty, and error states.
- Every API handler: zod-validate input → authenticate → tenancy check → act → typed JSON (`{ ok: true, data }` / `{ ok: false, error: { code, message } }`) via `jsonOk`/`jsonErr` from `src/lib/api.ts`.
- Server code imports prisma from `@/lib/db` (never instantiate `PrismaClient` elsewhere). Prisma types/enums import from `@/generated/prisma/client`.
- Test-first (vitest) for `src/lib` logic; route handlers get integration tests against the docker Postgres; commit at the end of every task.
- Employees only ever see **published** shifts. Conflicts are computed, never stored (not surfaced in this phase's employee UI).

---

## Context for implementers (read before your task)

You have zero context for this codebase. Here is everything cross-cutting:

**What already exists (Phases 1–3, do not rebuild):**

- **Primitives** in `src/components/ui/<Name>.tsx` — import like `import { Button } from "@/components/ui/Button";`. All accept `className?: string`, spread rest props, forward refs. APIs used in this phase:
  - `Button`: `{ variant?: "primary"|"secondary"|"ghost"|"accent"|"danger"; size?: "sm"|"md"|"lg"; disabled?; icon?: ReactNode; fullWidth?; children; onClick?; type?: "button"|"submit" }`
  - `Card`: `{ children; padding?: string; hoverable?: boolean }`
  - `Badge`: `{ tone?: "success"|"warning"|"danger"|"info"|"neutral"; children }`
  - `Switch`: `{ label?: string; checked?: boolean; onChange?: (checked: boolean) => void; disabled? }`
  - `Tabs`: `{ tabs?: { value: string; label: string }[]; value?: string; defaultValue?: string; onChange?: (value: string) => void }`
  - `Tooltip`: `{ label: string; children; side?: "top"|"bottom" }`
  - `TimeField`: `{ label?: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; error?: string }` — 12-hour text field; self-validates on blur with `parseTime12h` and shows its own "Enter a time like 7:00 AM" error; `error` prop overrides.
  - `Sheet` (mobile bottom sheet): `{ open: boolean; onClose: () => void; title?: string; children; footer?: ReactNode }`
  - The `/manager` and `(employee)` group layouts are wrapped in `<ToasterProvider>` (Phase 2 Task 5). Use `const { toast } = useToast();` from `@/components/ui/Toaster`; call `toast({ tone: "success"|"warning"|"danger"|"info", title: string, description?: string })`. Auto-dismisses after 3.5s.
  - `Icon`: `{ name: IconName; size?: number; className?: string }` — lucide icon by kebab-case name from Phase 1's pinned 24-name `IconName` union (e.g. `"bell"`, `"map-pin"`, `"users"`), strokeWidth 1.75.
  - `Avatar`: `{ name: string; size?: number; className?: string }` — renders initials, no status dot.
  - `EmptyState`: `{ icon?: IconName; title: string; description?: string; action?: ReactNode; className?: string }` (icon defaults to `"inbox"`)
  - `Spinner`: `{ size?: number; label?: string; className?: string }` (size in pixels, default 20; `role="status"`)
- **Chrome** in `src/components/chrome/`:
  - `EmployeeTopBar`: `{ title: string; backHref?: string; action?: React.ReactNode; className?: string }` — renders the title as an `<h1>`, `backHref` as a chevron-left link, and `action` as a pinned right-side slot (this is where Phase 4's `PageTopBar` places the notification bell; the component has no bell props of its own).
  - `EmployeeTabBar`: no required props (`className?` only); client component rendering five real `<Link>`s — `/shifts` "Shifts" (icon `calendar`, also active on `/shifts/*` detail pages), `/availability` "Availability" (`calendar-check`), `/clock` "Clock" (`timer`), `/swaps` "Open shifts" (`repeat`), `/profile` "Profile" (`user`) — active tab via `usePathname()`. There is no "Home" tab: the employee home lives at `/shifts`, reached via the Shifts tab (`/` is the public marketing landing page).
  - `DatePager`: `{ label: string; prevHref: string; nextHref: string; todayHref?: string }` — link-based week pager.
- **Auth (Phase 2)** — `src/lib/auth.ts` exports `{ handlers, auth, signIn, signOut }` (Auth.js v5) plus `requireUser(): Promise<SessionUser>` (redirects to `/login` if absent) and `requireManager()`. `session.user` is `{ id, name, role: "manager"|"employee", organizationId }`. `src/lib/authz.ts` exports `getManagerLocation(userId): Promise<Location>` among others. **Middleware is already in place**: `/` is public (marketing landing page); authenticated users hitting `/` redirect by role (manager → `/manager`, employee → `/shifts`); unauthenticated users hitting app routes → `/login`; employees hitting `/manager/*` → `/shifts`; managers hitting employee tabs → `/manager`. Do not add per-page role guards beyond what tasks specify.
- **Time (Phase 3)** — `src/lib/time.ts`: `weekStartOf(d: Date, timezone: string): ISODate` (Monday), `addDaysISO(d: ISODate, n: number): ISODate`, `weekDatesOf(weekStart: ISODate): ISODate[]` (7 entries), `parseTime12h(input: string): { hour: number; minute: number } | null` (24-hour `hour`, e.g. "7:00 PM" → `{ hour: 19, minute: 0 }`; null = invalid), `formatTime(instant: Date, timezone: string): string` ("7:00 AM"), `formatShiftRange(startsAt: Date, endsAt: Date, timezone: string): string` ("7:00 AM – 3:00 PM"), `shiftDurationHours(startsAt: Date, endsAt: Date): number` (8, 7.5), `formatDurationHrs(hours: number): string` ("8 hrs"), `formatDayLabel(d: ISODate): string` ("Mon 6"). `ISODate` is a `string` like "2026-07-06".
- **API envelope** — `src/lib/api.ts` exports `jsonOk(data, status?)` and `jsonErr(code, message, status?)` returning `NextResponse.json` of `{ ok: true, data }` / `{ ok: false, error: { code, message } }`. If Phase 2 did not create this file, create it exactly as:

```ts
// src/lib/api.ts — create ONLY if it does not already exist
import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data } satisfies ApiOk<T>, { status });
}

export function jsonErr(code: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: { code, message } } satisfies ApiErr,
    { status }
  );
}
```

- **Seed (Phase 2)** — org "Harbor & Vine", location "Downtown" (America/New_York, OT 40), positions Line cook/Server/Dishwasher/Host, manager Jamie Park (`jamie@harborvine.test` / `rosterhouse1`), 10 employees incl. Maria Garcia (`maria@harborvine.test` / `rosterhouse1`), availability rules, current week published + next week draft. Used for **manual QA only** — integration tests create their own throwaway data (Task 2 factories) so they never depend on seed freshness.

**Running things:**

- DB: `docker compose up -d` (Postgres 17; `DATABASE_URL` is in `.env`).
- Tests: `npx vitest run <file>` (vitest configured in Phase 1 with the `@/` alias and `.env` loading; integration test files also add `import "dotenv/config";` defensively). Test files are colocated: `src/**/*.test.ts`.
- Dev server: `npm run dev` → http://localhost:3000.
- Route handler tests call the exported `GET`/`PUT`/... functions directly with a `new Request(...)` and mock `@/lib/auth` with `vi.mock` — no HTTP server needed. Dynamic-segment handlers receive `{ params: Promise.resolve({ ... }) }` (Next 16 params are Promises).

**Phase 4 conventions:**

- Employee route pages are **server components** that call `requireUser()` then `getEmployeeContext(user.id)` (Task 2); if the context is `null` they `throw new Error("No employee profile is linked to this account.")`, which the route group's `error.tsx` (Task 1) renders calmly.
- Shared employee styles live in `src/components/employee/employee.module.css` (Task 1). Route-specific styles get their own module next to the page.
- API 401 copy is "You need to sign in." with code `unauthorized`; missing-profile 403 copy is "No employee profile is linked to this account." with code `no_profile`.

---

### Task 1: Employee route-group shell (layout, top bar, tab bar, stubs, error state, root 404/500)

**Files:**

- Create: `src/app/(employee)/layout.tsx`
- Create: `src/app/(employee)/layout.module.css`
- Create: `src/components/employee/employee.module.css`
- Create: `src/components/employee/PageTopBar.tsx`
- Create: `src/components/employee/PageTopBar.module.css`
- Create: `src/app/(employee)/error.tsx`
- Replace (overwrite the Phase 2 placeholder): `src/app/(employee)/shifts/page.tsx` (home stub at `/shifts` — replaced again in Task 3)
- Create: `src/app/(employee)/availability/page.tsx` (stub — replaced in Task 5)
- Create: `src/app/(employee)/notifications/page.tsx` (stub — replaced in Task 7)
- Create: `src/app/(employee)/profile/page.tsx` (stub — replaced in Task 8)
- Create: `src/app/(employee)/clock/page.tsx` (stays until Phase 5)
- Create: `src/app/(employee)/swaps/page.tsx` (stays until Phase 5)
- Create: `src/app/not-found.tsx` (branded root 404)
- Create: `src/app/global-error.tsx` (branded root 500)

**Interfaces:**

- Consumes: `EmployeeTabBar` (no required props) and `EmployeeTopBar` (`{ title, backHref?, action?, className? }`) from `src/components/chrome/` (Phase 1); `EmptyState` from `@/components/ui/EmptyState`; `Button` from `@/components/ui/Button`; `Icon` from `@/components/ui/Icon`; `auth()` from `@/lib/auth` (Phase 2); `prisma` from `@/lib/db`. Middleware (Phase 2) already redirects managers away from these routes — this task adds no role checks.
- Produces: `PageTopBar` server component — `PageTopBar({ title: string; backHref?: string; showBell?: boolean })`, fetches the session user's unread notification count itself and renders the notification bell (a `/notifications` link with `aria-label="Notifications"` and an unread-count badge capped at "9+") into `EmployeeTopBar`'s `action` slot, with badge styles in `src/components/employee/PageTopBar.module.css`; CSS module classes in `src/components/employee/employee.module.css` used by Tasks 3–8: `.screen`, `.sectionTitle`, `.muted`, `.subtle`, `.cardRow`, `.cardStack`, `.dayLabel`, `.shiftTitle`, `.summaryCard`, `.summaryTitle`, `.summarySub`, `.linkReset`, `.linkBrand`, `.iconRow`, `.profileRow`, `.notifTitle`, `.notifTitleUnread`, `.notifMeta`, `.unreadDot`, `.errorWrap`, `.errorTitle`, `.skeleton`; stub pages at `/shifts` (home), `/availability`, `/notifications`, `/profile` (replaced by Tasks 3/5/7/8) and lasting placeholder pages at `/clock` and `/swaps` (replaced in Phase 5); branded root-level `src/app/not-found.tsx` (unknown URLs anywhere, manager side included) and `src/app/global-error.tsx` (root-segment render failures).

- [ ] **Step 1: Create the layout and its CSS module**

```tsx
// src/app/(employee)/layout.tsx
import type { ReactNode } from "react";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import styles from "./layout.module.css";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <main className={styles.content}>{children}</main>
      <EmployeeTabBar />
    </div>
  );
}
```

```css
/* src/app/(employee)/layout.module.css */
.shell {
  max-width: 430px;
  margin: 0 auto;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface-page);
}

.content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 2: Create the shared employee CSS module**

```css
/* src/components/employee/employee.module.css */
.screen {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 20px 24px;
}

.sectionTitle {
  font-size: var(--text-h3-size);
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 6px;
}

.muted {
  font-size: 13px;
  color: var(--text-secondary);
}

.subtle {
  font-size: 11px;
  color: var(--text-tertiary);
}

.cardRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cardStack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dayLabel {
  font-size: 13px;
  color: var(--text-secondary);
}

.shiftTitle {
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2px;
}

.summaryCard {
  background: var(--surface-brand);
  color: var(--text-inverse);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
}

.summaryTitle {
  font-size: 17px;
  font-weight: 700;
}

.summarySub {
  font-size: 13px;
  color: var(--green-200);
  margin-top: 4px;
}

.linkReset {
  text-decoration: none;
  color: inherit;
  display: block;
}

.linkBrand {
  color: var(--text-brand);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
}

.linkBrand:hover {
  text-decoration: underline;
}

.iconRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.profileRow {
  display: flex;
  align-items: center;
  gap: 14px;
}

.notifTitle {
  font-weight: 600;
  color: var(--text-primary);
}

.notifTitleUnread {
  font-weight: 700;
  color: var(--text-primary);
}

.notifMeta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.unreadDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-primary);
}

.errorWrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 20px;
  text-align: center;
}

.errorTitle {
  font-size: var(--text-h2-size);
  font-weight: 700;
  color: var(--text-primary);
}

.skeleton {
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
  animation: skeletonPulse 1.2s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
```

- [ ] **Step 3: Create `PageTopBar` (server component that owns the bell badge)**

`EmployeeTopBar` (Phase 1) has no bell props — it exposes a generic `action` slot for exactly this purpose. `PageTopBar` builds the bell link itself and passes it through that slot.

```tsx
// src/components/employee/PageTopBar.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmployeeTopBar } from "@/components/chrome/EmployeeTopBar";
import { Icon } from "@/components/ui/Icon";
import styles from "./PageTopBar.module.css";

type PageTopBarProps = {
  title: string;
  backHref?: string;
  /** Hide the bell on the notifications screen itself. @default true */
  showBell?: boolean;
};

export async function PageTopBar({ title, backHref, showBell = true }: PageTopBarProps) {
  let unreadCount = 0;
  if (showBell) {
    const session = await auth();
    if (session?.user) {
      unreadCount = await prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      });
    }
  }
  const bell = showBell ? (
    <Link href="/notifications" aria-label="Notifications" className={styles.bell}>
      <Icon name="bell" size={20} />
      {unreadCount > 0 && (
        <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
      )}
    </Link>
  ) : undefined;
  return <EmployeeTopBar title={title} backHref={backHref} action={bell} />;
}
```

```css
/* src/components/employee/PageTopBar.module.css */
.bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  color: var(--text-primary);
}

.bell:hover {
  background: var(--surface-sunken);
}

.badge {
  position: absolute;
  top: 1px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--accent-primary);
  color: var(--accent-contrast);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}
```

- [ ] **Step 4: Create the route-group error state**

```tsx
// src/app/(employee)/error.tsx
"use client";

import { Button } from "@/components/ui/Button";
import styles from "@/components/employee/employee.module.css";

export default function EmployeeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.errorWrap}>
      <div className={styles.errorTitle}>Something went wrong</div>
      <div className={styles.muted}>
        We couldn&apos;t load this screen. Your data is safe.
      </div>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Create the six pages (four stubs + two Phase 5 placeholders; the home stub overwrites Phase 2's placeholder at `/shifts`)**

```tsx
// src/app/(employee)/shifts/page.tsx  (home stub at "/shifts" — overwrites Phase 2's
// placeholder; Task 3 replaces this file again with the real home screen)
import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function HomePage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Home" />
      <EmptyState title="Your shifts are coming soon" description="This screen is being built." />
    </div>
  );
}
```

```tsx
// src/app/(employee)/availability/page.tsx  (stub — Task 5 replaces this file)
import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function AvailabilityPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Availability" />
      <EmptyState title="Availability editing is coming soon" description="This screen is being built." />
    </div>
  );
}
```

```tsx
// src/app/(employee)/notifications/page.tsx  (stub — Task 7 replaces this file)
import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function NotificationsPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Notifications" backHref="/shifts" showBell={false} />
      <EmptyState title="Notifications are coming soon" description="This screen is being built." />
    </div>
  );
}
```

```tsx
// src/app/(employee)/profile/page.tsx  (stub — Task 8 replaces this file)
import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function ProfilePage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Profile" />
      <EmptyState title="Your profile is coming soon" description="This screen is being built." />
    </div>
  );
}
```

```tsx
// src/app/(employee)/clock/page.tsx  (placeholder — Phase 5 replaces this file)
import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function ClockPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Time clock" />
      <EmptyState
        title="The time clock is coming soon"
        description="You'll clock in and out of your shifts here."
      />
    </div>
  );
}
```

```tsx
// src/app/(employee)/swaps/page.tsx  (placeholder — Phase 5 replaces this file)
import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function SwapsPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Open shifts" />
      <EmptyState
        title="Open shifts and swaps are coming soon"
        description="You'll claim open shifts and request swaps here."
      />
    </div>
  );
}
```

- [ ] **Step 6: Create the branded root 404 and 500 pages**

Without these, unknown manager-side URLs and root-segment render failures fall back to Next.js's unbranded defaults. The `(employee)` group gets its own `not-found.tsx` in Task 4; these two cover everything else.

```tsx
// src/app/not-found.tsx — branded 404 for unknown URLs anywhere in the app
// (manager side included). The (employee) group adds its own not-found in Task 4.
// "Go to home" deliberately links to "/" — the public marketing landing page —
// which is correct for guests; signed-in users hitting "/" are redirected by role.
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function RootNotFound() {
  return (
    <div className={styles.errorWrap}>
      <EmptyState
        title="This page doesn't exist"
        description="Check the address, or head back to your home screen."
        action={
          <Link href="/" className={styles.linkBrand}>
            Go to home
          </Link>
        }
      />
    </div>
  );
}
```

```tsx
// src/app/global-error.tsx — branded fallback when the root layout itself
// fails to render. Next.js replaces the entire document with this component,
// so it must be a client component and render its own <html>/<body>.
"use client";

import "./globals.css";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "64px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            We couldn&apos;t load this page. Your data is safe.
          </div>
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify it builds**

Run: `npm run build`
Expected: build completes with no type errors; the route list includes `/shifts` (the employee home), `/availability`, `/clock`, `/swaps`, `/notifications`, `/profile`, and `/_not-found`.

- [ ] **Step 8: Manual check**

Run: `docker compose up -d && npm run dev`, then in a browser:
1. Log in as `maria@harborvine.test` / `rosterhouse1` → you land on the employee app at `/shifts`.
2. Tap each of the five tabs — each navigates to its page (stub copy is fine), the active tab is highlighted, and the URL changes (`/shifts`, `/availability`, `/clock`, `/swaps`, `/profile`).
3. Tab stops: press Tab repeatedly — tab-bar items and the bell receive visible focus rings.
4. Log in as `jamie@harborvine.test` in a private window and visit `/shifts` → redirected to `/manager` (middleware from Phase 2; if this fails, stop and report — do not patch middleware in this task). Visit `/manager/nonexistent` → the branded root 404 shows with a working "Go to home" link.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(employee)" src/components/employee src/app/not-found.tsx src/app/global-error.tsx
git commit -m "feat(employee): mobile shell with tab bar, top bar, stubs, error state, and branded root 404/500"
```

### Task 2: Employee lib groundwork + `GET /api/me` + `GET /api/me/shifts`

**Files:**

- Create: `src/lib/time-format.ts`
- Create: `src/lib/time-format.test.ts`
- Create: `src/lib/queries/employee.ts`
- Create: `src/lib/test/factories.ts`
- Create: `src/app/api/me/route.ts`
- Create: `src/app/api/me/route.test.ts`
- Create: `src/app/api/me/shifts/route.ts`
- Create: `src/app/api/me/shifts/route.test.ts`
- Create (only if missing): `src/lib/api.ts` (exact content in "Context for implementers")

**Interfaces:**

- Consumes: `prisma` from `@/lib/db`; `auth` from `@/lib/auth` (Phase 2); `formatShiftRange`, `shiftDurationHours`, `parseTime12h` from `@/lib/time` (Phase 3); `jsonOk`/`jsonErr` from `@/lib/api`.
- Produces (later tasks and phases rely on these exact names):
  - `src/lib/time-format.ts`: `formatDayFull(d: string): string` ("2026-07-07" → "Tue Jul 7"), `dayLabelWithToday(d: string, todayISO: string): string` ("Today · Tue Jul 7" when equal), `formatWeekOf(weekStart: string): string` ("Week of Jul 6"), `hhmmTo12h(hhmm: string): string` ("13:30" → "1:30 PM"), `parse12hToHhmm(input: string): string | null` ("9:00 AM" → "09:00"), `timeAgo(date: Date, now?: Date): string` ("just now", "5m ago", "2h ago", "1d ago", then "Jun 30"), `todayISOIn(timezone: string, now?: Date): string`.
  - `src/lib/queries/employee.ts`: `getEmployeeContext(userId: string): Promise<EmployeeContext | null>`, `getMe(userId: string): Promise<MePayload | null>`, `getMyShifts(profileId: string, from: string, to: string, timezone: string): Promise<{ shifts: EmployeeShiftDto[]; summary: { shiftCount: number; totalHours: number } }>` and the exported types `EmployeeContext`, `MePayload`, `EmployeeShiftDto` (fields in the code below).
  - `src/lib/test/factories.ts`: `createTestOrg(): Promise<TestOrg>`, `createTestEmployee(t: TestOrg, name: string): Promise<{ userId: string; profileId: string }>`, `createTestSchedule(t: TestOrg, weekStart: string, status: "draft" | "published"): Promise<string>`, `createTestShift(t: TestOrg, args: { scheduleId: string; positionId: string; employeeProfileId: string | null; date: string; startsAt: string; endsAt: string; status: "draft" | "published"; notes?: string }): Promise<string>`, `deleteTestOrg(organizationId: string): Promise<void>`, and `type TestOrg = { organizationId: string; locationId: string; timezone: string; positions: { lineCook: string; server: string }; managerUserId: string }`.
  - Endpoints: `GET /api/me` → `MePayload`; `GET /api/me/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD` → `{ shifts: EmployeeShiftDto[]; summary: { shiftCount, totalHours } }` (published shifts only, sorted by `startsAt`).

- [ ] **Step 1: Write failing tests for the formatting helpers**

```ts
// src/lib/time-format.test.ts
import { describe, expect, it } from "vitest";
import {
  dayLabelWithToday,
  formatDayFull,
  formatWeekOf,
  hhmmTo12h,
  parse12hToHhmm,
  timeAgo,
  todayISOIn,
} from "@/lib/time-format";

describe("formatDayFull", () => {
  it("formats an ISO date as 'EEE MMM d'", () => {
    expect(formatDayFull("2026-07-07")).toBe("Tue Jul 7");
    expect(formatDayFull("2026-07-06")).toBe("Mon Jul 6");
  });
});

describe("dayLabelWithToday", () => {
  it("prefixes Today when the date is today", () => {
    expect(dayLabelWithToday("2026-07-07", "2026-07-07")).toBe("Today · Tue Jul 7");
  });
  it("returns the plain label otherwise", () => {
    expect(dayLabelWithToday("2026-07-08", "2026-07-07")).toBe("Wed Jul 8");
  });
});

describe("formatWeekOf", () => {
  it("formats the Monday of the week", () => {
    expect(formatWeekOf("2026-07-06")).toBe("Week of Jul 6");
  });
});

describe("hhmmTo12h", () => {
  it("converts 24-hour storage strings to 12-hour display", () => {
    expect(hhmmTo12h("09:00")).toBe("9:00 AM");
    expect(hhmmTo12h("13:30")).toBe("1:30 PM");
    expect(hhmmTo12h("00:15")).toBe("12:15 AM");
    expect(hhmmTo12h("12:00")).toBe("12:00 PM");
  });
});

describe("parse12hToHhmm", () => {
  it("converts valid 12-hour input to a 24-hour storage string", () => {
    expect(parse12hToHhmm("9:00 AM")).toBe("09:00");
    expect(parse12hToHhmm("1:30 PM")).toBe("13:30");
    expect(parse12hToHhmm("12:15 AM")).toBe("00:15");
  });
  it("returns null for invalid input", () => {
    expect(parse12hToHhmm("25:00")).toBeNull();
    expect(parse12hToHhmm("soon")).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-07-07T12:00:00.000Z");
  it("handles minutes, hours, days, and older dates", () => {
    expect(timeAgo(new Date("2026-07-07T11:59:40.000Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-07-07T11:55:00.000Z"), now)).toBe("5m ago");
    expect(timeAgo(new Date("2026-07-07T10:00:00.000Z"), now)).toBe("2h ago");
    expect(timeAgo(new Date("2026-07-06T11:00:00.000Z"), now)).toBe("1d ago");
    expect(timeAgo(new Date("2026-06-30T12:00:00.000Z"), now)).toBe("Jun 30");
  });
});

describe("todayISOIn", () => {
  it("returns the wall-clock date in the given timezone", () => {
    // 3:00 AM UTC on Jul 6 is still Jul 5 in New York (UTC-4 in July).
    expect(todayISOIn("America/New_York", new Date("2026-07-06T03:00:00.000Z"))).toBe("2026-07-05");
    expect(todayISOIn("America/New_York", new Date("2026-07-06T12:00:00.000Z"))).toBe("2026-07-06");
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/time-format.test.ts`
Expected: FAIL — "Cannot find module '@/lib/time-format'" (or equivalent resolve error).

- [ ] **Step 3: Implement `src/lib/time-format.ts`**

```ts
// src/lib/time-format.ts — display formatting helpers for the employee app.
// Pure functions; safe to import from client components.
import { format } from "date-fns";
import { parseTime12h } from "@/lib/time";

/** "2026-07-07" → "Tue Jul 7" */
export function formatDayFull(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return format(new Date(y, m - 1, day), "EEE MMM d");
}

/** "Today · Tue Jul 7" when d === todayISO, otherwise "Tue Jul 7". */
export function dayLabelWithToday(d: string, todayISO: string): string {
  const label = formatDayFull(d);
  return d === todayISO ? `Today · ${label}` : label;
}

/** "2026-07-06" → "Week of Jul 6" */
export function formatWeekOf(weekStart: string): string {
  const [y, m, day] = weekStart.split("-").map(Number);
  return `Week of ${format(new Date(y, m - 1, day), "MMM d")}`;
}

/** "09:00" → "9:00 AM"; "13:30" → "1:30 PM". Input is the 24-hour storage format. */
export function hhmmTo12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "9:00 AM" → "09:00"; null when the input isn't a valid 12-hour time. */
export function parse12hToHhmm(input: string): string | null {
  const t = parseTime12h(input);
  if (!t) return null;
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/** Relative timestamps for the notifications feed. */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return format(date, "MMM d");
}

/** The wall-clock date (ISODate) right now in the given IANA timezone. */
export function todayISOIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/time-format.test.ts`
Expected: PASS — all tests green. (If `timeAgo`'s "Jun 30" case fails because the runner's local timezone shifts the day, that is a bug in your implementation — `format(date, "MMM d")` uses local time; this is acceptable for a relative "older than a week" label, and the test date `2026-06-30T12:00Z` renders "Jun 30" in any timezone from UTC-12 to UTC+11. Do not change the test.)

- [ ] **Step 5: Create the test data factories**

No test for the factories themselves — they are exercised by every integration test from here on.

```ts
// src/lib/test/factories.ts — throwaway DB fixtures for integration tests.
// Each test suite creates its own org and deletes it afterwards, so tests
// never depend on (or corrupt) the demo seed.
import { prisma } from "@/lib/db";

export type TestOrg = {
  organizationId: string;
  locationId: string;
  timezone: string;
  positions: { lineCook: string; server: string };
  managerUserId: string;
};

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export async function createTestOrg(): Promise<TestOrg> {
  const org = await prisma.organization.create({ data: { name: uniq("Test Org") } });
  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Test location",
      timezone: "America/New_York",
      address: "1 Test St",
      overtimeHoursPerWeek: 40,
    },
  });
  const lineCook = await prisma.position.create({
    data: { locationId: location.id, name: "Line cook", sortOrder: 0 },
  });
  const server = await prisma.position.create({
    data: { locationId: location.id, name: "Server", sortOrder: 1 },
  });
  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Test Manager",
      email: `${uniq("mgr")}@test.local`,
      passwordHash: "not-a-real-hash",
      role: "manager",
    },
  });
  return {
    organizationId: org.id,
    locationId: location.id,
    timezone: location.timezone,
    positions: { lineCook: lineCook.id, server: server.id },
    managerUserId: manager.id,
  };
}

export async function createTestEmployee(
  t: TestOrg,
  name: string
): Promise<{ userId: string; profileId: string }> {
  const user = await prisma.user.create({
    data: {
      organizationId: t.organizationId,
      name,
      email: `${uniq("emp")}@test.local`,
      passwordHash: "not-a-real-hash",
      role: "employee",
    },
  });
  const profile = await prisma.employeeProfile.create({
    data: {
      userId: user.id,
      locationId: t.locationId,
      status: "active",
      primaryPositionId: t.positions.lineCook,
    },
  });
  return { userId: user.id, profileId: profile.id };
}

export async function createTestSchedule(
  t: TestOrg,
  weekStart: string,
  status: "draft" | "published"
): Promise<string> {
  const schedule = await prisma.schedule.create({
    data: {
      locationId: t.locationId,
      weekStartDate: new Date(`${weekStart}T00:00:00.000Z`),
      status,
    },
  });
  return schedule.id;
}

export async function createTestShift(
  t: TestOrg,
  args: {
    scheduleId: string;
    positionId: string;
    employeeProfileId: string | null;
    date: string; // ISODate, location-local service date
    startsAt: string; // ISO UTC instant
    endsAt: string; // ISO UTC instant
    status: "draft" | "published";
    notes?: string;
  }
): Promise<string> {
  const shift = await prisma.shift.create({
    data: {
      scheduleId: args.scheduleId,
      locationId: t.locationId,
      positionId: args.positionId,
      employeeProfileId: args.employeeProfileId,
      date: new Date(`${args.date}T00:00:00.000Z`),
      startsAt: new Date(args.startsAt),
      endsAt: new Date(args.endsAt),
      status: args.status,
      notes: args.notes ?? null,
    },
  });
  return shift.id;
}

/** Cascades: org → users + locations → profiles, schedules, shifts, notifications, … */
export async function deleteTestOrg(organizationId: string): Promise<void> {
  await prisma.organization.delete({ where: { id: organizationId } });
}
```

- [ ] **Step 6: Write failing integration tests for the two endpoints**

Note the mock pattern: `vi.mock("@/lib/auth", ...)` replaces the whole Auth.js module so no real session is needed; everything else (prisma, queries) runs against the docker Postgres.

```ts
// src/app/api/me/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function signInAs(userId: string, role: "manager" | "employee", organizationId: string) {
  authMock.mockResolvedValue({
    user: { id: userId, name: "Test", role, organizationId },
  });
}

describe("GET /api/me", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns 401 with the envelope when signed out", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "unauthorized", message: "You need to sign in." },
    });
  });

  it("returns user + profile for an employee", async () => {
    signInAs(emp.userId, "employee", t.organizationId);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.user.firstName).toBe("Maria");
    expect(body.data.user.role).toBe("employee");
    expect(body.data.profile).toMatchObject({
      id: emp.profileId,
      locationId: t.locationId,
      locationName: "Test location",
      timezone: "America/New_York",
      primaryPositionName: "Line cook",
      status: "active",
      notifyPush: true,
      notifySms: true,
      notifyEmail: false,
    });
  });

  it("returns profile: null for a manager with no employee profile", async () => {
    signInAs(t.managerUserId, "manager", t.organizationId);
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.profile).toBeNull();
    expect(body.data.user.role).toBe("manager");
  });
});
```

```ts
// src/app/api/me/shifts/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  createTestSchedule,
  createTestShift,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

// Week of Mon 2026-07-06. New York is UTC-4 in July:
// 7:00 AM local = 11:00Z; 3:00 PM = 19:00Z; 2:00 PM = 18:00Z; 8:00 PM = 00:00Z next day.
const WEEK = "2026-07-06";

function get(from: string, to: string) {
  return GET(new Request(`http://test.local/api/me/shifts?from=${from}&to=${to}`));
}

describe("GET /api/me/shifts", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };
  let other: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    other = await createTestEmployee(t, "Sam Test");
    const schedule = await createTestSchedule(t, WEEK, "published");
    // Maria: Mon 7–3 (8 hrs), Wed 7–3 (8 hrs), Fri 2–8 (6 hrs) → 22 hrs.
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: emp.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T11:00:00.000Z",
      endsAt: "2026-07-06T19:00:00.000Z",
      status: "published",
    });
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: emp.profileId,
      date: "2026-07-08",
      startsAt: "2026-07-08T11:00:00.000Z",
      endsAt: "2026-07-08T19:00:00.000Z",
      status: "published",
    });
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: emp.profileId,
      date: "2026-07-10",
      startsAt: "2026-07-10T18:00:00.000Z",
      endsAt: "2026-07-11T00:00:00.000Z",
      status: "published",
    });
    // Excluded: Maria's DRAFT shift and Sam's published shift, same week.
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: emp.profileId,
      date: "2026-07-09",
      startsAt: "2026-07-09T11:00:00.000Z",
      endsAt: "2026-07-09T19:00:00.000Z",
      status: "draft",
    });
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: other.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T11:00:00.000Z",
      endsAt: "2026-07-06T19:00:00.000Z",
      status: "published",
    });
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns only my published shifts, sorted, with a summary", async () => {
    const res = await get("2026-07-06", "2026-07-12");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.shifts).toHaveLength(3);
    expect(body.data.shifts.map((s: { date: string }) => s.date)).toEqual([
      "2026-07-06",
      "2026-07-08",
      "2026-07-10",
    ]);
    expect(body.data.shifts[0]).toMatchObject({
      positionName: "Line cook",
      timeRange: "7:00 AM – 3:00 PM",
      durationHours: 8,
    });
    expect(body.data.summary).toEqual({ shiftCount: 3, totalHours: 22 });
  });

  it("returns an empty list outside the range", async () => {
    const res = await get("2026-07-13", "2026-07-19");
    const body = await res.json();
    expect(body.data.shifts).toHaveLength(0);
    expect(body.data.summary).toEqual({ shiftCount: 0, totalHours: 0 });
  });

  it("rejects bad query params with a specific message", async () => {
    const res = await get("2026-07-12", "2026-07-06");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("The from date must be on or before the to date.");
  });

  it("returns 403 no_profile for a user without an employee profile", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: t.managerUserId, name: "Test Manager", role: "manager", organizationId: t.organizationId },
    });
    const res = await get("2026-07-06", "2026-07-12");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("no_profile");
  });
});
```

- [ ] **Step 7: Run the tests to see them fail**

Run: `docker compose up -d && npx vitest run src/app/api/me/route.test.ts src/app/api/me/shifts/route.test.ts`
Expected: FAIL — cannot resolve `./route` / `@/lib/queries/employee` (files don't exist yet).

- [ ] **Step 8: Implement the query helpers**

```ts
// src/lib/queries/employee.ts — read helpers shared by employee pages and /api/me/* routes.
import { prisma } from "@/lib/db";
import { formatShiftRange, shiftDurationHours } from "@/lib/time";

export type EmployeeContext = {
  userId: string;
  name: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  profileId: string;
  locationId: string;
  locationName: string;
  locationAddress: string | null;
  timezone: string;
  primaryPositionName: string | null;
  status: "invited" | "active" | "inactive";
  notifyPush: boolean;
  notifySms: boolean;
  notifyEmail: boolean;
};

export async function getEmployeeContext(userId: string): Promise<EmployeeContext | null> {
  const profile = await prisma.employeeProfile.findFirst({
    where: { userId },
    include: { user: true, location: true, primaryPosition: true },
  });
  if (!profile) return null;
  return {
    userId,
    name: profile.user.name,
    firstName: profile.user.name.split(" ")[0],
    email: profile.user.email,
    phone: profile.user.phone,
    profileId: profile.id,
    locationId: profile.locationId,
    locationName: profile.location.name,
    locationAddress: profile.location.address,
    timezone: profile.location.timezone,
    primaryPositionName: profile.primaryPosition?.name ?? null,
    status: profile.status,
    notifyPush: profile.notifyPush,
    notifySms: profile.notifySms,
    notifyEmail: profile.notifyEmail,
  };
}

export type MePayload = {
  user: {
    id: string;
    name: string;
    firstName: string;
    email: string | null;
    phone: string | null;
    role: "manager" | "employee";
  };
  profile: {
    id: string;
    locationId: string;
    locationName: string;
    locationAddress: string | null;
    timezone: string;
    primaryPositionName: string | null;
    status: "invited" | "active" | "inactive";
    notifyPush: boolean;
    notifySms: boolean;
    notifyEmail: boolean;
  } | null;
};

export async function getMe(userId: string): Promise<MePayload | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const ctx = await getEmployeeContext(userId);
  return {
    user: {
      id: user.id,
      name: user.name,
      firstName: user.name.split(" ")[0],
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    profile: ctx
      ? {
          id: ctx.profileId,
          locationId: ctx.locationId,
          locationName: ctx.locationName,
          locationAddress: ctx.locationAddress,
          timezone: ctx.timezone,
          primaryPositionName: ctx.primaryPositionName,
          status: ctx.status,
          notifyPush: ctx.notifyPush,
          notifySms: ctx.notifySms,
          notifyEmail: ctx.notifyEmail,
        }
      : null,
  };
}

export type EmployeeShiftDto = {
  id: string;
  date: string; // ISODate service date
  startsAt: string; // ISO UTC instant
  endsAt: string;
  positionName: string;
  timeRange: string; // "7:00 AM – 3:00 PM" in the location timezone
  durationHours: number;
};

export async function getMyShifts(
  profileId: string,
  from: string,
  to: string,
  timezone: string
): Promise<{ shifts: EmployeeShiftDto[]; summary: { shiftCount: number; totalHours: number } }> {
  const rows = await prisma.shift.findMany({
    where: {
      employeeProfileId: profileId,
      status: "published",
      date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
    },
    include: { position: true },
    orderBy: { startsAt: "asc" },
  });
  const shifts = rows.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    positionName: s.position.name,
    timeRange: formatShiftRange(s.startsAt, s.endsAt, timezone),
    durationHours: shiftDurationHours(s.startsAt, s.endsAt),
  }));
  const totalHours = shifts.reduce((sum, s) => sum + s.durationHours, 0);
  return { shifts, summary: { shiftCount: shifts.length, totalHours } };
}
```

- [ ] **Step 9: Implement the route handlers**

```ts
// src/app/api/me/route.ts
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getMe } from "@/lib/queries/employee";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);
  const me = await getMe(session.user.id);
  if (!me) return jsonErr("unauthorized", "You need to sign in.", 401);
  return jsonOk(me);
}
```

```ts
// src/app/api/me/shifts/route.ts
import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getEmployeeContext, getMyShifts } from "@/lib/queries/employee";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.");

const querySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from <= q.to, {
    message: "The from date must be on or before the to date.",
  });

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  });
  if (!parsed.success) {
    return jsonErr("invalid_request", parsed.error.issues[0].message, 400);
  }

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) {
    return jsonErr("no_profile", "No employee profile is linked to this account.", 403);
  }

  const data = await getMyShifts(ctx.profileId, parsed.data.from, parsed.data.to, ctx.timezone);
  return jsonOk(data);
}
```

- [ ] **Step 10: Run the tests to see them pass**

Run: `npx vitest run src/app/api/me/route.test.ts src/app/api/me/shifts/route.test.ts src/lib/time-format.test.ts`
Expected: PASS — all suites green.

- [ ] **Step 11: Commit**

```bash
git add src/lib/time-format.ts src/lib/time-format.test.ts src/lib/queries/employee.ts src/lib/test/factories.ts src/app/api/me src/lib/api.ts
git commit -m "feat(api): /api/me and /api/me/shifts with employee query helpers and test factories"
```

### Task 3: Employee home screen

**Files:**

- Create: `src/components/employee/ShiftCard.tsx`
- Replace (overwrite the Task 1 stub): `src/app/(employee)/shifts/page.tsx`
- Create: `src/app/(employee)/shifts/loading.tsx`

**Interfaces:**

- Consumes: `getEmployeeContext`, `getMyShifts`, `EmployeeShiftDto` from `@/lib/queries/employee` (Task 2); `weekStartOf`, `addDaysISO`, `formatDurationHrs` from `@/lib/time` (Phase 3); `dayLabelWithToday`, `todayISOIn` from `@/lib/time-format` (Task 2); `PageTopBar` and `employee.module.css` classes (Task 1); `Card`, `Badge`, `EmptyState` primitives; `requireUser` from `@/lib/auth`.
- Produces: `ShiftCard` — `ShiftCard({ href: string; dayLabel: string; positionName: string; timeRange: string; badgeTone?: "success" | "info" | "neutral"; badgeLabel?: string })`, a linked card reused by later phases for shift lists.

- [ ] **Step 1: Create `ShiftCard`**

```tsx
// src/components/employee/ShiftCard.tsx — linked shift row styled like the
// design's HomeScreen cards (day, position, time + status badge).
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import styles from "./employee.module.css";

type ShiftCardProps = {
  href: string;
  dayLabel: string;
  positionName: string;
  timeRange: string;
  badgeTone?: "success" | "info" | "neutral";
  badgeLabel?: string;
};

export function ShiftCard({
  href,
  dayLabel,
  positionName,
  timeRange,
  badgeTone,
  badgeLabel,
}: ShiftCardProps) {
  return (
    <Link href={href} className={styles.linkReset}>
      <Card hoverable>
        <div className={styles.cardRow}>
          <div>
            <div className={styles.dayLabel}>{dayLabel}</div>
            <div className={styles.shiftTitle}>{positionName}</div>
            <div className={styles.dayLabel}>{timeRange}</div>
          </div>
          {badgeLabel ? <Badge tone={badgeTone ?? "neutral"}>{badgeLabel}</Badge> : null}
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Replace the home stub with the real page**

Semantics: the summary card describes **this week** (Mon–Sun in the location timezone); the list shows shifts from this week and next whose `endsAt` is still in the future. Employees only ever see published shifts (`getMyShifts` already filters).

```tsx
// src/app/(employee)/shifts/page.tsx — the employee home at "/shifts"
import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getMyShifts } from "@/lib/queries/employee";
import { addDaysISO, formatDurationHrs, weekStartOf } from "@/lib/time";
import { dayLabelWithToday, todayISOIn } from "@/lib/time-format";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { ShiftCard } from "@/components/employee/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default async function HomePage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");

  const now = new Date();
  const weekStart = weekStartOf(now, ctx.timezone);
  const weekEnd = addDaysISO(weekStart, 6);
  const todayISO = todayISOIn(ctx.timezone, now);

  // Summary = this week; list horizon = this week + next.
  const week = await getMyShifts(ctx.profileId, weekStart, weekEnd, ctx.timezone);
  const horizon = await getMyShifts(ctx.profileId, weekStart, addDaysISO(weekStart, 13), ctx.timezone);
  const upcoming = horizon.shifts.filter((s) => new Date(s.endsAt).getTime() > now.getTime());

  const { shiftCount, totalHours } = week.summary;

  return (
    <div className={styles.screen}>
      <PageTopBar title={`Hi, ${ctx.firstName}`} />

      {shiftCount > 0 && (
        <section className={styles.summaryCard}>
          <div className={styles.summaryTitle}>You&apos;re all set for this week.</div>
          <div className={styles.summarySub}>
            {shiftCount} {shiftCount === 1 ? "shift" : "shifts"} · {formatDurationHrs(totalHours)} total
          </div>
        </section>
      )}

      <h2 className={styles.sectionTitle}>Upcoming shifts</h2>

      {upcoming.length === 0 ? (
        shiftCount === 0 ? (
          <EmptyState
            title="No shifts yet"
            description="Your manager hasn't published this week."
          />
        ) : (
          <div className={styles.muted}>No more shifts this week.</div>
        )
      ) : (
        upcoming.map((s) => (
          <ShiftCard
            key={s.id}
            href={`/shifts/${s.id}`}
            dayLabel={dayLabelWithToday(s.date, todayISO)}
            positionName={s.positionName}
            timeRange={s.timeRange}
            badgeTone="success"
            badgeLabel="Confirmed"
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the loading skeleton**

```tsx
// src/app/(employee)/shifts/loading.tsx
import styles from "@/components/employee/employee.module.css";

export default function HomeLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading your shifts">
      <div className={styles.skeleton} style={{ height: 34, width: 140, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 88 }} />
      <div className={styles.skeleton} style={{ height: 20, width: 160, marginTop: 6 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
    </div>
  );
}
```

- [ ] **Step 4: Verify build + manual check**

Run: `npm run build`
Expected: compiles clean.

Run: `npm run dev`, log in as `maria@harborvine.test` / `rosterhouse1`:
1. Home shows "Hi, Maria", the brand summary card with this week's real count and hours ("N shifts · X hrs total", 12-hour times, no military time anywhere).
2. Each shift card links to `/shifts/<id>` (404/not-found for now — Task 4 adds the page; the link itself must be a real `<a>`).
3. Today's shift (if any) is prefixed "Today · ".
4. Throttle the network in devtools and reload — the skeleton shows before content.
5. Log in as an employee with no published shifts (or ask: temporarily set the seed week to draft via Prisma Studio `npx prisma studio`) — the empty state reads "No shifts yet / Your manager hasn't published this week." Revert any manual data change.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(employee)/shifts/page.tsx" "src/app/(employee)/shifts/loading.tsx" src/components/employee/ShiftCard.tsx
git commit -m "feat(employee): home screen with week summary, upcoming shifts, empty and loading states"
```

---

### Task 4: Shift detail — `GET /api/shifts/[shiftId]` + `/(employee)/shifts/[shiftId]`

**Files:**

- Create: `src/lib/flags.ts`
- Modify: `src/lib/queries/employee.ts` (add `getEmployeeShiftDetail` + `ShiftDetailDto`)
- Create or modify: `src/app/api/shifts/[shiftId]/route.ts` — **Phase 3 may already have this file with `PATCH`/`DELETE` exports for managers. If it exists, add the `GET` export alongside them; do not remove or change existing exports. If it does not exist, create it with just `GET`.**
- Create: `src/app/api/shifts/[shiftId]/get.test.ts`
- Create: `src/app/(employee)/shifts/[shiftId]/page.tsx`
- Create: `src/app/(employee)/shifts/[shiftId]/loading.tsx`
- Create: `src/app/(employee)/not-found.tsx`

**Interfaces:**

- Consumes: `prisma`, `auth`, `jsonOk`/`jsonErr`, `getEmployeeContext` (Task 2), `formatShiftRange`, `shiftDurationHours`, `formatDurationHrs` from `@/lib/time`, `formatDayFull` from `@/lib/time-format`, factories (Task 2), `PageTopBar`, `Card`, `Badge`, `Avatar`, `Icon`, `Button`, `Tooltip`, `EmptyState` primitives.
- Produces:
  - `src/lib/flags.ts`: `export const SWAPS_ENABLED = false;` and `export const TIME_OFF_ENABLED = false;` — **Phase 5 flips both to `true`** when it ships the swap composer at `/swaps/new?shiftId=<id>` and the time-off request dialog.
  - `getEmployeeShiftDetail(viewer: { profileId: string; locationId: string; timezone: string }, shiftId: string): Promise<ShiftDetailDto | null>` and `type ShiftDetailDto = { id; date; dayLabel; startsAt; endsAt; positionName; isOpen; timeRange; durationHours; notes; location: { name; address; timezone }; coworkers: { name: string; positionName: string }[] }` (exact field types in code below).
  - Endpoint: `GET /api/shifts/[shiftId]` → `ShiftDetailDto`; 404 `not_found` when the shift isn't published, isn't the caller's, and isn't an open shift at the caller's location.

- [ ] **Step 1: Create the feature flags**

```ts
// src/lib/flags.ts — capability flags for features that ship in Phase 5.
// Phase 5 flips these to true when the swap composer (/swaps/new?shiftId=<id>)
// and the time-off request dialog exist.
export const SWAPS_ENABLED = false;
export const TIME_OFF_ENABLED = false;
```

- [ ] **Step 2: Write the failing integration test for the GET handler**

The file is named `get.test.ts` (not `route.test.ts`) so it never collides with a Phase 3 test for `PATCH`/`DELETE` in the same folder.

```ts
// src/app/api/shifts/[shiftId]/get.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  createTestSchedule,
  createTestShift,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function get(shiftId: string) {
  return GET(new Request(`http://test.local/api/shifts/${shiftId}`), {
    params: Promise.resolve({ shiftId }),
  });
}

describe("GET /api/shifts/[shiftId]", () => {
  let t: TestOrg;
  let maria: { userId: string; profileId: string };
  let sam: { userId: string; profileId: string };
  let alex: { userId: string; profileId: string };
  let myShiftId: string;
  let openShiftId: string;
  let samsShiftId: string;
  let myDraftShiftId: string;

  beforeAll(async () => {
    t = await createTestOrg();
    maria = await createTestEmployee(t, "Maria Test");
    sam = await createTestEmployee(t, "Sam Test");
    alex = await createTestEmployee(t, "Alex Test");
    const schedule = await createTestSchedule(t, "2026-07-06", "published");
    // Maria, Mon Jul 6, 7:00 AM – 3:00 PM (11:00Z–19:00Z), with a note.
    myShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T11:00:00.000Z",
      endsAt: "2026-07-06T19:00:00.000Z",
      status: "published",
      notes: "Bring your own knife kit.",
    });
    // Sam overlaps Maria (2:00 PM – 8:00 PM) → coworker.
    samsShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: sam.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T18:00:00.000Z",
      endsAt: "2026-07-07T00:00:00.000Z",
      status: "published",
    });
    // Alex same day but NOT overlapping (4:00 PM – 10:00 PM starts after
    // Maria ends? 20:00Z–2:00Z overlaps 11–19Z? No: starts 20:00Z > 19:00Z) → excluded.
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: alex.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T20:00:00.000Z",
      endsAt: "2026-07-07T02:00:00.000Z",
      status: "published",
    });
    // Open shift at the same location, published.
    openShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: null,
      date: "2026-07-11",
      startsAt: "2026-07-11T20:00:00.000Z",
      endsAt: "2026-07-12T02:00:00.000Z",
      status: "published",
    });
    // Maria's draft shift — invisible to her until published.
    myDraftShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: "2026-07-09",
      startsAt: "2026-07-09T11:00:00.000Z",
      endsAt: "2026-07-09T19:00:00.000Z",
      status: "draft",
    });
    authMock.mockResolvedValue({
      user: { id: maria.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns my published shift with overlapping coworkers only", async () => {
    const res = await get(myShiftId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: myShiftId,
      date: "2026-07-06",
      dayLabel: "Mon Jul 6",
      positionName: "Line cook",
      isOpen: false,
      timeRange: "7:00 AM – 3:00 PM",
      durationHours: 8,
      notes: "Bring your own knife kit.",
      location: { name: "Test location", address: "1 Test St", timezone: "America/New_York" },
    });
    expect(body.data.coworkers).toEqual([{ name: "Sam Test", positionName: "Server" }]);
  });

  it("returns an open shift at my location", async () => {
    const res = await get(openShiftId);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isOpen).toBe(true);
  });

  it("hides another employee's shift as 404", async () => {
    const res = await get(samsShiftId);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("hides my own draft shift as 404", async () => {
    const res = await get(myDraftShiftId);
    expect(res.status).toBe(404);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await get(myShiftId);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run "src/app/api/shifts/[shiftId]/get.test.ts"`
Expected: FAIL — `GET` is not exported from `./route` (or the module doesn't exist).

- [ ] **Step 4: Add `getEmployeeShiftDetail` to the query helpers**

Append to `src/lib/queries/employee.ts` (keep everything already there):

```ts
// --- append to src/lib/queries/employee.ts ---
import { formatDayFull } from "@/lib/time-format";

export type ShiftDetailDto = {
  id: string;
  date: string;
  dayLabel: string; // "Mon Jul 6"
  startsAt: string;
  endsAt: string;
  positionName: string;
  isOpen: boolean;
  timeRange: string;
  durationHours: number;
  notes: string | null;
  location: { name: string; address: string | null; timezone: string };
  coworkers: { name: string; positionName: string }[];
};

/**
 * A shift an employee may see: their own published shift, or a published
 * open shift at their location. Coworkers = other employees whose published
 * shifts at the same location + service date overlap this one in time.
 */
export async function getEmployeeShiftDetail(
  viewer: { profileId: string; locationId: string; timezone: string },
  shiftId: string
): Promise<ShiftDetailDto | null> {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      status: "published",
      OR: [
        { employeeProfileId: viewer.profileId },
        { employeeProfileId: null, locationId: viewer.locationId },
      ],
    },
    include: { position: true, location: true },
  });
  if (!shift) return null;

  const overlapping = await prisma.shift.findMany({
    where: {
      locationId: shift.locationId,
      date: shift.date,
      status: "published",
      id: { not: shift.id },
      employeeProfileId: { not: null },
      NOT: { employeeProfileId: viewer.profileId },
      startsAt: { lt: shift.endsAt },
      endsAt: { gt: shift.startsAt },
    },
    include: { employeeProfile: { include: { user: true } }, position: true },
    orderBy: { startsAt: "asc" },
  });

  const seen = new Set<string>();
  const coworkers: { name: string; positionName: string }[] = [];
  for (const s of overlapping) {
    const p = s.employeeProfile;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    coworkers.push({ name: p.user.name, positionName: s.position.name });
  }

  const dateISO = shift.date.toISOString().slice(0, 10);
  return {
    id: shift.id,
    date: dateISO,
    dayLabel: formatDayFull(dateISO),
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    positionName: shift.position.name,
    isOpen: shift.employeeProfileId === null,
    timeRange: formatShiftRange(shift.startsAt, shift.endsAt, viewer.timezone),
    durationHours: shiftDurationHours(shift.startsAt, shift.endsAt),
    notes: shift.notes,
    location: {
      name: shift.location.name,
      address: shift.location.address,
      timezone: shift.location.timezone,
    },
    coworkers,
  };
}
```

Move the `import { formatDayFull } from "@/lib/time-format";` line up to the top of the file with the other imports.

- [ ] **Step 5: Add the `GET` export to the route handler**

If `src/app/api/shifts/[shiftId]/route.ts` already exists (Phase 3 manager mutations), add only the imports you're missing and this `GET` function. Otherwise create the file with exactly this content:

```ts
// src/app/api/shifts/[shiftId]/route.ts — GET (employee-visible shift detail).
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getEmployeeContext, getEmployeeShiftDetail } from "@/lib/queries/employee";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ shiftId: string }> }
) {
  const { shiftId } = await ctx.params;
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const viewer = await getEmployeeContext(session.user.id);
  if (!viewer) {
    return jsonErr("no_profile", "No employee profile is linked to this account.", 403);
  }

  const shift = await getEmployeeShiftDetail(
    { profileId: viewer.profileId, locationId: viewer.locationId, timezone: viewer.timezone },
    shiftId
  );
  if (!shift) return jsonErr("not_found", "Shift not found.", 404);
  return jsonOk(shift);
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `npx vitest run "src/app/api/shifts/[shiftId]/get.test.ts"`
Expected: PASS — 5 tests green.

- [ ] **Step 7: Create the shift detail page, loading state, and not-found page**

```tsx
// src/app/(employee)/shifts/[shiftId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getEmployeeShiftDetail } from "@/lib/queries/employee";
import { formatDurationHrs } from "@/lib/time";
import { SWAPS_ENABLED } from "@/lib/flags";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "@/components/employee/employee.module.css";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");

  const shift = await getEmployeeShiftDetail(
    { profileId: ctx.profileId, locationId: ctx.locationId, timezone: ctx.timezone },
    shiftId
  );
  if (!shift) notFound();

  return (
    <div className={styles.screen}>
      <PageTopBar title="Shift detail" backHref="/shifts" />

      <Card>
        <div className={styles.dayLabel}>{shift.dayLabel}</div>
        <div className={styles.shiftTitle}>{shift.positionName}</div>
        <div className={styles.dayLabel}>
          {shift.timeRange} · {formatDurationHrs(shift.durationHours)}
        </div>
        <div style={{ marginTop: 10 }}>
          {shift.isOpen ? (
            <Badge tone="info">Open</Badge>
          ) : (
            <Badge tone="success">Confirmed</Badge>
          )}
        </div>
      </Card>

      <Card>
        <div className={styles.cardStack}>
          <div className={styles.iconRow}>
            <Icon name="map-pin" size={16} />
            <span>
              {shift.location.name}
              {shift.location.address ? ` · ${shift.location.address}` : ""}
            </span>
          </div>
          {shift.coworkers.length === 0 ? (
            <div className={styles.iconRow}>
              <Icon name="users" size={16} />
              <span className={styles.muted}>No one else is scheduled during this shift.</span>
            </div>
          ) : (
            shift.coworkers.map((c) => (
              <div key={c.name} className={styles.iconRow}>
                <Avatar name={c.name} size={28} />
                <span>{c.name}</span>
                <span className={styles.muted}>· {c.positionName}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {shift.notes && (
        <Card>
          <div className={styles.muted} style={{ fontWeight: 600 }}>
            Note from your manager
          </div>
          <div style={{ marginTop: 4, fontSize: 14, color: "var(--text-primary)" }}>
            {shift.notes}
          </div>
        </Card>
      )}

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
    </div>
  );
}
```

```tsx
// src/app/(employee)/shifts/[shiftId]/loading.tsx
import styles from "@/components/employee/employee.module.css";

export default function ShiftDetailLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading shift">
      <div className={styles.skeleton} style={{ height: 34, width: 140, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 110 }} />
      <div className={styles.skeleton} style={{ height: 90 }} />
      <div className={styles.skeleton} style={{ height: 70 }} />
    </div>
  );
}
```

```tsx
// src/app/(employee)/not-found.tsx — employee-group 404, rendered inside the
// mobile shell (the root-level not-found from Task 1 covers everything else).
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function EmployeeNotFound() {
  return (
    <div className={styles.screen}>
      <EmptyState
        title="This page isn't available"
        description="It may have been removed, or you may not have access to it."
        action={
          <Link href="/shifts" className={styles.linkBrand}>
            Go to home
          </Link>
        }
      />
    </div>
  );
}
```

- [ ] **Step 8: Verify build + manual check**

Run: `npm run build` — compiles clean.

Run: `npm run dev`, as Maria: tap a home shift card → detail shows day label, position, "7:00 AM – 3:00 PM · 8 hrs", Confirmed badge, location row, coworker rows with avatars, manager note card when present. "Request swap" renders as a disabled button; hovering/focusing it shows the "Coming soon" tooltip. Visiting `/shifts/nonexistent` shows the not-found screen with a working "Go to home" link.

- [ ] **Step 9: Commit**

```bash
git add src/lib/flags.ts src/lib/queries/employee.ts "src/app/api/shifts/[shiftId]" "src/app/(employee)/shifts" "src/app/(employee)/not-found.tsx"
git commit -m "feat(employee): shift detail with coworkers, notes, and gated swap entry point"
```

### Task 5: Availability editor — reducer, `GET`/`PUT /api/me/availability`, screen

**Files:**

- Create: `src/app/(employee)/availability/reducer.ts`
- Create: `src/app/(employee)/availability/reducer.test.ts`
- Modify: `src/lib/queries/employee.ts` (add `getMyAvailability` + `AvailabilityRuleDto`)
- Create: `src/app/api/me/availability/route.ts`
- Create: `src/app/api/me/availability/route.test.ts`
- Create: `src/app/(employee)/availability/AvailabilityEditor.tsx`
- Create: `src/app/(employee)/availability/availability.module.css`
- Replace (overwrite the Task 1 stub): `src/app/(employee)/availability/page.tsx`
- Create: `src/app/(employee)/availability/loading.tsx`

**Interfaces:**

- Consumes: `hhmmTo12h`, `parse12hToHhmm` from `@/lib/time-format` (Task 2); `TIME_OFF_ENABLED` from `@/lib/flags` (Task 4); primitives `Button`, `Card`, `Switch`, `Tabs`, `TimeField`, `Sheet`, `Tooltip`, `useToast`; `PageTopBar` (Task 1); `prisma`, `auth`, `jsonOk`/`jsonErr`, `getEmployeeContext`, factories (Task 2). `AvailabilityRule` storage: `dayOfWeek` 0=Mon..6=Sun, `startTime`/`endTime` are `"HH:mm"` location-local 24-hour strings, both-`NULL` = available all day.
- Produces:
  - `AvailabilityRuleDto = { dayOfWeek: number; isAvailable: boolean; startTime: string | null; endTime: string | null }` (exported from `@/lib/queries/employee`; Phase 5 reuses it), and `getMyAvailability(profileId: string): Promise<AvailabilityRuleDto[]>` — always returns exactly 7 rules sorted by `dayOfWeek`, filling missing days with `{ isAvailable: true, startTime: null, endTime: null }`.
  - Endpoints: `GET /api/me/availability` → `{ rules: AvailabilityRuleDto[] }`; `PUT /api/me/availability` body `{ rules: AvailabilityRuleDto[] }` (exactly 7, one per day) → replaces all rows in one transaction, returns `{ rules }`.
  - Reducer module (used only inside this route, but its exact API is what the unit tests pin): `initEditor(rules: AvailabilityRuleDto[]): EditorState`, `editorReducer(state, action): EditorState`, `toDto(days: EditorDay[]): { ok: true; rules: AvailabilityRuleDto[] } | { ok: false; errors: Record<number, string> }`, `DAY_NAMES` (`["Mon",...,"Sun"]`).

- [ ] **Step 1: Write the failing reducer unit tests**

```ts
// src/app/(employee)/availability/reducer.test.ts
import { describe, expect, it } from "vitest";
import {
  DAY_NAMES,
  editorReducer,
  initEditor,
  toDto,
  type EditorState,
} from "./reducer";
import type { AvailabilityRuleDto } from "@/lib/queries/employee";

const storedRules: AvailabilityRuleDto[] = [
  { dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 1, isAvailable: false, startTime: null, endTime: null },
  { dayOfWeek: 2, isAvailable: true, startTime: null, endTime: null },
  { dayOfWeek: 3, isAvailable: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 4, isAvailable: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 5, isAvailable: false, startTime: null, endTime: null },
  { dayOfWeek: 6, isAvailable: false, startTime: null, endTime: null },
];

describe("initEditor", () => {
  it("maps stored 24-hour windows to 12-hour display and starts clean", () => {
    const s = initEditor(storedRules);
    expect(s.days).toHaveLength(7);
    expect(s.days[0]).toEqual({ dayOfWeek: 0, isAvailable: true, start: "9:00 AM", end: "5:00 PM" });
    expect(s.days[2]).toEqual({ dayOfWeek: 2, isAvailable: true, start: "", end: "" }); // all day
    expect(s.dirty).toBe(false);
  });

  it("defaults missing days to available all day", () => {
    const s = initEditor([]);
    expect(s.days).toHaveLength(7);
    expect(s.days.every((d) => d.isAvailable && d.start === "" && d.end === "")).toBe(true);
  });
});

describe("editorReducer dirty tracking", () => {
  it("toggling a day sets dirty; toggling it back clears dirty", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    expect(s.days[1].isAvailable).toBe(true);
    expect(s.dirty).toBe(true);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    expect(s.dirty).toBe(false);
  });

  it("editing a time sets dirty", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 0, field: "start", value: "10:00 AM" });
    expect(s.days[0].start).toBe("10:00 AM");
    expect(s.dirty).toBe(true);
  });

  it("markSaved rebaselines: state is clean against the new snapshot", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    s = editorReducer(s, { type: "markSaved" });
    expect(s.dirty).toBe(false);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    expect(s.dirty).toBe(true);
  });
});

describe("applyPreset", () => {
  it("weekdays: Mon–Fri on, Sat/Sun off, hour windows untouched", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "applyPreset", preset: "weekdays" });
    expect(s.days.map((d) => d.isAvailable)).toEqual([true, true, true, true, true, false, false]);
    expect(s.days[0].start).toBe("9:00 AM"); // windows preserved
  });

  it("weekends and everyday presets", () => {
    let s = editorReducer(initEditor(storedRules), { type: "applyPreset", preset: "weekends" });
    expect(s.days.map((d) => d.isAvailable)).toEqual([false, false, false, false, false, true, true]);
    s = editorReducer(s, { type: "applyPreset", preset: "everyday" });
    expect(s.days.every((d) => d.isAvailable)).toBe(true);
  });
});

describe("toDto validation", () => {
  it("converts display times back to 24-hour storage", () => {
    const s = initEditor(storedRules);
    const r = toDto(s.days);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rules[0]).toEqual({ dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" });
      expect(r.rules[2]).toEqual({ dayOfWeek: 2, isAvailable: true, startTime: null, endTime: null });
    }
  });

  it("rejects a half-filled window", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 2, field: "start", value: "9:00 AM" });
    const r = toDto(s.days);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[2]).toBe("Enter both a start and end time, or leave both blank for all day.");
    }
  });

  it("rejects unparseable times", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 0, field: "start", value: "soonish" });
    const r = toDto(s.days);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toBe("Enter times like 9:00 AM.");
  });

  it("rejects end before start", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 0, field: "end", value: "8:00 AM" });
    const r = toDto(s.days);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toBe("End time must be after start time.");
  });

  it("ignores stale window text on unavailable days", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 0 }); // Mon off; still has 9–5 text
    const r = toDto(s.days);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rules[0]).toEqual({ dayOfWeek: 0, isAvailable: false, startTime: null, endTime: null });
  });
});

describe("DAY_NAMES", () => {
  it("is Monday-first", () => {
    expect(DAY_NAMES).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run "src/app/(employee)/availability/reducer.test.ts"`
Expected: FAIL — cannot resolve `./reducer` (and `AvailabilityRuleDto` isn't exported yet).

- [ ] **Step 3: Add `AvailabilityRuleDto` + `getMyAvailability` to the query helpers**

Append to `src/lib/queries/employee.ts`:

```ts
// --- append to src/lib/queries/employee.ts ---

export type AvailabilityRuleDto = {
  dayOfWeek: number; // 0=Mon..6=Sun
  isAvailable: boolean;
  startTime: string | null; // "09:00" location-local 24-hour; null = all day
  endTime: string | null;
};

/** Always exactly 7 rules, dayOfWeek 0..6; missing days default to available all day. */
export async function getMyAvailability(profileId: string): Promise<AvailabilityRuleDto[]> {
  const rows = await prisma.availabilityRule.findMany({
    where: { employeeProfileId: profileId },
  });
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  const rules: AvailabilityRuleDto[] = [];
  for (let d = 0; d < 7; d++) {
    const rule = byDay.get(d);
    rules.push({
      dayOfWeek: d,
      isAvailable: rule ? rule.isAvailable : true,
      startTime: rule?.startTime ?? null,
      endTime: rule?.endTime ?? null,
    });
  }
  return rules;
}
```

- [ ] **Step 4: Implement the reducer**

```ts
// src/app/(employee)/availability/reducer.ts — pure state for the editor.
// Display times are 12-hour text ("9:00 AM"); "" for both start and end
// means "available all day" (stored as NULL/NULL).
import { hhmmTo12h, parse12hToHhmm } from "@/lib/time-format";
import type { AvailabilityRuleDto } from "@/lib/queries/employee";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type EditorDay = {
  dayOfWeek: number;
  isAvailable: boolean;
  start: string;
  end: string;
};

export type EditorState = {
  days: EditorDay[];
  saved: EditorDay[]; // last-saved snapshot; dirty = days differ from it
  dirty: boolean;
  errors: Record<number, string>; // dayOfWeek → message
};

export type EditorAction =
  | { type: "toggleDay"; dayOfWeek: number }
  | { type: "setTime"; dayOfWeek: number; field: "start" | "end"; value: string }
  | { type: "applyPreset"; preset: "everyday" | "weekdays" | "weekends" }
  | { type: "markSaved" }
  | { type: "setErrors"; errors: Record<number, string> };

export function initEditor(rules: AvailabilityRuleDto[]): EditorState {
  const byDay = new Map(rules.map((r) => [r.dayOfWeek, r]));
  const days: EditorDay[] = [];
  for (let d = 0; d < 7; d++) {
    const rule = byDay.get(d);
    days.push({
      dayOfWeek: d,
      isAvailable: rule ? rule.isAvailable : true,
      start: rule?.startTime ? hhmmTo12h(rule.startTime) : "",
      end: rule?.endTime ? hhmmTo12h(rule.endTime) : "",
    });
  }
  return { days, saved: days, dirty: false, errors: {} };
}

function sameDays(a: EditorDay[], b: EditorDay[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "toggleDay": {
      const days = state.days.map((d) =>
        d.dayOfWeek === action.dayOfWeek ? { ...d, isAvailable: !d.isAvailable } : d
      );
      return { ...state, days, dirty: !sameDays(days, state.saved), errors: {} };
    }
    case "setTime": {
      const days = state.days.map((d) =>
        d.dayOfWeek === action.dayOfWeek ? { ...d, [action.field]: action.value } : d
      );
      return { ...state, days, dirty: !sameDays(days, state.saved), errors: {} };
    }
    case "applyPreset": {
      const on =
        action.preset === "everyday"
          ? [0, 1, 2, 3, 4, 5, 6]
          : action.preset === "weekdays"
            ? [0, 1, 2, 3, 4]
            : [5, 6];
      const days = state.days.map((d) => ({ ...d, isAvailable: on.includes(d.dayOfWeek) }));
      return { ...state, days, dirty: !sameDays(days, state.saved), errors: {} };
    }
    case "markSaved":
      return { ...state, saved: state.days, dirty: false, errors: {} };
    case "setErrors":
      return { ...state, errors: action.errors };
  }
}

/** Validate + convert display state to storage DTOs. */
export function toDto(
  days: EditorDay[]
): { ok: true; rules: AvailabilityRuleDto[] } | { ok: false; errors: Record<number, string> } {
  const errors: Record<number, string> = {};
  const rules: AvailabilityRuleDto[] = [];
  for (const d of days) {
    const start = d.start.trim();
    const end = d.end.trim();
    if (!d.isAvailable || (start === "" && end === "")) {
      rules.push({ dayOfWeek: d.dayOfWeek, isAvailable: d.isAvailable, startTime: null, endTime: null });
      continue;
    }
    if (start === "" || end === "") {
      errors[d.dayOfWeek] = "Enter both a start and end time, or leave both blank for all day.";
      continue;
    }
    const startTime = parse12hToHhmm(start);
    const endTime = parse12hToHhmm(end);
    if (!startTime || !endTime) {
      errors[d.dayOfWeek] = "Enter times like 9:00 AM.";
      continue;
    }
    if (startTime >= endTime) {
      errors[d.dayOfWeek] = "End time must be after start time.";
      continue;
    }
    rules.push({ dayOfWeek: d.dayOfWeek, isAvailable: true, startTime, endTime });
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, rules };
}
```

- [ ] **Step 5: Run the reducer tests to see them pass**

Run: `npx vitest run "src/app/(employee)/availability/reducer.test.ts"`
Expected: PASS — all tests green.

- [ ] **Step 6: Write the failing integration test for the availability API**

```ts
// src/app/api/me/availability/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET, PUT } from "./route";

const authMock = auth as unknown as Mock;

function rules(overrides: Partial<Record<number, { isAvailable?: boolean; startTime?: string | null; endTime?: string | null }>> = {}) {
  return Array.from({ length: 7 }, (_, d) => ({
    dayOfWeek: d,
    isAvailable: overrides[d]?.isAvailable ?? true,
    startTime: overrides[d]?.startTime ?? null,
    endTime: overrides[d]?.endTime ?? null,
  }));
}

function put(body: unknown) {
  return PUT(
    new Request("http://test.local/api/me/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("/api/me/availability", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Priya Test");
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Priya Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("GET returns 7 default rules when none are stored", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.rules).toHaveLength(7);
    expect(body.data.rules[0]).toEqual({
      dayOfWeek: 0,
      isAvailable: true,
      startTime: null,
      endTime: null,
    });
  });

  it("PUT replaces all 7 rules in a transaction", async () => {
    const first = rules({ 0: { startTime: "09:00", endTime: "17:00" }, 5: { isAvailable: false }, 6: { isAvailable: false } });
    const res = await put({ rules: first });
    expect(res.status).toBe(200);
    let stored = await prisma.availabilityRule.findMany({
      where: { employeeProfileId: emp.profileId },
      orderBy: { dayOfWeek: "asc" },
    });
    expect(stored).toHaveLength(7);
    expect(stored[0].startTime).toBe("09:00");
    expect(stored[5].isAvailable).toBe(false);

    // Second PUT fully replaces the first.
    const second = rules({ 0: { startTime: "10:00", endTime: "16:00" } });
    await put({ rules: second });
    stored = await prisma.availabilityRule.findMany({
      where: { employeeProfileId: emp.profileId },
      orderBy: { dayOfWeek: "asc" },
    });
    expect(stored).toHaveLength(7);
    expect(stored[0].startTime).toBe("10:00");
    expect(stored[5].isAvailable).toBe(true);
  });

  it("PUT rejects a payload without one rule per day", async () => {
    const res = await put({ rules: rules().slice(0, 6) });
    expect(res.status).toBe(400);
  });

  it("PUT rejects end before start with a specific message", async () => {
    const res = await put({ rules: rules({ 0: { startTime: "17:00", endTime: "09:00" } }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("End time must be after start time.");
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Run the test to see it fail**

Run: `npx vitest run src/app/api/me/availability/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 8: Implement the route handler**

```ts
// src/app/api/me/availability/route.ts
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { getEmployeeContext, getMyAvailability } from "@/lib/queries/employee";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const ruleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isAvailable: z.boolean(),
    startTime: z.string().regex(timeRe, "Times must look like 09:00.").nullable(),
    endTime: z.string().regex(timeRe, "Times must look like 09:00.").nullable(),
  })
  .refine((r) => (r.startTime === null) === (r.endTime === null), {
    message: "Provide both start and end times, or neither.",
  })
  .refine((r) => r.startTime === null || r.endTime === null || r.startTime < r.endTime, {
    message: "End time must be after start time.",
  });

const putSchema = z
  .object({ rules: z.array(ruleSchema).length(7, "Provide one rule for each day of the week.") })
  .refine((b) => new Set(b.rules.map((r) => r.dayOfWeek)).size === 7, {
    message: "Provide one rule for each day of the week.",
  });

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);
  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);
  return jsonOk({ rules: await getMyAvailability(ctx.profileId) });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonErr("invalid_request", "Send a JSON body.", 400);
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("invalid_request", parsed.error.issues[0].message, 400);
  }

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { employeeProfileId: ctx.profileId } }),
    prisma.availabilityRule.createMany({
      data: parsed.data.rules.map((r) => ({ ...r, employeeProfileId: ctx.profileId })),
    }),
  ]);

  return jsonOk({ rules: parsed.data.rules });
}
```

- [ ] **Step 9: Run the API tests to see them pass**

Run: `npx vitest run src/app/api/me/availability/route.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 10: Build the editor UI**

The design (`AvailabilityScreen` in the export) has **no save affordance** — availability edits silently vanish. This screen fixes that: a sticky save button enabled on dirty state, plus an unsaved-changes guard that intercepts in-app link taps (the tab bar renders real `<a>` elements, so a capture-phase click listener catches them without coupling the chrome to this screen).

```css
/* src/app/(employee)/availability/availability.module.css */
.presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dayRow {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.times {
  display: flex;
  gap: 8px;
  padding-left: 2px;
}

.timeField {
  flex: 1;
}

.dayError {
  font-size: 12px;
  color: var(--status-danger);
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.saveBar {
  position: sticky;
  bottom: 0;
  margin: 8px -20px -24px;
  padding: 12px 20px 16px;
  background: var(--surface-page);
  border-top: 1px solid var(--border-default);
}

.sheetActions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}
```

```tsx
// src/app/(employee)/availability/AvailabilityEditor.tsx
"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { TimeField } from "@/components/ui/TimeField";
import { Sheet } from "@/components/ui/Sheet";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toaster";
import { TIME_OFF_ENABLED } from "@/lib/flags";
import type { AvailabilityRuleDto } from "@/lib/queries/employee";
import { DAY_NAMES, editorReducer, initEditor, toDto } from "./reducer";
import s from "./availability.module.css";
import ui from "@/components/employee/employee.module.css";

const PRESETS = [
  { key: "everyday", label: "Every day" },
  { key: "weekdays", label: "Weekdays only" },
  { key: "weekends", label: "Weekends only" },
] as const;

export function AvailabilityEditor({ initialRules }: { initialRules: AvailabilityRuleDto[] }) {
  const [state, dispatch] = useReducer(editorReducer, initialRules, initEditor);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [saving, setSaving] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const dirtyRef = useRef(state.dirty);
  dirtyRef.current = state.dirty;

  // Unsaved-changes guard: while dirty, intercept in-app link taps (tab bar,
  // bell — all real anchors) and hard reloads.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  async function save() {
    const result = toDto(state.days);
    if (!result.ok) {
      dispatch({ type: "setErrors", errors: result.errors });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: result.rules }),
      });
      const body = await res.json();
      if (!body.ok) {
        toast({ tone: "danger", title: "Couldn't save your availability", description: body.error.message });
        return;
      }
      dispatch({ type: "markSaved" });
      toast({ tone: "success", title: "Availability saved" });
    } catch {
      toast({
        tone: "danger",
        title: "Couldn't save your availability",
        description: "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  function discardAndGo() {
    const href = pendingHref;
    setPendingHref(null);
    if (!href) return;
    dispatch({ type: "markSaved" }); // neutralize the guard; we're leaving
    router.push(href);
  }

  return (
    <>
      <div className={ui.muted}>Your weekly availability repeats every week until you change it.</div>

      <div className={s.presets}>
        {PRESETS.map((p) => (
          <Button key={p.key} variant="secondary" size="sm" onClick={() => dispatch({ type: "applyPreset", preset: p.key })}>
            {p.label}
          </Button>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: "simple", label: "Simple" },
          { value: "advanced", label: "Advanced" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as "simple" | "advanced")}
      />

      {mode === "simple" && (
        <Card>
          <div className={ui.cardStack}>
            {state.days.map((d) => (
              <Switch
                key={d.dayOfWeek}
                label={DAY_NAMES[d.dayOfWeek]}
                checked={d.isAvailable}
                onChange={() => dispatch({ type: "toggleDay", dayOfWeek: d.dayOfWeek })}
              />
            ))}
          </div>
        </Card>
      )}

      {mode === "advanced" && (
        <Card>
          <div className={ui.cardStack}>
            <div className={s.hint}>Leave both times blank if you&apos;re available all day.</div>
            {state.days.map((d) => (
              <div key={d.dayOfWeek} className={s.dayRow}>
                <Switch
                  label={DAY_NAMES[d.dayOfWeek]}
                  checked={d.isAvailable}
                  onChange={() => dispatch({ type: "toggleDay", dayOfWeek: d.dayOfWeek })}
                />
                {d.isAvailable && (
                  <div className={s.times}>
                    <div className={s.timeField}>
                      <TimeField
                        label="Start"
                        placeholder="9:00 AM"
                        value={d.start}
                        onChange={(v) => dispatch({ type: "setTime", dayOfWeek: d.dayOfWeek, field: "start", value: v })}
                      />
                    </div>
                    <div className={s.timeField}>
                      <TimeField
                        label="End"
                        placeholder="5:00 PM"
                        value={d.end}
                        onChange={(v) => dispatch({ type: "setTime", dayOfWeek: d.dayOfWeek, field: "end", value: v })}
                      />
                    </div>
                  </div>
                )}
                {state.errors[d.dayOfWeek] && (
                  <div className={s.dayError} role="alert">
                    {state.errors[d.dayOfWeek]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Phase 5 replaces this with the real time-off request dialog. */}
      {!TIME_OFF_ENABLED && (
        <Tooltip label="Coming soon">
          <Button variant="secondary" fullWidth disabled>
            Request time off
          </Button>
        </Tooltip>
      )}

      <div className={s.saveBar}>
        <Button variant="primary" fullWidth disabled={!state.dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save availability"}
        </Button>
      </div>

      <Sheet open={pendingHref !== null} onClose={() => setPendingHref(null)} title="Discard unsaved changes?">
        <div className={ui.muted}>Your availability changes haven&apos;t been saved.</div>
        <div className={s.sheetActions}>
          <Button variant="secondary" fullWidth onClick={() => setPendingHref(null)}>
            Keep editing
          </Button>
          <Button variant="danger" fullWidth onClick={discardAndGo}>
            Discard changes
          </Button>
        </div>
      </Sheet>
    </>
  );
}
```

```tsx
// src/app/(employee)/availability/page.tsx  (replaces the Task 1 stub)
import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getMyAvailability } from "@/lib/queries/employee";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { AvailabilityEditor } from "./AvailabilityEditor";
import styles from "@/components/employee/employee.module.css";

export default async function AvailabilityPage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");
  const rules = await getMyAvailability(ctx.profileId);

  return (
    <div className={styles.screen}>
      <PageTopBar title="Availability" />
      <AvailabilityEditor initialRules={rules} />
    </div>
  );
}
```

```tsx
// src/app/(employee)/availability/loading.tsx
import styles from "@/components/employee/employee.module.css";

export default function AvailabilityLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading availability">
      <div className={styles.skeleton} style={{ height: 34, width: 160, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 18, width: 260 }} />
      <div className={styles.skeleton} style={{ height: 36 }} />
      <div className={styles.skeleton} style={{ height: 320 }} />
    </div>
  );
}
```

Note: `import type { AvailabilityRuleDto } from "@/lib/queries/employee";` in client files is safe — `import type` is erased at compile time, so the server-only prisma module never enters the client bundle. Keep the `type` keyword.

- [ ] **Step 11: Verify build + manual check**

Run: `npm run build` — compiles clean.

Run: `npm run dev`, as Maria on `/availability`:
1. Simple tab shows 7 Mon-first switch rows reflecting her seeded rules; save button is disabled.
2. Toggle a day → save button enables. Toggle it back → disables again (dirty tracking is comparison-based).
3. "Weekdays only" preset flips switches, keeps hour windows.
4. Advanced tab: set Tue 10:00 AM / 4:00 PM → Save → toast "Availability saved", button disables. Reload — values persist.
5. Enter "soonish" as a time → Save → inline error "Enter times like 9:00 AM.", nothing saved.
6. Make a change, then tap the Shifts tab → bottom sheet "Discard unsaved changes?"; "Keep editing" stays; "Discard changes" navigates home (`/shifts`).
7. Make a change and hit browser reload → native leave-page warning appears.

- [ ] **Step 12: Commit**

```bash
git add "src/app/(employee)/availability" src/app/api/me/availability src/lib/queries/employee.ts
git commit -m "feat(employee): availability editor with presets, dirty-state save, and unsaved-changes guard"
```

### Task 6: Manager availability overview — `/manager/availability`

The export's `AvailabilityOverview.jsx` is lossy (review findings): it renders booleans for only 5 of 10 employees and throws away the hour windows employees enter. This page fixes both: **all active employees**, cells show **hour windows** ("9:00 AM – 5:00 PM"), plus an approved-time-off overlay for the displayed week.

**Files:**

- Create: `src/lib/queries/availability.ts`
- Create: `src/lib/queries/availability.test.ts`
- Create: `src/app/api/locations/[locationId]/availability/route.ts`
- Create: `src/app/api/locations/[locationId]/availability/route.test.ts`
- Create: `src/app/manager/availability/page.tsx`
- Create: `src/app/manager/availability/availability.module.css`
- Create: `src/app/manager/availability/loading.tsx`

**Interfaces:**

- Consumes: `prisma`; `weekDatesOf`, `weekStartOf`, `addDaysISO`, `formatDayLabel` from `@/lib/time` (Phase 3); `hhmmTo12h`, `formatWeekOf` from `@/lib/time-format` (Task 2); `requireManager` from `@/lib/auth` and `getManagerLocation` from `@/lib/authz` (Phase 2); `DatePager` chrome (`{ label, prevHref, nextHref, todayHref? }`); `Avatar`, `EmptyState` primitives; factories (Task 2). The `/manager` layout (rail navigation) exists from Phase 3 — this page only supplies `page.tsx` content.
- Produces:
  - `getLocationAvailability(locationId: string, weekStart: string): Promise<LocationAvailability>` with `type OverviewDay = { dayOfWeek: number; date: string; isAvailable: boolean; startTime: string | null; endTime: string | null; timeOff: boolean }`, `type OverviewEmployee = { profileId: string; name: string; primaryPositionName: string | null; days: OverviewDay[] }`, `type LocationAvailability = { weekStart: string; employees: OverviewEmployee[] }` from `@/lib/queries/availability` (Phase 5 reuses this for approvals context).
  - Endpoint: `GET /api/locations/[locationId]/availability?week=YYYY-MM-DD` → `LocationAvailability` (manager-only; 403 unless the location is the caller's).

- [ ] **Step 1: Write the failing integration test for the query helper**

```ts
// src/lib/queries/availability.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { getLocationAvailability } from "./availability";

const WEEK = "2026-07-06"; // Monday

describe("getLocationAvailability", () => {
  let t: TestOrg;
  let maria: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    maria = await createTestEmployee(t, "Maria Test");
    await createTestEmployee(t, "Norule Test"); // no rules → all-day defaults
    const inactive = await createTestEmployee(t, "Inactive Test");
    await prisma.employeeProfile.update({
      where: { id: inactive.profileId },
      data: { status: "inactive" },
    });

    // Maria: Mon 9–5 window, Tue unavailable; other days default (no rows).
    await prisma.availabilityRule.createMany({
      data: [
        { employeeProfileId: maria.profileId, dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" },
        { employeeProfileId: maria.profileId, dayOfWeek: 1, isAvailable: false, startTime: null, endTime: null },
      ],
    });
    // Approved time off Wed–Thu of the displayed week; a denied one is ignored.
    await prisma.timeOffRequest.createMany({
      data: [
        {
          employeeProfileId: maria.profileId,
          startDate: new Date("2026-07-08T00:00:00.000Z"),
          endDate: new Date("2026-07-09T00:00:00.000Z"),
          reason: "vacation",
          status: "approved",
        },
        {
          employeeProfileId: maria.profileId,
          startDate: new Date("2026-07-10T00:00:00.000Z"),
          endDate: new Date("2026-07-10T00:00:00.000Z"),
          reason: "personal",
          status: "denied",
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns all active employees with per-day windows and time-off overlay", async () => {
    const data = await getLocationAvailability(t.locationId, WEEK);
    expect(data.weekStart).toBe(WEEK);
    expect(data.employees.map((e) => e.name)).toEqual(["Maria Test", "Norule Test"]); // sorted; inactive excluded

    const mariaDays = data.employees[0].days;
    expect(mariaDays).toHaveLength(7);
    expect(mariaDays[0]).toEqual({
      dayOfWeek: 0,
      date: "2026-07-06",
      isAvailable: true,
      startTime: "09:00",
      endTime: "17:00",
      timeOff: false,
    });
    expect(mariaDays[1].isAvailable).toBe(false);
    expect(mariaDays[2].timeOff).toBe(true); // Wed
    expect(mariaDays[3].timeOff).toBe(true); // Thu
    expect(mariaDays[4].timeOff).toBe(false); // Fri — denied request ignored

    const noruleDays = data.employees[1].days;
    expect(noruleDays.every((d) => d.isAvailable && d.startTime === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/queries/availability.test.ts`
Expected: FAIL — cannot resolve `./availability`.

- [ ] **Step 3: Implement the query helper**

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
    orderBy: { user: { name: "asc" } },
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
      primaryPositionName: p.primaryPosition?.name ?? null,
      days,
    };
  });

  return { weekStart, employees };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/queries/availability.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route test (tenancy)**

```ts
// src/app/api/locations/[locationId]/availability/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/authz", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/authz")>();
  return { ...mod }; // real authz; only auth is mocked
});

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function get(locationId: string, week?: string) {
  const qs = week ? `?week=${week}` : "";
  return GET(new Request(`http://test.local/api/locations/${locationId}/availability${qs}`), {
    params: Promise.resolve({ locationId }),
  });
}

describe("GET /api/locations/[locationId]/availability", () => {
  let mine: TestOrg;
  let other: TestOrg;

  beforeAll(async () => {
    mine = await createTestOrg();
    other = await createTestOrg();
    await createTestEmployee(mine, "Maria Test");
  });

  afterAll(async () => {
    await deleteTestOrg(mine.organizationId);
    await deleteTestOrg(other.organizationId);
  });

  it("returns the week for the manager's own location", async () => {
    authMock.mockResolvedValue({
      user: { id: mine.managerUserId, name: "Test Manager", role: "manager", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId, "2026-07-06");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.weekStart).toBe("2026-07-06");
    expect(body.data.employees).toHaveLength(1);
  });

  it("rejects an employee caller", async () => {
    const emp = await createTestEmployee(mine, "Sam Test");
    authMock.mockResolvedValueOnce({
      user: { id: emp.userId, name: "Sam Test", role: "employee", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId, "2026-07-06");
    expect(res.status).toBe(403);
  });

  it("rejects a manager from another organization's location", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: other.managerUserId, name: "Other Manager", role: "manager", organizationId: other.organizationId },
    });
    const res = await get(mine.locationId, "2026-07-06");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toBe("You don't have access to this location.");
  });

  it("rejects a malformed week", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: mine.managerUserId, name: "Test Manager", role: "manager", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId, "July-6");
    expect(res.status).toBe(400);
  });
});
```

Note: `getManagerLocation` (Phase 2) resolves the manager's sole location from the DB, so the test's second org exercises the tenancy check for real. If `getManagerLocation` throws for the employee caller, the handler's role check fires first, so that path is never reached.

- [ ] **Step 6: Run the test to see it fail**

Run: `npx vitest run "src/app/api/locations/[locationId]/availability/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 7: Implement the route handler**

```ts
// src/app/api/locations/[locationId]/availability/route.ts
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { jsonErr, jsonOk } from "@/lib/api";
import { weekStartOf } from "@/lib/time";
import { getLocationAvailability } from "@/lib/queries/availability";

const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD week start.");

export async function GET(
  request: Request,
  ctx: { params: Promise<{ locationId: string }> }
) {
  const { locationId } = await ctx.params;
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);
  if (session.user.role !== "manager") {
    return jsonErr("forbidden", "Only managers can view team availability.", 403);
  }

  const location = await getManagerLocation(session.user.id);
  if (location.id !== locationId) {
    return jsonErr("forbidden", "You don't have access to this location.", 403);
  }

  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week") ?? weekStartOf(new Date(), location.timezone);
  const parsed = weekSchema.safeParse(weekParam);
  if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

  return jsonOk(await getLocationAvailability(locationId, parsed.data));
}
```

- [ ] **Step 8: Run the test to see it pass**

Run: `npx vitest run "src/app/api/locations/[locationId]/availability/route.test.ts"`
Expected: PASS — 4 tests green.

- [ ] **Step 9: Build the page**

```css
/* src/app/manager/availability/availability.module.css */
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

.gridWrap {
  overflow-x: auto;
}

.grid {
  display: grid;
  grid-template-columns: 200px repeat(7, minmax(96px, 1fr));
  gap: 8px;
  align-items: center;
  min-width: 900px;
}

.dayHead {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
}

.person {
  display: flex;
  align-items: center;
  gap: 10px;
}

.personName {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.personRole {
  font-size: 12px;
  color: var(--text-secondary);
}

.cell {
  min-height: 34px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  padding: 4px 6px;
  text-align: center;
}

.cellOn {
  background: var(--status-success-bg);
  border: 1px solid var(--green-300);
  color: var(--green-800);
}

.cellOff {
  background: var(--surface-sunken);
  border: 1px solid var(--border-default);
  color: var(--text-tertiary);
}

.cellTimeOff {
  background: var(--status-warning-bg);
  border: 1px solid var(--amber-300);
  color: var(--amber-800);
}

.skeleton {
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
  animation: overviewPulse 1.2s ease-in-out infinite;
}

@keyframes overviewPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
```

```tsx
// src/app/manager/availability/page.tsx
import { Fragment } from "react";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getLocationAvailability, type OverviewDay } from "@/lib/queries/availability";
import { addDaysISO, formatDayLabel, weekDatesOf, weekStartOf } from "@/lib/time";
import { formatWeekOf, hhmmTo12h } from "@/lib/time-format";
import { DatePager } from "@/components/chrome/DatePager";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
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

  const data = await getLocationAvailability(location.id, weekStart);
  const dates = weekDatesOf(weekStart);

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
        <div className={styles.gridWrap}>
          <div className={styles.grid}>
            <div />
            {dates.map((d) => (
              <div key={d} className={styles.dayHead}>
                {formatDayLabel(d)}
              </div>
            ))}
            {data.employees.map((e) => (
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
                {e.days.map((day) => (
                  <AvailabilityCell key={day.date} day={day} />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

```tsx
// src/app/manager/availability/loading.tsx
import styles from "./availability.module.css";

export default function ManagerAvailabilityLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading team availability">
      <div className={styles.skeleton} style={{ height: 34, width: 240 }} />
      <div className={styles.skeleton} style={{ height: 420 }} />
    </div>
  );
}
```

- [ ] **Step 10: Verify build + manual check**

Run: `npm run build` — compiles clean.

Run: `npm run dev`, as `jamie@harborvine.test`:
1. `/manager/availability` lists **every** active seeded employee (10), sorted by name, Mon–Sun columns.
2. Employees with hour windows show "9:00 AM – 5:00 PM"-style cells (en dash, 12-hour); all-day availability shows "All day"; unavailable days show muted "Unavailable".
3. Any seeded approved time off shows amber "Time off" cells in the matching week.
4. The DatePager arrows move ±1 week and update `?week=`; the label reads "Week of Jul 6" style.

- [ ] **Step 11: Commit**

```bash
git add src/lib/queries/availability.ts src/lib/queries/availability.test.ts "src/app/api/locations" src/app/manager/availability
git commit -m "feat(manager): availability overview with hour windows, all employees, and time-off overlay"
```

---

### Task 7: Notifications — feed, unread badge, mark-read, deep links

**Files:**

- Create: `src/lib/notification-links.ts`
- Create: `src/lib/notification-links.test.ts`
- Modify: `src/lib/queries/employee.ts` (add `NotificationDto`, `getMyNotifications`, `markNotificationsRead`)
- Create: `src/app/api/me/notifications/route.ts`
- Create: `src/app/api/me/notifications/route.test.ts`
- Create: `src/app/api/me/notifications/read/route.ts`
- Create: `src/app/api/me/notifications/read/route.test.ts`
- Create: `src/app/(employee)/notifications/NotificationsList.tsx`
- Replace (overwrite the Task 1 stub): `src/app/(employee)/notifications/page.tsx`
- Create: `src/app/(employee)/notifications/loading.tsx`

**Interfaces:**

- Consumes: `prisma`, `auth`, `jsonOk`/`jsonErr`, factories (Task 2); `timeAgo` from `@/lib/time-format` (Task 2); `PageTopBar` (Task 1 — its bell badge counts `readAt: null` rows, so marking read clears the badge on the next server render); `Card`, `Button`, `EmptyState` primitives. Phase 3's publish transaction writes `Notification` rows via `notifyUsers` — this feed displays them.
- Produces:
  - `notificationHref(type: string): string` from `@/lib/notification-links` — deep-link table: `schedule_published`/`shift_reminder` → `/shifts` (employee home); `swap_approved`/`swap_denied`/`claim_approved`/`claim_denied`/`open_shift_posted` → `/swaps`; `timeoff_approved`/`timeoff_denied` → `/availability`; unknown → `/shifts`. Phase 5 reuses this.
  - `NotificationDto = { id: string; type: string; title: string; body: string; createdAt: string; readAt: string | null }`; `getMyNotifications(userId: string, opts?: { cursor?: string; limit?: number }): Promise<{ notifications: NotificationDto[]; nextCursor: string | null; unreadCount: number }>`; `markNotificationsRead(userId: string, ids?: string[]): Promise<number>` (both in `@/lib/queries/employee`).
  - Endpoints: `GET /api/me/notifications?cursor=&limit=` (newest first, default limit 20, max 50); `POST /api/me/notifications/read` body `{ ids?: string[] }` (omit ids = mark all) → `{ updated: number }`.

- [ ] **Step 1: Write the failing unit test for the deep-link map**

```ts
// src/lib/notification-links.test.ts
import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-links";

describe("notificationHref", () => {
  it("routes each notification type to its screen", () => {
    expect(notificationHref("schedule_published")).toBe("/shifts");
    expect(notificationHref("shift_reminder")).toBe("/shifts");
    expect(notificationHref("swap_approved")).toBe("/swaps");
    expect(notificationHref("swap_denied")).toBe("/swaps");
    expect(notificationHref("claim_approved")).toBe("/swaps");
    expect(notificationHref("claim_denied")).toBe("/swaps");
    expect(notificationHref("open_shift_posted")).toBe("/swaps");
    expect(notificationHref("timeoff_approved")).toBe("/availability");
    expect(notificationHref("timeoff_denied")).toBe("/availability");
  });

  it("falls back to the home screen for unknown types", () => {
    expect(notificationHref("something_new")).toBe("/shifts");
  });
});
```

- [ ] **Step 2: Run it to see it fail, then implement**

Run: `npx vitest run src/lib/notification-links.test.ts` — Expected: FAIL (module missing).

```ts
// src/lib/notification-links.ts — where tapping a notification takes you.
// Mirrors the NotificationType enum in prisma/schema.prisma; kept as string
// literals so client components never import the Prisma client.
export type NotificationType =
  | "schedule_published"
  | "shift_reminder"
  | "swap_approved"
  | "swap_denied"
  | "timeoff_approved"
  | "timeoff_denied"
  | "claim_approved"
  | "claim_denied"
  | "open_shift_posted";

const HREFS: Record<NotificationType, string> = {
  schedule_published: "/shifts",
  shift_reminder: "/shifts",
  swap_approved: "/swaps",
  swap_denied: "/swaps",
  claim_approved: "/swaps",
  claim_denied: "/swaps",
  open_shift_posted: "/swaps",
  timeoff_approved: "/availability",
  timeoff_denied: "/availability",
};

export function notificationHref(type: string): string {
  return HREFS[type as NotificationType] ?? "/shifts";
}
```

Run: `npx vitest run src/lib/notification-links.test.ts` — Expected: PASS.

- [ ] **Step 3: Write the failing integration tests for both endpoints**

```ts
// src/app/api/me/notifications/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function get(qs = "") {
  return GET(new Request(`http://test.local/api/me/notifications${qs}`));
}

describe("GET /api/me/notifications", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    // 25 notifications, oldest first; the 5 newest are unread.
    const base = new Date("2026-07-01T12:00:00.000Z").getTime();
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: emp.userId,
        type: "schedule_published" as const,
        title: `Notification ${i + 1}`,
        body: "Your manager published next week's schedule.",
        createdAt: new Date(base + i * 60000),
        readAt: i < 20 ? new Date(base + i * 60000 + 1000) : null,
      })),
    });
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("pages newest-first with a cursor and reports unreadCount", async () => {
    const res = await get();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.notifications).toHaveLength(20);
    expect(body.data.notifications[0].title).toBe("Notification 25");
    expect(body.data.unreadCount).toBe(5);
    expect(body.data.nextCursor).not.toBeNull();

    const res2 = await get(`?cursor=${body.data.nextCursor}`);
    const body2 = await res2.json();
    expect(body2.data.notifications).toHaveLength(5);
    expect(body2.data.notifications[4].title).toBe("Notification 1");
    expect(body2.data.nextCursor).toBeNull();
  });

  it("caps limit at 50 and rejects garbage", async () => {
    const res = await get("?limit=nope");
    expect(res.status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await get();
    expect(res.status).toBe(401);
  });
});
```

```ts
// src/app/api/me/notifications/read/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { POST } from "./route";

const authMock = auth as unknown as Mock;

function post(body: unknown) {
  return POST(
    new Request("http://test.local/api/me/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/me/notifications/read", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };
  let other: { userId: string; profileId: string };
  let otherNotifId: string;

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    other = await createTestEmployee(t, "Sam Test");
    const mk = (userId: string, title: string) =>
      prisma.notification.create({
        data: {
          userId,
          type: "schedule_published",
          title,
          body: "Your manager published next week's schedule.",
        },
      });
    await mk(emp.userId, "A");
    await mk(emp.userId, "B");
    const theirs = await mk(other.userId, "Not yours");
    otherNotifId = theirs.id;
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("cannot mark another user's notification", async () => {
    const res = await post({ ids: [otherNotifId] });
    const body = await res.json();
    expect(body.data.updated).toBe(0);
    const theirs = await prisma.notification.findUniqueOrThrow({ where: { id: otherNotifId } });
    expect(theirs.readAt).toBeNull();
  });

  it("marks all my unread notifications when ids are omitted", async () => {
    const res = await post({});
    const body = await res.json();
    expect(body.data.updated).toBe(2);
    const unread = await prisma.notification.count({
      where: { userId: emp.userId, readAt: null },
    });
    expect(unread).toBe(0);
    // Idempotent: nothing left to mark.
    const again = await post({});
    expect((await again.json()).data.updated).toBe(0);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await post({});
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `npx vitest run src/app/api/me/notifications/route.test.ts src/app/api/me/notifications/read/route.test.ts`
Expected: FAIL — cannot resolve `./route` in both.

- [ ] **Step 5: Add the query helpers**

Append to `src/lib/queries/employee.ts`:

```ts
// --- append to src/lib/queries/employee.ts ---

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string; // ISO instant
  readAt: string | null;
};

export async function getMyNotifications(
  userId: string,
  opts?: { cursor?: string; limit?: number }
): Promise<{ notifications: NotificationDto[]; nextCursor: string | null; unreadCount: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
  return {
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    })),
    nextCursor,
    unreadCount,
  };
}

/** Marks the given notifications (or all unread when ids omitted) as read. Only touches the caller's rows. */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return res.count;
}
```

- [ ] **Step 6: Implement both route handlers**

```ts
// src/app/api/me/notifications/route.ts
import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getMyNotifications } from "@/lib/queries/employee";

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

  return jsonOk(await getMyNotifications(session.user.id, parsed.data));
}
```

```ts
// src/app/api/me/notifications/read/route.ts
import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { markNotificationsRead } from "@/lib/queries/employee";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {}; // empty body = mark all
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

  const updated = await markNotificationsRead(session.user.id, parsed.data.ids);
  return jsonOk({ updated });
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run src/app/api/me/notifications/route.test.ts src/app/api/me/notifications/read/route.test.ts`
Expected: PASS — both suites green.

- [ ] **Step 8: Build the feed screen**

Behavior called out by the review findings and fixed here: cards are **tappable links** that deep-link by type; opening the feed **auto-marks everything read** (the bell badge is computed server-side from `readAt: null`, so it clears on the next navigation); unread items keep their visual emphasis for the current visit via a captured id set.

```tsx
// src/app/(employee)/notifications/NotificationsList.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/time-format";
import { notificationHref } from "@/lib/notification-links";
import type { NotificationDto } from "@/lib/queries/employee";
import styles from "@/components/employee/employee.module.css";

type Page = { notifications: NotificationDto[]; nextCursor: string | null; unreadCount: number };

export function NotificationsList({ initial }: { initial: Page }) {
  const [items, setItems] = useState(initial.notifications);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Keep this visit's unread emphasis even after we mark everything read.
  const unreadIds = useRef(new Set(initial.notifications.filter((n) => !n.readAt).map((n) => n.id)));
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || initial.unreadCount === 0) return;
    marked.current = true;
    fetch("/api/me/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {
      // Non-fatal: the badge clears the next time this screen loads.
    });
  }, [initial.unreadCount]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/me/notifications?cursor=${encodeURIComponent(nextCursor)}&limit=20`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      setItems((prev) => [...prev, ...body.data.notifications]);
      setNextCursor(body.data.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return <EmptyState title="You're all caught up" description="New notifications will show up here." />;
  }

  return (
    <>
      {items.map((n) => (
        <Link key={n.id} href={notificationHref(n.type)} className={styles.linkReset}>
          <Card hoverable>
            <div className={styles.cardRow}>
              <div>
                <div className={unreadIds.current.has(n.id) ? styles.notifTitleUnread : styles.notifTitle}>
                  {n.title}
                </div>
                <div className={styles.muted}>{n.body}</div>
              </div>
              <div className={styles.notifMeta}>
                {unreadIds.current.has(n.id) && <span className={styles.unreadDot} aria-label="Unread" />}
                <span className={styles.subtle}>{timeAgo(new Date(n.createdAt))}</span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
      {loadError && <div className={styles.muted}>Couldn&apos;t load more notifications. Try again.</div>}
      {nextCursor && (
        <Button variant="secondary" fullWidth onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </>
  );
}
```

```tsx
// src/app/(employee)/notifications/page.tsx  (replaces the Task 1 stub)
import { requireUser } from "@/lib/auth";
import { getMyNotifications } from "@/lib/queries/employee";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { NotificationsList } from "./NotificationsList";
import styles from "@/components/employee/employee.module.css";

export default async function NotificationsPage() {
  const user = await requireUser();
  const first = await getMyNotifications(user.id, { limit: 20 });

  return (
    <div className={styles.screen}>
      <PageTopBar title="Notifications" backHref="/shifts" showBell={false} />
      <NotificationsList initial={first} />
    </div>
  );
}
```

```tsx
// src/app/(employee)/notifications/loading.tsx
import styles from "@/components/employee/employee.module.css";

export default function NotificationsLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading notifications">
      <div className={styles.skeleton} style={{ height: 34, width: 180, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 72 }} />
      <div className={styles.skeleton} style={{ height: 72 }} />
      <div className={styles.skeleton} style={{ height: 72 }} />
    </div>
  );
}
```

- [ ] **Step 9: Verify build + manual check**

Run: `npm run build` — compiles clean.

Run: `npm run dev`:
1. As Jamie, publish a draft week from `/manager/schedule` (Phase 3 flow) so Maria gets a `schedule_published` notification.
2. As Maria, the bell on the home screen (`/shifts`) shows an unread count badge.
3. Tap the bell → feed lists notifications newest first with "2h ago"-style stamps; unread ones show a dot and bold title.
4. Tap the "Schedule published" card → lands on the home screen (`/shifts`).
5. Return to `/notifications` — the badge is gone (marked read), the dot no longer shows on a fresh visit.
6. With no notifications (fresh test account), the empty state reads "You're all caught up".

- [ ] **Step 10: Commit**

```bash
git add src/lib/notification-links.ts src/lib/notification-links.test.ts src/lib/queries/employee.ts src/app/api/me/notifications "src/app/(employee)/notifications"
git commit -m "feat(employee): notifications feed with unread badge, auto-mark-read, and typed deep links"
```

### Task 8: Profile — identity card, notification channel switches, log out

**Files:**

- Create: `src/app/api/me/notification-preferences/route.ts`
- Create: `src/app/api/me/notification-preferences/route.test.ts`
- Create: `src/app/(employee)/profile/NotificationPrefs.tsx`
- Create: `src/app/(employee)/profile/actions.ts`
- Replace (overwrite the Task 1 stub): `src/app/(employee)/profile/page.tsx`
- Create: `src/app/(employee)/profile/loading.tsx`

**Interfaces:**

- Consumes: `prisma`, `auth`, `signOut` from `@/lib/auth` (Auth.js v5 — `signOut({ redirectTo })` works in server actions), `jsonOk`/`jsonErr`, `getEmployeeContext` (Task 2), factories (Task 2); `PageTopBar` (Task 1); `Card`, `Switch`, `Avatar`, `Button`, `useToast` primitives.
- Produces: Endpoint `PATCH /api/me/notification-preferences` body `{ notifyPush?: boolean; notifySms?: boolean; notifyEmail?: boolean }` (at least one key) → `{ notifyPush, notifySms, notifyEmail }` (the saved values). Phase 5's Notifier reads these same `EmployeeProfile` columns to pick channels.

- [ ] **Step 1: Write the failing integration test for the PATCH**

```ts
// src/app/api/me/notification-preferences/route.test.ts
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { PATCH } from "./route";

const authMock = auth as unknown as Mock;

function patch(body: unknown) {
  return PATCH(
    new Request("http://test.local/api/me/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("PATCH /api/me/notification-preferences", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("updates only the provided channel and returns all three", async () => {
    // Factory defaults: push true, sms true, email false.
    const res = await patch({ notifySms: false });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ notifyPush: true, notifySms: false, notifyEmail: false });
    const profile = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.profileId } });
    expect(profile.notifySms).toBe(false);
    expect(profile.notifyPush).toBe(true);
  });

  it("rejects an empty body", async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Provide at least one preference to update.");
  });

  it("rejects non-boolean values", async () => {
    const res = await patch({ notifyPush: "yes" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await patch({ notifyPush: false });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/app/api/me/notification-preferences/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Implement the route handler**

```ts
// src/app/api/me/notification-preferences/route.ts
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { getEmployeeContext } from "@/lib/queries/employee";

const bodySchema = z
  .object({
    notifyPush: z.boolean().optional(),
    notifySms: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "Provide at least one preference to update.",
  });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonErr("invalid_request", "Send a JSON body.", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  const updated = await prisma.employeeProfile.update({
    where: { id: ctx.profileId },
    data: parsed.data,
    select: { notifyPush: true, notifySms: true, notifyEmail: true },
  });
  return jsonOk(updated);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/app/api/me/notification-preferences/route.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Build the profile screen**

```ts
// src/app/(employee)/profile/actions.ts
"use server";

import { signOut } from "@/lib/auth";

export async function logOut(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
```

```tsx
// src/app/(employee)/profile/NotificationPrefs.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toaster";
import styles from "@/components/employee/employee.module.css";

type Prefs = { notifyPush: boolean; notifySms: boolean; notifyEmail: boolean };

const LABELS: Record<keyof Prefs, string> = {
  notifyPush: "Push notifications",
  notifySms: "Text messages (SMS)",
  notifyEmail: "Email",
};

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const { toast } = useToast();

  async function setPref(key: keyof Prefs, value: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value }); // optimistic
    try {
      const res = await fetch("/api/me/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
    } catch {
      setPrefs(previous); // revert on error
      toast({
        tone: "danger",
        title: "Couldn't save your notification preferences",
        description: "Check your connection and try again.",
      });
    }
  }

  return (
    <Card>
      <div className={styles.cardStack}>
        {(Object.keys(LABELS) as (keyof Prefs)[]).map((key) => (
          <Switch
            key={key}
            label={LABELS[key]}
            checked={prefs[key]}
            onChange={(v) => setPref(key, v)}
          />
        ))}
      </div>
    </Card>
  );
}
```

```tsx
// src/app/(employee)/profile/page.tsx  (replaces the Task 1 stub)
import { requireUser } from "@/lib/auth";
import { getEmployeeContext } from "@/lib/queries/employee";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NotificationPrefs } from "./NotificationPrefs";
import { logOut } from "./actions";
import styles from "@/components/employee/employee.module.css";

export default async function ProfilePage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");

  return (
    <div className={styles.screen}>
      <PageTopBar title="Profile" />

      <Card>
        <div className={styles.profileRow}>
          <Avatar name={ctx.name} size={52} />
          <div>
            <div className={styles.shiftTitle}>{ctx.name}</div>
            <div className={styles.muted}>
              {[ctx.primaryPositionName, ctx.locationName].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </Card>

      <h2 className={styles.sectionTitle}>Notification preferences</h2>
      <NotificationPrefs
        initial={{
          notifyPush: ctx.notifyPush,
          notifySms: ctx.notifySms,
          notifyEmail: ctx.notifyEmail,
        }}
      />

      <form action={logOut}>
        <Button variant="ghost" fullWidth type="submit">
          Log out
        </Button>
      </form>
    </div>
  );
}
```

```tsx
// src/app/(employee)/profile/loading.tsx
import styles from "@/components/employee/employee.module.css";

export default function ProfileLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading profile">
      <div className={styles.skeleton} style={{ height: 34, width: 120, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
      <div className={styles.skeleton} style={{ height: 20, width: 200, marginTop: 6 }} />
      <div className={styles.skeleton} style={{ height: 150 }} />
    </div>
  );
}
```

- [ ] **Step 6: Verify build + manual check**

Run: `npm run build` — compiles clean.

Run: `npm run dev`, as Maria on `/profile`:
1. Card shows her initials avatar, "Maria Garcia", and "Line cook · Downtown" (primary position · location).
2. Toggle "Text messages (SMS)" off → flips instantly; reload → still off (persisted).
3. Stop the dev server's DB (`docker compose stop`), toggle a switch → it flips, then reverts, and a toast reads "Couldn't save your notification preferences". Restart the DB (`docker compose start`) afterwards.
4. "Log out" → back at `/login`; visiting `/shifts` redirects to `/login`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(employee)/profile" src/app/api/me/notification-preferences
git commit -m "feat(employee): profile with optimistic notification preferences and log out"
```

---

### Task 9: End-of-phase verification gate

**Files:** none created — this is the phase's QA pass.

**Interfaces:**

- Consumes: everything above; the Phase 2 seed (`npx prisma db seed`); the Phase 3 manager schedule + publish flow at `/manager/schedule`.
- Produces: a verified Phase 4. Phase 5 may assume: employee shell + all five tabs live; `/swaps` and `/clock` are placeholder pages to replace; `SWAPS_ENABLED`/`TIME_OFF_ENABLED` flags to flip in `src/lib/flags.ts`; the notifications feed renders whatever `notifyUsers` writes.

- [ ] **Step 1: Fresh data + full automated suite**

```bash
docker compose up -d
npx prisma db seed
npm run build
npx vitest run
```

Expected: seed completes; build clean; **every** vitest suite green (Phases 1–4). If a Phase 1–3 test broke, you regressed something — fix before proceeding.

- [ ] **Step 2: Manual QA loop (use the `/qa` skill against `npm run dev` if available)**

1. Log in as `maria@harborvine.test` / `rosterhouse1` → lands on the employee home (`/shifts`).
2. Home shows the current week's **published** shifts with 12-hour times ("7:00 AM – 3:00 PM") and a summary like "3 shifts · 24 hrs total". No draft shifts appear.
3. Open a shift → detail shows time range + duration, Confirmed badge, location, overlapping coworkers with avatars, and the manager note when present. "Request swap" is disabled with a "Coming soon" tooltip.
4. `/availability`: set Tuesday to 10:00 AM – 4:00 PM in Advanced, save → "Availability saved" toast. Make another change and tap the Shifts tab → discard sheet appears; keep editing; save again.
5. Log in as `jamie@harborvine.test` / `rosterhouse1` → `/manager/availability` shows **all 10** employees; Maria's Tuesday cell reads "10:00 AM – 4:00 PM"; approved time off shows amber "Time off" cells; the week pager works.
6. As Jamie, publish next week from `/manager/schedule` (Phase 3 flow).
7. Back as Maria: the bell badge on the home screen (`/shifts`) shows an unread count; the feed lists "Schedule published" newest-first with a relative timestamp; tapping it deep-links to `/shifts`; returning to the feed shows the badge cleared.
8. `/profile`: toggle a notification channel, reload, confirm it stuck; log out returns to `/login`.
9. Keyboard pass: Tab through home and availability — every control (tabs, switches, time fields, save, tab bar, bell) is reachable with a visible focus ring; no dead onClick divs anywhere.

- [ ] **Step 3: Confirm clean history and tree**

```bash
git status --short
git log --oneline -10
```

Expected: empty status (working tree clean); one commit per task above.

- [ ] **Step 4: Railway deploy check (per roadmap verification gates)**

If a Railway environment is configured (`railway.json` exists with preDeploy `prisma migrate deploy` and healthcheck `/api/health`), deploy and smoke-test login → home → availability on the deployed URL. If deploy credentials are unavailable in this session, note it in the handoff instead of skipping silently.

---

## Self-review notes (already applied)

- **Spec coverage:** All nine scoped items from the roadmap's Phase 4 row are covered: route-group shell (Task 1), `/api/me` + `/api/me/shifts` (Task 2), home (Task 3), shift detail + gated swap entry (Task 4), availability editor with the save affordance the design lacks (Task 5), fixed manager overview — hour windows, all employees, time-off overlay (Task 6), notifications + bell (Task 7), profile (Task 8), QA gate (Task 9). Review-findings defects fixed rather than reproduced: real links/buttons everywhere, loading/empty/error states on every screen, branded root-level 404/500 pages (Task 1) so unknown URLs and root render failures never fall back to Next.js defaults, validated `TimeField` instead of free-text, tappable notification cards with unread badge wiring, non-lossy availability overview.
- **Type consistency:** `AvailabilityRuleDto` is defined once in `@/lib/queries/employee` (Task 5) and imported by the reducer, editor, and API; `EmployeeShiftDto`/`ShiftDetailDto`/`NotificationDto`/`MePayload` live there too. `TestOrg` factories are Task 2 and consumed by every integration test with the same signatures. Flags module names (`SWAPS_ENABLED`, `TIME_OFF_ENABLED`) match between Tasks 4 and 5.
- **Placeholder scan:** every code step contains complete file contents (or an explicit "append these exact lines" block); no TBDs, no "similar to Task N".





