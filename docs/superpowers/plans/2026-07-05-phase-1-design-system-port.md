# Phase 1 — Design-System Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the 16 design-export primitives plus 9 net-new primitives to typed, accessible `.tsx` components under `src/components/`, with a vitest harness, nav chrome, a `/design-system` gallery route, and lint guardrails.

**Architecture:** Every primitive lives in `src/components/ui/<Name>.tsx` with a co-located CSS Module (`<Name>.module.css`) that replaces the export's JS hover/press state with `:hover`/`:active`/`:focus-visible` rules built on the already-ported design tokens. App chrome (sidebar, tab bar, top bar, date pager) lives in `src/components/chrome/`. No database work and no routes in this phase except `/design-system`, which renders every primitive in every state as the manual QA surface.

**Tech Stack:** Next.js 16.2 / React 19 / TypeScript · `lucide-react` (installed, pinned) · vitest + @testing-library/react + jsdom (installed by Task 1) · CSS Modules on design-token custom properties (no Tailwind).

**Design source of truth (read-only reference, never imported):** `"/Users/gary/dev/RosterHouse/RosterHouse Design System"` — note the path contains spaces; always quote it. Component APIs come from `components/{forms,feedback,containers,scheduling}/*.d.ts` in that folder.

## Global Constraints

(Verbatim from the roadmap `docs/superpowers/plans/2026-07-05-rosterhouse-wiring-roadmap.md`; every task below implicitly includes these.)

- Copy rules: sentence case everywhere; 12-hour times ("7:00 AM – 3:00 PM", en dash, never military); durations as "8 hrs"; no emoji in UI chrome; calm confirmations (no exclamation points); errors specific and actionable ("This shift overlaps with Maria's 2:00 PM – 6:00 PM shift"), never blaming.
- Styling: design tokens only — no raw hex colors, no font-family other than Figtree (`var(--font-sans)`). Hover/press via CSS `:hover` / `:active` classes (CSS Modules), not JS state. Focus states use `--shadow-focus` + brand ring.
- All interactive elements are real `<button>`/`<a>`/`<input>` elements with keyboard focus — never onClick divs (the export's dominant defect).
- Every screen ships loading, empty, and error states (this phase ships the building blocks: `Spinner`, `EmptyState`, error-state `Input`/`TimeField`).
- Test-first (vitest); commit at the end of every task.
- Ported primitives keep their `.d.ts` prop names, and additionally accept `className?: string`, spread rest props onto the root element, and forward refs. React 19 note: `ref` is a normal prop now — extending `React.ComponentPropsWithRef<"button">` and spreading `...rest` forwards the ref with **no** `forwardRef` wrapper. Do not use `forwardRef`.
- `'use client'` only where genuinely needed (hooks/effects/portals/internal handlers). CSS handles hover/press, so most primitives stay server-safe. This plan marks each component explicitly.

## File structure (whole phase)

```
vitest.config.ts                          Task 1
vitest.setup.ts                           Task 1
src/components/harness.test.tsx           Task 1
src/components/ui/
  Icon.tsx (+ Icon.test.tsx)              Task 2
  cx.ts (+ cx.test.ts)                    Task 3
  Button.tsx/.module.css (+ test)         Task 3
  Card.tsx/.module.css                    Task 3
  Input.tsx/.module.css                   Task 4
  Checkbox.tsx/.module.css                Task 4
  Switch.tsx/.module.css (+ forms test)   Task 4
  Select.tsx/.module.css                  Task 5
  Tabs.tsx/.module.css (+ test)           Task 5
  Badge.tsx/.module.css                   Task 6
  Tag.tsx/.module.css                     Task 6
  Tooltip.tsx/.module.css (+ test)        Task 6
  Toast.tsx/.module.css                   Task 7
  use-modal-behavior.ts                   Task 7
  Dialog.tsx/.module.css (+ test)         Task 7
  initials.ts                             Task 8
  ShiftBlock.tsx/.module.css              Task 8
  WeekGridCell.tsx/.module.css            Task 8
  AvatarStatus.tsx/.module.css            Task 8
  ConflictChip.tsx/.module.css (+ test)   Task 8
  time-field-parse.ts (+ test)            Task 9
  TimeField.tsx (+ test)                  Task 9
  Textarea.tsx/.module.css                Task 10
  Avatar.tsx/.module.css                  Task 10
  StatCard.tsx/.module.css                Task 10
  EmptyState.tsx/.module.css              Task 10
  Spinner.tsx/.module.css (+ test)        Task 10
  Toaster.tsx/.module.css (+ test)        Task 11
  Sheet.tsx/.module.css (+ test)          Task 12
src/components/chrome/
  ManagerSidebar.tsx/.module.css          Task 13
  EmployeeTabBar.tsx/.module.css          Task 13
  EmployeeTopBar.tsx/.module.css          Task 13
  DatePager.tsx/.module.css (+ test)      Task 13
src/app/design-system/page.tsx            Task 14
src/styles/design-guardrails.test.ts      Task 15
eslint.config.mjs (modified)              Task 15
src/app/globals.css (modified: .sr-only)  Task 8
```

---

### Task 1: Vitest + Testing Library harness

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/components/harness.test.tsx`
- Modify: `package.json` (scripts only, via `npm pkg set`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npx vitest run <file>` command every later task depends on; the `@` → `src/` alias inside tests; jsdom + jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …) available in every `src/**/*.test.{ts,tsx}` file; CSS Modules resolve to their source class names in tests (`classNameStrategy: "non-scoped"`), so `element.className` contains readable names like `button`; `.env` loaded into `process.env` via `import "dotenv/config"` in `vitest.setup.ts` (Vitest only exposes `VITE_`-prefixed vars by itself), so later phases' DB-backed integration tests get `DATABASE_URL` without per-file dotenv imports.

- [ ] **Step 1: Install dev dependencies**

```bash
cd /Users/gary/dev/RosterHouse
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: npm exits 0; `package.json` devDependencies gains all six packages.

- [ ] **Step 2: Create the vitest config and setup file**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: {
      modules: { classNameStrategy: "non-scoped" },
    },
  },
});
```

Create `vitest.setup.ts`:

```ts
import "dotenv/config";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

The `import "dotenv/config";` line MUST stay first: Vitest does not load `.env` on its own (it only exposes `VITE_`-prefixed vars), so the setup file loads `.env` into `process.env` before any test module runs. Phase 1's tests don't need it, but later phases' DB-backed integration tests rely on this to construct a Prisma client from `DATABASE_URL` without per-file imports. `dotenv` is already a dependency in `package.json`, so Step 1's install list does not change. This import is side-effect only — Task 1's harness test passes identically with it in place.

- [ ] **Step 3: Add test scripts**

```bash
cd /Users/gary/dev/RosterHouse
npm pkg set scripts.test="vitest run" scripts."test:watch"="vitest"
```

Expected: `package.json` scripts now include `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Write the harness-proving test**

Create `src/components/harness.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <p>RosterHouse test harness works</p>;
}

describe("test harness", () => {
  it("renders a React component into jsdom with jest-dom matchers", () => {
    render(<Hello />);
    expect(
      screen.getByText("RosterHouse test harness works")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the test to verify the harness**

Run: `npx vitest run src/components/harness.test.tsx`
Expected: `Test Files  1 passed (1)` / `Tests  1 passed (1)`.

- [ ] **Step 6: Verify the production build still passes**

Run: `npm run build`
Expected: exits 0 (the test files type-check under the existing tsconfig; nothing app-facing changed).

- [ ] **Step 7: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add vitest.config.ts vitest.setup.ts src/components/harness.test.tsx package.json package-lock.json
git commit -m "test: add vitest + testing-library harness"
```

---

### Task 2: Icon primitive (pinned lucide-react set)

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Test: `src/components/ui/Icon.test.tsx`

**Interfaces:**
- Consumes: `lucide-react` 1.23.0 (already installed).
- Produces: `Icon` and `IconName` from `@/components/ui/Icon`:
  - `type IconName` = the 24-name union below. This is the full set used by the design export's `data-lucide` usages (static and dynamic — verified by grep: the kits use `layout-dashboard`, `calendar`, `users`, `calendar-check`, `clock`, `repeat`, `timer`, `user`, `chevron-left`, `chevron-right`, `bell`, `map-pin`, and the time-clock toggle uses `play`/`square`) plus the roadmap's pinned extras (`calendar-days`, `chevron-down`, `arrow-left`, `sun`, `log-out`, `plus`, `x`, `check`, `alert-triangle`, `inbox`).
  - `function Icon(props: IconProps): JSX element` where `IconProps = { name: IconName; size?: number } & Omit<LucideProps, "size" | "ref">` — `size` defaults to `18`, `strokeWidth` defaults to `1.75`, `aria-hidden="true"` by default (override by passing `aria-hidden={undefined}` + `aria-label`). Server-safe (no `'use client'`).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Icon.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "@/components/ui/Icon";

describe("Icon", () => {
  it("renders the named lucide icon as an svg", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("defaults to size 18 and stroke width 1.75", () => {
    const { container } = render(<Icon name="alert-triangle" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
  });

  it("accepts size and strokeWidth overrides and is decorative by default", () => {
    const { container } = render(
      <Icon name="check" size={12} strokeWidth={3} />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "12");
    expect(svg).toHaveAttribute("stroke-width", "3");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Icon.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Icon"`.

- [ ] **Step 3: Implement Icon**

Create `src/components/ui/Icon.tsx`:

```tsx
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Play,
  Plus,
  Repeat,
  Square,
  Sun,
  Timer,
  User,
  Users,
  X,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

/**
 * Pinned icon set. The export loaded lucide from an unpinned CDN and called
 * createIcons() on <i data-lucide="..."> tags; this replaces that pattern
 * with tree-shakeable, versioned imports. Add names here only when a screen
 * actually uses them.
 */
const ICONS = {
  "alert-triangle": AlertTriangle,
  "arrow-left": ArrowLeft,
  bell: Bell,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  clock: Clock,
  inbox: Inbox,
  "layout-dashboard": LayoutDashboard,
  "log-out": LogOut,
  "map-pin": MapPin,
  play: Play,
  plus: Plus,
  repeat: Repeat,
  square: Square,
  sun: Sun,
  timer: Timer,
  user: User,
  users: Users,
  x: X,
} as const;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
} & Omit<LucideProps, "size" | "ref">;

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  ...rest
}: IconProps) {
  const LucideIcon = ICONS[name];
  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Icon.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Icon.tsx src/components/ui/Icon.test.tsx
git commit -m "feat: add Icon primitive with pinned lucide-react set"
```

---

### Task 3: `cx` helper, Button, Card

**Files:**
- Create: `src/components/ui/cx.ts`
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Button.module.css`
- Create: `src/components/ui/Card.tsx`, `src/components/ui/Card.module.css`
- Test: `src/components/ui/cx.test.ts`, `src/components/ui/Button.test.tsx`

Export reference (read for fidelity, do not copy the JS-state pattern): `"/Users/gary/dev/RosterHouse/RosterHouse Design System/components/forms/Button.jsx"`, `".../containers/Card.jsx"`.

**Interfaces:**
- Consumes: design tokens from `src/styles/tokens/*` (`--accent-primary/hover/active`, `--accent-contrast`, `--accent-secondary(-hover/-active)`, `--surface-card`, `--surface-brand-soft`, `--green-100`, `--green-900`, `--text-brand`, `--border-strong`, `--border-brand`, `--status-danger`, `--red-700`, `--neutral-0`, `--radius-sm/md/lg`, `--shadow-sm/md/focus`, `--duration-fast/base`, `--ease-out/standard`, `--space-6`, `--font-sans`).
- Produces:
  - `cx(...parts: Array<string | false | null | undefined>): string` from `@/components/ui/cx` — every later component uses this to merge classes.
  - `Button` from `@/components/ui/Button`: `type ButtonProps = { variant?: "primary" | "secondary" | "ghost" | "accent" | "danger"; size?: "sm" | "md" | "lg"; icon?: React.ReactNode; fullWidth?: boolean } & React.ComponentPropsWithRef<"button">`. Defaults: `variant="primary"`, `size="md"`, `type="button"`. Renders a real `<button>` with `data-variant`/`data-size` attributes. Merges caller `className` AND `style` (the export dropped both — review finding). Server-safe.
  - `Card` from `@/components/ui/Card`: `type CardProps = { padding?: string; hoverable?: boolean } & React.ComponentPropsWithRef<"div">`. Default `padding="var(--space-6)"`. Hover elevation via CSS `:hover`, not JS. Server-safe.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/cx.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cx } from "@/components/ui/cx";

describe("cx", () => {
  it("joins truthy class parts with spaces", () => {
    expect(cx("a", "b")).toBe("a b");
  });

  it("drops false, null, and undefined parts", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns an empty string for no parts", () => {
    expect(cx()).toBe("");
  });
});
```

Create `src/components/ui/Button.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders a real button element with variant and size data attributes", () => {
    render(
      <Button variant="danger" size="lg">
        Delete shift
      </Button>
    );
    const button = screen.getByRole("button", { name: "Delete shift" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("data-variant", "danger");
    expect(button).toHaveAttribute("data-size", "lg");
    expect(button).toHaveAttribute("type", "button");
  });

  it("defaults to primary / md", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("merges caller className and style instead of dropping them", () => {
    render(
      <Button className="my-extra" style={{ marginTop: 8 }}>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("my-extra");
    expect(button.className).toContain("button"); // module class kept too
    expect(button).toHaveStyle({ marginTop: "8px" });
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publish schedule</Button>);
    await userEvent.click(
      screen.getByRole("button", { name: "Publish schedule" })
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Publish schedule
      </Button>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Publish schedule" })
    );
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards refs to the underlying button (React 19 ref prop)", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("renders a leading icon before the label", () => {
    render(<Button icon={<svg data-testid="lead-icon" />}>Add shift</Button>);
    const button = screen.getByRole("button", { name: "Add shift" });
    expect(button.firstChild).toBe(screen.getByTestId("lead-icon"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/cx.test.ts src/components/ui/Button.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/cx"` and `"@/components/ui/Button"`.

- [ ] **Step 3: Implement cx, Button, Card**

Create `src/components/ui/cx.ts`:

```ts
/** Merge class names, skipping falsy parts. */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
```

Create `src/components/ui/Button.module.css`:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-weight: 600;
  line-height: 1;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition:
    background var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-standard);
}

.button:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.button:not(:disabled):active {
  transform: translateY(1px);
}

.button[data-size="sm"] {
  padding: 6px 12px;
  font-size: 13px;
  gap: 6px;
  border-radius: var(--radius-sm);
}

.button[data-size="md"] {
  padding: 10px 18px;
  font-size: 14px;
  gap: 8px;
  border-radius: var(--radius-md);
}

.button[data-size="lg"] {
  padding: 13px 22px;
  font-size: 16px;
  gap: 8px;
  border-radius: var(--radius-md);
}

.button[data-variant="primary"] {
  background: var(--accent-primary);
  color: var(--accent-contrast);
}
.button[data-variant="primary"]:not(:disabled):hover {
  background: var(--accent-hover);
}
.button[data-variant="primary"]:not(:disabled):active {
  background: var(--accent-active);
}

.button[data-variant="secondary"] {
  background: var(--surface-card);
  color: var(--text-brand);
  border-color: var(--border-strong);
}
.button[data-variant="secondary"]:not(:disabled):hover {
  background: var(--surface-brand-soft);
  border-color: var(--border-brand);
}
.button[data-variant="secondary"]:not(:disabled):active {
  background: var(--green-100);
  border-color: var(--border-brand);
}

.button[data-variant="ghost"] {
  background: transparent;
  color: var(--text-brand);
}
.button[data-variant="ghost"]:not(:disabled):hover {
  background: var(--surface-brand-soft);
}
.button[data-variant="ghost"]:not(:disabled):active {
  background: var(--green-100);
}

.button[data-variant="accent"] {
  background: var(--accent-secondary);
  color: var(--green-900);
}
.button[data-variant="accent"]:not(:disabled):hover {
  background: var(--accent-secondary-hover);
}
.button[data-variant="accent"]:not(:disabled):active {
  background: var(--accent-secondary-active);
}

.button[data-variant="danger"] {
  background: var(--status-danger);
  /* export used #fff — raw hex is banned; the token is identical */
  color: var(--neutral-0);
}
.button[data-variant="danger"]:not(:disabled):hover {
  background: var(--red-700);
}
.button[data-variant="danger"]:not(:disabled):active {
  background: var(--red-700);
}

.fullWidth {
  width: 100%;
}
```

Create `src/components/ui/Button.tsx`:

```tsx
import { cx } from "./cx";
import styles from "./Button.module.css";

export type ButtonProps = {
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  /** Size. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Optional leading icon element (e.g. <Icon name="plus" size={16} />). */
  icon?: React.ReactNode;
  fullWidth?: boolean;
} & React.ComponentPropsWithRef<"button">;

export function Button({
  variant = "primary",
  size = "md",
  icon = null,
  fullWidth = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      className={cx(styles.button, fullWidth && styles.fullWidth, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
```

Create `src/components/ui/Card.module.css`:

```css
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
  transition: box-shadow var(--duration-base) var(--ease-out);
}

.hoverable:hover {
  box-shadow: var(--shadow-md);
}
```

Create `src/components/ui/Card.tsx`:

```tsx
import { cx } from "./cx";
import styles from "./Card.module.css";

export type CardProps = {
  /** CSS padding value. @default "var(--space-6)" */
  padding?: string;
  /** Elevate on hover (CSS :hover, not JS). @default false */
  hoverable?: boolean;
} & React.ComponentPropsWithRef<"div">;

export function Card({
  padding = "var(--space-6)",
  hoverable = false,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(styles.card, hoverable && styles.hoverable, className)}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/cx.test.ts src/components/ui/Button.test.tsx`
Expected: PASS — 10 tests total.

- [ ] **Step 5: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/cx.ts src/components/ui/cx.test.ts src/components/ui/Button.tsx src/components/ui/Button.module.css src/components/ui/Button.test.tsx src/components/ui/Card.tsx src/components/ui/Card.module.css
git commit -m "feat: port Button and Card primitives with cx helper"
```

---

### Task 4: Input, Checkbox, Switch

**Files:**
- Create: `src/components/ui/Input.tsx`, `src/components/ui/Input.module.css`
- Create: `src/components/ui/Checkbox.tsx`, `src/components/ui/Checkbox.module.css`
- Create: `src/components/ui/Switch.tsx`, `src/components/ui/Switch.module.css`
- Test: `src/components/ui/forms.test.tsx`

Export reference: `"/Users/gary/dev/RosterHouse/RosterHouse Design System/components/forms/Input.jsx"`, `".../forms/Checkbox.jsx"`, `".../forms/Switch.jsx"`. The export's Checkbox/Switch are onClick `<span>`s with no real input — this port fixes that (real `<input type="checkbox">`, keyboard operable, focus ring).

**Interfaces:**
- Consumes: `cx` (Task 3), `Icon` (Task 2), tokens.
- Produces:
  - `Input` from `@/components/ui/Input`: `type InputProps = { label?: string; error?: string; icon?: React.ReactNode } & Omit<React.ComponentPropsWithRef<"input">, "size">`. Renders label + wrapper + `<input>` + error line. `className` goes on the **root wrapper div**; all rest props (`value`, `onChange`, `placeholder`, `type`, `disabled`, `onBlur`, …) and the ref go to the **inner `<input>`** — the only ported primitive where root and rest targets differ (it is a composite field; later phases rely on this exact split). Label is associated via `htmlFor`/`useId`; error sets `aria-invalid="true"` and `aria-describedby`. Server-safe (`useId` works in server components).
  - `Checkbox` (`'use client'`): `type CheckboxProps = { label?: string; checked?: boolean; onChange?: (checked: boolean) => void } & Omit<React.ComponentPropsWithRef<"input">, "onChange" | "checked" | "type">` — keeps the `.d.ts` boolean `onChange` by adapting the native event internally.
  - `Switch` (`'use client'`): same props as Checkbox; renders `role="switch"`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/forms.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";

describe("Input", () => {
  it("associates the label with the input", () => {
    render(<Input label="Phone or email" placeholder="maria@example.com" />);
    const input = screen.getByLabelText("Phone or email");
    expect(input).toHaveAttribute("placeholder", "maria@example.com");
  });

  it("shows an error line wired up with aria attributes", () => {
    render(<Input label="Password" error="Enter at least 8 characters" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter at least 8 characters")).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription("Enter at least 8 characters");
  });

  it("passes value and onChange through to the native input", async () => {
    const onChange = vi.fn();
    render(<Input label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "M");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Checkbox", () => {
  it("is a real checkbox toggled by click, reporting a boolean", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Line cook" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Line cook" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("is keyboard operable with space", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Server" checked={true} onChange={onChange} />);
    screen.getByRole("checkbox", { name: "Server" }).focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not fire when disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Host" disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Host" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Switch", () => {
  it("exposes role switch and toggles with a boolean", async () => {
    const onChange = vi.fn();
    render(
      <Switch label="Text message alerts" checked={false} onChange={onChange} />
    );
    const control = screen.getByRole("switch", { name: "Text message alerts" });
    expect(control).not.toBeChecked();
    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/forms.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Input"`.

- [ ] **Step 3: Implement Input**

Create `src/components/ui/Input.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font-sans);
  min-width: 0;
}

.label {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  color: var(--text-primary);
}

.control {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 44px;
  width: 100%;
  background: var(--surface-card);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  transition:
    box-shadow var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.control:focus-within {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}

.hasError {
  border-color: var(--status-danger);
}

.isDisabled {
  background: var(--surface-sunken);
}

.input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--text-body-size);
  color: var(--text-primary);
}

.input::placeholder {
  color: var(--text-tertiary);
}

.error {
  font-size: var(--text-body-sm-size);
  color: var(--status-danger);
}
```

Create `src/components/ui/Input.tsx`:

```tsx
import { useId } from "react";
import { cx } from "./cx";
import styles from "./Input.module.css";

export type InputProps = {
  label?: string;
  error?: string;
  /** Optional leading icon element (e.g. <Icon name="clock" size={16} />). */
  icon?: React.ReactNode;
} & Omit<React.ComponentPropsWithRef<"input">, "size">;

/**
 * className lands on the root wrapper; all other rest props and the ref go
 * to the inner <input>. Composite-field exception to the "rest on root" rule.
 */
export function Input({
  label,
  error,
  icon = null,
  className,
  id,
  disabled,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div
        className={cx(
          styles.control,
          error && styles.hasError,
          disabled && styles.isDisabled
        )}
      >
        {icon}
        <input
          id={inputId}
          className={styles.input}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
      </div>
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement Checkbox**

Create `src/components/ui/Checkbox.module.css`:

```css
.root {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: var(--text-body-size);
  color: var(--text-primary);
  cursor: pointer;
  position: relative;
}

.isDisabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

/* Real input, visually hidden but still focusable/clickable */
.input {
  position: absolute;
  width: 20px;
  height: 20px;
  opacity: 0;
  margin: 0;
  cursor: inherit;
}

.box {
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-strong);
  background: var(--surface-card);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-contrast);
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.mark {
  visibility: hidden;
}

.input:checked + .box {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.input:checked + .box .mark {
  visibility: visible;
}

.input:focus-visible + .box {
  box-shadow: var(--shadow-focus);
}

.input:disabled + .box {
  opacity: 0.5;
}
```

Create `src/components/ui/Checkbox.tsx`:

```tsx
"use client";

import { useId } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./Checkbox.module.css";

export type CheckboxProps = {
  label?: string;
  checked?: boolean;
  /** Reports the next boolean state (export .d.ts API, kept). */
  onChange?: (checked: boolean) => void;
} & Omit<React.ComponentPropsWithRef<"input">, "onChange" | "checked" | "type">;

export function Checkbox({
  label,
  checked = false,
  onChange,
  disabled,
  className,
  id,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      className={cx(styles.root, disabled && styles.isDisabled, className)}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={12} strokeWidth={3} className={styles.mark} />
      </span>
      {label}
    </label>
  );
}
```

- [ ] **Step 5: Implement Switch**

Create `src/components/ui/Switch.module.css`:

```css
.root {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--font-sans);
  font-size: var(--text-body-size);
  color: var(--text-primary);
  cursor: pointer;
  position: relative;
}

.isDisabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input {
  position: absolute;
  width: 40px;
  height: 24px;
  right: 0;
  opacity: 0;
  margin: 0;
  cursor: inherit;
}

.track {
  width: 40px;
  height: 24px;
  flex: none;
  border-radius: var(--radius-pill);
  background: var(--neutral-300);
  position: relative;
  transition: background var(--duration-base) var(--ease-out);
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--neutral-0);
  box-shadow: var(--shadow-sm);
  transition: left var(--duration-base) var(--ease-out);
}

.input:checked ~ .track {
  background: var(--accent-primary);
}

.input:checked ~ .track .thumb {
  left: 19px;
}

.input:focus-visible ~ .track {
  box-shadow: var(--shadow-focus);
}
```

Create `src/components/ui/Switch.tsx`:

```tsx
"use client";

import { useId } from "react";
import { cx } from "./cx";
import styles from "./Switch.module.css";

export type SwitchProps = {
  label?: string;
  checked?: boolean;
  /** Reports the next boolean state (export .d.ts API, kept). */
  onChange?: (checked: boolean) => void;
} & Omit<React.ComponentPropsWithRef<"input">, "onChange" | "checked" | "type">;

export function Switch({
  label,
  checked = false,
  onChange,
  disabled,
  className,
  id,
  ...rest
}: SwitchProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      className={cx(styles.root, disabled && styles.isDisabled, className)}
      htmlFor={inputId}
    >
      {label && <span>{label}</span>}
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        {...rest}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/forms.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Input.tsx src/components/ui/Input.module.css src/components/ui/Checkbox.tsx src/components/ui/Checkbox.module.css src/components/ui/Switch.tsx src/components/ui/Switch.module.css src/components/ui/forms.test.tsx
git commit -m "feat: port Input, Checkbox, Switch with real form semantics"
```

---

### Task 5: Select (native), Tabs

**Files:**
- Create: `src/components/ui/Select.tsx`, `src/components/ui/Select.module.css`
- Create: `src/components/ui/Tabs.tsx`, `src/components/ui/Tabs.module.css`
- Test: `src/components/ui/select-tabs.test.tsx`

Export reference: `"/Users/gary/dev/RosterHouse/RosterHouse Design System/components/forms/Select.jsx"` (a div-popup listbox with zero keyboard support — review finding), `".../containers/Tabs.jsx"` (onClick divs). Decision from the findings doc: v1 uses a **native `<select>` styled to match** — full keyboard/screen-reader support for free; a custom listbox is a later enhancement.

**Interfaces:**
- Consumes: `cx`, `Icon` (`chevron-down`), tokens.
- Produces:
  - `Select` (`'use client'`) from `@/components/ui/Select`: `type SelectOption = { value: string; label: string }`; `type SelectProps = { label?: string; value?: string; onChange?: (value: string) => void; options?: SelectOption[]; placeholder?: string } & Omit<React.ComponentPropsWithRef<"select">, "onChange" | "value" | "children">`. Defaults `placeholder="Select…"`. `className` on root wrapper; rest + ref on the native `<select>` (composite-field split, same as Input). No selection renders the placeholder as a hidden disabled option with `value=""`.
  - `Tabs` (`'use client'`): `type TabItem = { value: string; label: string }`; `type TabsProps = { tabs?: TabItem[]; value?: string; defaultValue?: string; onChange?: (value: string) => void } & Omit<React.ComponentPropsWithRef<"div">, "onChange" | "defaultValue">`. Controlled when `value` given, else internal state seeded from `defaultValue` or first tab. Real `<button role="tab">`s inside `role="tablist"`, active tab has `aria-selected="true"`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/select-tabs.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";

const POSITIONS = [
  { value: "line-cook", label: "Line cook" },
  { value: "server", label: "Server" },
];

describe("Select", () => {
  it("renders a native labelled select and reports the chosen value", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Position"
        placeholder="Choose a position"
        options={POSITIONS}
        onChange={onChange}
      />
    );
    const select = screen.getByLabelText("Position");
    expect(select.tagName).toBe("SELECT");
    await userEvent.selectOptions(select, "server");
    expect(onChange).toHaveBeenCalledWith("server");
  });

  it("shows the placeholder when nothing is selected", () => {
    render(
      <Select label="Position" placeholder="Choose a position" options={POSITIONS} />
    );
    const select = screen.getByLabelText("Position") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(
      screen.getByRole("option", { name: "Choose a position", hidden: true })
    ).toBeInTheDocument();
  });

  it("reflects a controlled value", () => {
    render(
      <Select label="Position" value="line-cook" onChange={() => {}} options={POSITIONS} />
    );
    expect((screen.getByLabelText("Position") as HTMLSelectElement).value).toBe(
      "line-cook"
    );
  });
});

describe("Tabs", () => {
  const TABS = [
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
  ];

  it("renders real tab buttons and marks the active one", () => {
    render(<Tabs tabs={TABS} value="day" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("fires onChange with the tab value on click", async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="week" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Day" }));
    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("manages its own state when uncontrolled", async () => {
    render(<Tabs tabs={TABS} defaultValue="week" />);
    await userEvent.click(screen.getByRole("tab", { name: "Day" }));
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/select-tabs.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Select"`.

- [ ] **Step 3: Implement Select**

Create `src/components/ui/Select.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font-sans);
  min-width: 0;
}

.label {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  color: var(--text-primary);
}

.control {
  position: relative;
  display: flex;
  align-items: center;
}

.select {
  appearance: none;
  width: 100%;
  height: 44px;
  padding: 0 36px 0 12px;
  background: var(--surface-card);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-body-size);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    box-shadow var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.select:focus-visible {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}

.select:disabled {
  background: var(--surface-sunken);
  cursor: not-allowed;
}

.placeholder {
  color: var(--text-tertiary);
}

.chevron {
  position: absolute;
  right: 12px;
  pointer-events: none;
  color: var(--text-tertiary);
}
```

Create `src/components/ui/Select.tsx`:

```tsx
"use client";

import { useId } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./Select.module.css";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  label?: string;
  value?: string;
  /** Reports the chosen option value (export .d.ts API, kept). */
  onChange?: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
} & Omit<React.ComponentPropsWithRef<"select">, "onChange" | "value" | "children">;

/**
 * Native <select> styled to the design system. The export's div-popup had no
 * keyboard support; the native control gets it for free. className lands on
 * the root wrapper; rest props and the ref go to the <select>.
 */
export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  className,
  id,
  disabled,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const isPlaceholder = value === undefined || value === "";
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className={styles.control}>
        <select
          id={selectId}
          className={cx(styles.select, isPlaceholder && styles.placeholder)}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          {...rest}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={16} className={styles.chevron} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement Tabs**

Create `src/components/ui/Tabs.module.css`:

```css
.tablist {
  display: flex;
  gap: 4px;
  background: var(--surface-sunken);
  padding: 4px;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  width: fit-content;
}

.tab {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--text-label-size);
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition: background var(--duration-base) var(--ease-out);
}

.tab:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.tab[aria-selected="true"] {
  color: var(--text-brand);
  background: var(--surface-card);
  box-shadow: var(--shadow-sm);
}
```

Create `src/components/ui/Tabs.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cx } from "./cx";
import styles from "./Tabs.module.css";

export type TabItem = { value: string; label: string };

export type TabsProps = {
  tabs?: TabItem[];
  /** Controlled active value. Omit to let Tabs manage its own state. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
} & Omit<React.ComponentPropsWithRef<"div">, "onChange" | "defaultValue">;

export function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  className,
  ...rest
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value);
  const active = value !== undefined ? value : internal;

  function select(v: string) {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  }

  return (
    <div role="tablist" className={cx(styles.tablist, className)} {...rest}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={active === t.value}
          className={styles.tab}
          onClick={() => select(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/select-tabs.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Select.tsx src/components/ui/Select.module.css src/components/ui/Tabs.tsx src/components/ui/Tabs.module.css src/components/ui/select-tabs.test.tsx
git commit -m "feat: port Select (native, keyboard-accessible) and Tabs"
```

---

### Task 6: Badge, Tag, Tooltip

**Files:**
- Create: `src/components/ui/Badge.tsx`, `src/components/ui/Badge.module.css`
- Create: `src/components/ui/Tag.tsx`, `src/components/ui/Tag.module.css`
- Create: `src/components/ui/Tooltip.tsx`, `src/components/ui/Tooltip.module.css`
- Test: `src/components/ui/feedback.test.tsx`

Export reference: `"/Users/gary/dev/RosterHouse/RosterHouse Design System/components/feedback/Badge.jsx"`, `".../feedback/Tag.jsx"` (remove control is an onClick span — becomes a real button), `".../feedback/Tooltip.jsx"` (JS hover state — becomes CSS-only, which also makes it show on keyboard focus).

**Interfaces:**
- Consumes: `cx`, `Icon` (`x`), tokens.
- Produces (all three server-safe, no `'use client'`):
  - `Badge`: `type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral"`; `type BadgeProps = { tone?: BadgeTone } & React.ComponentPropsWithRef<"span">`. Default `tone="success"`. Uppercase styling comes from CSS (`text-transform`), so callers still pass sentence-case copy.
  - `Tag`: `type TagProps = { onRemove?: () => void; color?: "neutral" | "brand" | "accent" } & React.ComponentPropsWithRef<"span">`. When `onRemove` is set, renders a real `<button aria-label="Remove">` (pass `onRemove` only from client components).
  - `Tooltip`: `type TooltipProps = { label: string; side?: "top" | "bottom" } & React.ComponentPropsWithRef<"span">`. Bubble is `role="tooltip"`, shown via CSS on `:hover` and `:focus-within` (no JS state).

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/feedback.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "@/components/ui/Badge";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";

describe("Badge", () => {
  it("renders children with a tone data attribute", () => {
    render(<Badge tone="warning">Pending</Badge>);
    const badge = screen.getByText("Pending");
    expect(badge).toHaveAttribute("data-tone", "warning");
  });

  it("defaults to the success tone and merges className", () => {
    render(<Badge className="extra">Confirmed</Badge>);
    const badge = screen.getByText("Confirmed");
    expect(badge).toHaveAttribute("data-tone", "success");
    expect(badge.className).toContain("extra");
  });
});

describe("Tag", () => {
  it("renders a real remove button that fires onRemove", async () => {
    const onRemove = vi.fn();
    render(<Tag onRemove={onRemove}>Line cook</Tag>);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders no button without onRemove", () => {
    render(<Tag>Server</Tag>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Tooltip", () => {
  it("renders the label in a tooltip role attached to the trigger", () => {
    render(
      <Tooltip label="Add shift">
        <button type="button">Plus</button>
      </Tooltip>
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Add shift");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/feedback.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Badge"`.

- [ ] **Step 3: Implement Badge, Tag, Tooltip**

Create `src/components/ui/Badge.module.css`:

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: var(--text-caption-size);
  font-weight: var(--text-caption-weight);
  letter-spacing: var(--text-caption-tracking);
  text-transform: uppercase;
}

.badge[data-tone="success"] {
  background: var(--status-success-bg);
  color: var(--status-success);
}
.badge[data-tone="warning"] {
  background: var(--status-warning-bg);
  color: var(--amber-800);
}
.badge[data-tone="danger"] {
  background: var(--status-danger-bg);
  color: var(--status-danger);
}
.badge[data-tone="info"] {
  background: var(--status-info-bg);
  color: var(--status-info);
}
.badge[data-tone="neutral"] {
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
```

Create `src/components/ui/Badge.tsx`:

```tsx
import { cx } from "./cx";
import styles from "./Badge.module.css";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export type BadgeProps = {
  tone?: BadgeTone;
} & React.ComponentPropsWithRef<"span">;

export function Badge({
  tone = "success",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span data-tone={tone} className={cx(styles.badge, className)} {...rest}>
      {children}
    </span>
  );
}
```

Create `src/components/ui/Tag.module.css`:

```css
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--text-body-sm-size);
  font-weight: 500;
}

.tag[data-color="neutral"] {
  background: var(--surface-sunken);
  color: var(--text-primary);
}
.tag[data-color="brand"] {
  background: var(--surface-brand-soft);
  color: var(--text-brand);
}
.tag[data-color="accent"] {
  background: var(--amber-100);
  color: var(--amber-800);
}

.remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.remove:hover {
  opacity: 1;
}

.remove:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  opacity: 1;
}
```

Create `src/components/ui/Tag.tsx`:

```tsx
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./Tag.module.css";

export type TagProps = {
  /** Renders a real remove button when provided (client components only). */
  onRemove?: () => void;
  color?: "neutral" | "brand" | "accent";
} & React.ComponentPropsWithRef<"span">;

export function Tag({
  onRemove,
  color = "neutral",
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span data-color={color} className={cx(styles.tag, className)} {...rest}>
      {children}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label="Remove"
          onClick={onRemove}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  );
}
```

Create `src/components/ui/Tooltip.module.css`:

```css
.root {
  position: relative;
  display: inline-flex;
}

.bubble {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: var(--green-900);
  color: var(--text-inverse);
  font-family: var(--font-sans);
  font-size: var(--text-body-sm-size);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 20;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    visibility var(--duration-fast) var(--ease-out);
}

.root[data-side="top"] .bubble {
  bottom: calc(100% + 6px);
}

.root[data-side="bottom"] .bubble {
  top: calc(100% + 6px);
}

.root:hover .bubble,
.root:focus-within .bubble {
  opacity: 1;
  visibility: visible;
}
```

Create `src/components/ui/Tooltip.tsx`:

```tsx
import { cx } from "./cx";
import styles from "./Tooltip.module.css";

export type TooltipProps = {
  label: string;
  side?: "top" | "bottom";
} & React.ComponentPropsWithRef<"span">;

/**
 * CSS-only tooltip: shows on hover AND keyboard focus of the wrapped
 * control (the export's JS-hover version never showed for keyboard users).
 */
export function Tooltip({
  label,
  side = "top",
  className,
  children,
  ...rest
}: TooltipProps) {
  return (
    <span data-side={side} className={cx(styles.root, className)} {...rest}>
      {children}
      <span role="tooltip" className={styles.bubble}>
        {label}
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/feedback.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Badge.tsx src/components/ui/Badge.module.css src/components/ui/Tag.tsx src/components/ui/Tag.module.css src/components/ui/Tooltip.tsx src/components/ui/Tooltip.module.css src/components/ui/feedback.test.tsx
git commit -m "feat: port Badge, Tag, Tooltip as server-safe primitives"
```

---

### Task 7: Toast, Dialog (+ shared modal behavior)

**Files:**
- Create: `src/components/ui/Toast.tsx`, `src/components/ui/Toast.module.css`
- Create: `src/components/ui/use-modal-behavior.ts`
- Create: `src/components/ui/Dialog.tsx`, `src/components/ui/Dialog.module.css`
- Test: `src/components/ui/Dialog.test.tsx`, `src/components/ui/Toast.test.tsx`

Export reference: `"/Users/gary/dev/RosterHouse/RosterHouse Design System/components/feedback/Toast.jsx"` (defect: shows a checkmark icon for every tone, including danger — the port varies the icon by tone), `".../containers/Dialog.jsx"` (defects: no portal, no focus trap, no focus restore, no body scroll lock, close control is a span).

**Interfaces:**
- Consumes: `cx`, `Icon`, `Button` (in tests), tokens.
- Produces:
  - `Toast` (server-safe presentational — Task 11's Toaster drives it): `type ToastTone = "success" | "warning" | "danger" | "info"`; `type ToastProps = { tone?: ToastTone; title: string; description?: string; onClose?: () => void } & Omit<React.ComponentPropsWithRef<"div">, "title">`. Root has `role="status"`. Tone→icon map: success→`check`, warning→`alert-triangle`, danger→`x`, info→`bell`. Close button `aria-label="Dismiss"`.
  - `useModalBehavior(open: boolean, panelRef: React.RefObject<HTMLElement | null>, onClose?: () => void): void` — Escape-to-close, Tab focus trap, initial focus (first focusable, else the panel itself — give the panel `tabIndex={-1}`), focus restore on unmount, body scroll lock. Task 12's Sheet reuses this hook verbatim.
  - `Dialog` (`'use client'`): `type DialogProps = { open: boolean; onClose?: () => void; title?: string; children?: React.ReactNode; footer?: React.ReactNode; className?: string }`. Portal to `document.body`; scrim `rgba(10, 20, 17, 0.4)` with `data-testid="dialog-scrim"`; panel `role="dialog" aria-modal="true" aria-label={title}`. Scrim click closes; panel click does not.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/Toast.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "@/components/ui/Toast";

describe("Toast", () => {
  it("renders title and description in a status region", () => {
    render(
      <Toast
        tone="success"
        title="Schedule published"
        description="12 employees notified."
      />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Schedule published");
    expect(status).toHaveTextContent("12 employees notified.");
    expect(status).toHaveAttribute("data-tone", "success");
  });

  it.each([
    ["success", "check"],
    ["warning", "alert-triangle"],
    ["danger", "x"],
    ["info", "bell"],
  ] as const)("uses a %s-specific icon (%s)", (tone, iconName) => {
    render(<Toast tone={tone} title="Heads up" />);
    // Icon components render the lucide name as a class, e.g. "lucide-check"
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg?.getAttribute("class") ?? "").toContain(iconName);
  });

  it("fires onClose from a real Dismiss button", async () => {
    const onClose = vi.fn();
    render(<Toast title="Shift updated" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no close button without onClose", () => {
    render(<Toast title="Shift updated" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

Note: lucide-react puts `lucide-<name>` in the svg's class attribute. If the installed version renders classes differently, adjust the assertion to inspect the svg's class for the icon name — the point under test is that the four tones render four different icons.

Create `src/components/ui/Dialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} title="Assign shift">
        Body
      </Dialog>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title and children in a dialog role when open", () => {
    render(
      <Dialog open title="Assign shift">
        Pick an employee
      </Dialog>
    );
    const dialog = screen.getByRole("dialog", { name: "Assign shift" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Pick an employee");
  });

  it("closes on scrim click but not on panel click", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Assign shift">
        Body
      </Dialog>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("dialog-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Assign shift">
        Body
      </Dialog>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog and traps Tab", async () => {
    render(
      <Dialog
        open
        title="Assign shift"
        footer={
          <>
            <Button variant="secondary">Cancel</Button>
            <Button>Save</Button>
          </>
        }
      >
        Body
      </Dialog>
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus(); // initial focus = first focusable
    await userEvent.tab();
    expect(save).toHaveFocus();
    await userEvent.tab(); // wraps to first
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps back to last
    expect(save).toHaveFocus();
  });

  it("restores focus to the trigger when closed", () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Open dialog</button>
          <Dialog open={open} title="Assign shift">
            Body
          </Dialog>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    rerender(<Harness open={true} />);
    expect(trigger).not.toHaveFocus();
    rerender(<Harness open={false} />);
    expect(trigger).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/Toast.test.tsx src/components/ui/Dialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Toast"` / `"@/components/ui/Dialog"`.

- [ ] **Step 3: Implement Toast**

Create `src/components/ui/Toast.module.css`:

```css
.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 320px;
  padding: 14px 16px;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-sans);
}

.iconWrap {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast[data-tone="success"] .iconWrap {
  background: var(--status-success-bg);
  color: var(--status-success);
}
.toast[data-tone="warning"] .iconWrap {
  background: var(--status-warning-bg);
  color: var(--amber-700);
}
.toast[data-tone="danger"] .iconWrap {
  background: var(--status-danger-bg);
  color: var(--status-danger);
}
.toast[data-tone="info"] .iconWrap {
  background: var(--status-info-bg);
  color: var(--status-info);
}

.content {
  flex: 1;
}

.title {
  font-size: var(--text-h3-size);
  font-weight: 600;
  color: var(--text-primary);
}

.description {
  font-size: var(--text-body-sm-size);
  color: var(--text-secondary);
  margin-top: 4px;
}

.close {
  display: inline-flex;
  border: none;
  background: transparent;
  padding: 2px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.close:hover {
  color: var(--text-primary);
}

.close:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

Create `src/components/ui/Toast.tsx`:

```tsx
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "warning" | "danger" | "info";

/** Export defect fixed: the icon now varies by tone (was always a check). */
const TONE_ICON: Record<ToastTone, IconName> = {
  success: "check",
  warning: "alert-triangle",
  danger: "x",
  info: "bell",
};

export type ToastProps = {
  tone?: ToastTone;
  title: string;
  description?: string;
  onClose?: () => void;
} & Omit<React.ComponentPropsWithRef<"div">, "title">;

export function Toast({
  tone = "success",
  title,
  description,
  onClose,
  className,
  ...rest
}: ToastProps) {
  return (
    <div
      role="status"
      data-tone={tone}
      className={cx(styles.toast, className)}
      {...rest}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        <Icon name={TONE_ICON[tone]} size={15} strokeWidth={2.5} />
      </span>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss"
          onClick={onClose}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement the shared modal behavior hook**

Create `src/components/ui/use-modal-behavior.ts`:

```ts
"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared behavior for Dialog and Sheet: initial focus, Tab trap,
 * Escape-to-close, focus restore, body scroll lock.
 * The panel element must have tabIndex={-1} so it can take initial focus
 * when it contains no focusable children.
 */
export function useModalBehavior(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose?: () => void
) {
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const target = panelRef.current;
      if (!target) return;
      const focusable = Array.from(
        target.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === target)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose, panelRef]);
}
```

- [ ] **Step 5: Implement Dialog**

Create `src/components/ui/Dialog.module.css`:

```css
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(10, 20, 17, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  font-family: var(--font-sans);
}

.panel {
  width: 420px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--surface-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: dialog-in var(--duration-base) var(--ease-out);
}

.panel:focus {
  outline: none;
}

.title {
  font-size: var(--text-h2-size);
  font-weight: var(--text-h2-weight);
  line-height: var(--text-h2-line);
  color: var(--text-primary);
}

.body {
  color: var(--text-primary);
  font-size: var(--text-body-size);
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

Create `src/components/ui/Dialog.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useModalBehavior } from "./use-modal-behavior";
import styles from "./Dialog.module.css";

export type DialogProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(open, panelRef, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.scrim}
      data-testid="dialog-scrim"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(styles.panel, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/Toast.test.tsx src/components/ui/Dialog.test.tsx`
Expected: PASS — 13 tests total.

- [ ] **Step 7: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Toast.tsx src/components/ui/Toast.module.css src/components/ui/Toast.test.tsx src/components/ui/use-modal-behavior.ts src/components/ui/Dialog.tsx src/components/ui/Dialog.module.css src/components/ui/Dialog.test.tsx
git commit -m "feat: port Toast (tone icons) and Dialog (portal, focus trap)"
```

---

### Task 8: ShiftBlock, WeekGridCell, AvatarStatus, ConflictChip

**Files:**
- Create: `src/components/ui/initials.ts`
- Create: `src/components/ui/ShiftBlock.tsx`, `src/components/ui/ShiftBlock.module.css`
- Create: `src/components/ui/WeekGridCell.tsx`, `src/components/ui/WeekGridCell.module.css`
- Create: `src/components/ui/AvatarStatus.tsx`, `src/components/ui/AvatarStatus.module.css`
- Create: `src/components/ui/ConflictChip.tsx`, `src/components/ui/ConflictChip.module.css`
- Modify: `src/app/globals.css` (append the `.sr-only` utility)
- Test: `src/components/ui/scheduling.test.tsx`

Export reference: `"/Users/gary/dev/RosterHouse/RosterHouse Design System/components/scheduling/ShiftBlock.jsx"`, `".../scheduling/WeekGridCell.jsx"`, `".../scheduling/AvatarStatus.jsx"` (defect: color-only status dot — the port adds hidden status text), `".../scheduling/ConflictChip.jsx"`.

**Interfaces:**
- Consumes: `cx`, `Icon` (`alert-triangle`, `plus`), tokens.
- Produces (all server-safe; per the findings doc ConflictChip/Badge/AvatarStatus MUST NOT have `'use client'`):
  - `initialsOf(name: string): string` from `@/components/ui/initials` — "Maria Garcia" → "MG". Also used by Avatar (Task 10) and ManagerSidebar (Task 13).
  - `ShiftBlock`: `type ShiftBlockStatus = "confirmed" | "open" | "conflict" | "draft"`; `type ShiftBlockProps = { role: string; time: string; employeeName?: string; status?: ShiftBlockStatus; compact?: boolean; conflictReason?: string; onClick?: () => void; className?: string }`. Renders a real `<button type="button">` when `onClick` is provided, else a `<div>`. **Deliberate exception:** no rest/ref spread — the export's `role` prop (position name, e.g. "Line cook") shadows the ARIA `role` attribute, so spreading arbitrary rest props would be a footgun; Phase 3 consumes only the declared props.
  - `WeekGridCell`: `type WeekGridCellProps = { children?: React.ReactNode; empty?: boolean; hasConflict?: boolean; onClick?: () => void; addLabel?: string; className?: string }`. NEW prop vs the export: `addLabel` (default `"Add shift"`) — the accessible name of the real add `<button>` an empty cell renders. Non-empty cells render a plain `<div>` wrapping children (never a button — ShiftBlock children may be buttons and nested buttons are invalid HTML). `hasConflict` renders the dashed danger border via `data-conflict`.
  - `AvatarStatus`: `type AvatarStatusValue = "available" | "unavailable" | "pending" | "off"`; `type AvatarStatusProps = { name: string; status?: AvatarStatusValue; size?: number } & React.ComponentPropsWithRef<"span">`. Defaults `status="available"`, `size=40`. The color dot is backed by visually-hidden text ("Available" / "Unavailable" / "Pending" / "Off") via the global `.sr-only` class this task adds.
  - `ConflictChip`: `type ConflictChipProps = React.ComponentPropsWithRef<"span">` — leading alert-triangle icon + children.
  - Global CSS: `.sr-only` utility appended to `src/app/globals.css` (visually hidden, screen-reader visible). Tasks 10 (Spinner) and later phases reuse it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/scheduling.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initialsOf } from "@/components/ui/initials";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import { AvatarStatus } from "@/components/ui/AvatarStatus";
import { ConflictChip } from "@/components/ui/ConflictChip";

describe("initialsOf", () => {
  it("takes the first letters of the first two words, uppercased", () => {
    expect(initialsOf("Maria Garcia")).toBe("MG");
    expect(initialsOf("Jamie")).toBe("J");
    expect(initialsOf("Ana de la Cruz")).toBe("AD");
    expect(initialsOf("  maria   garcia  ")).toBe("MG");
  });
});

describe("ShiftBlock", () => {
  it("renders a button when clickable and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <ShiftBlock
        role="Line cook"
        time="7:00 AM – 3:00 PM"
        employeeName="Maria Garcia"
        onClick={onClick}
      />
    );
    const block = screen.getByRole("button");
    expect(block).toHaveTextContent("Line cook");
    expect(block).toHaveTextContent("7:00 AM – 3:00 PM");
    expect(block).toHaveTextContent("Maria Garcia");
    await userEvent.click(block);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a plain div when not clickable", () => {
    render(<ShiftBlock role="Server" time="4:00 PM – 10:00 PM" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Server")).toBeInTheDocument();
  });

  it("shows the conflict reason only for conflict status", () => {
    const reason = "Overlaps with Sam's 6:00 PM – 10:00 PM shift";
    const { rerender } = render(
      <ShiftBlock
        role="Server"
        time="4:00 PM – 10:00 PM"
        status="conflict"
        conflictReason={reason}
      />
    );
    expect(screen.getByText(reason)).toBeInTheDocument();
    rerender(
      <ShiftBlock
        role="Server"
        time="4:00 PM – 10:00 PM"
        status="confirmed"
        conflictReason={reason}
      />
    );
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });
});

describe("WeekGridCell", () => {
  it("renders an accessible add button when empty", async () => {
    const onClick = vi.fn();
    render(<WeekGridCell empty onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Add shift" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders children in a non-interactive div when not empty", () => {
    render(
      <WeekGridCell>
        <span>7:00 AM – 3:00 PM</span>
      </WeekGridCell>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("7:00 AM – 3:00 PM")).toBeInTheDocument();
  });

  it("marks conflict cells with a data attribute", () => {
    render(
      <WeekGridCell hasConflict>
        <span>Shift</span>
      </WeekGridCell>
    );
    expect(screen.getByText("Shift").parentElement).toHaveAttribute(
      "data-conflict",
      "true"
    );
  });
});

describe("AvatarStatus", () => {
  it("renders initials and hidden status text (not color-only)", () => {
    render(<AvatarStatus name="Maria Garcia" status="pending" />);
    expect(screen.getByText("MG")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("ConflictChip", () => {
  it("renders children with a warning icon", () => {
    const { container } = render(
      <ConflictChip>Double-booked with the 2:00 PM shift</ConflictChip>
    );
    expect(
      screen.getByText("Double-booked with the 2:00 PM shift")
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/scheduling.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/initials"`.

- [ ] **Step 3: Implement initials + the global .sr-only utility**

Create `src/components/ui/initials.ts`:

```ts
/** "Maria Garcia" -> "MG" (first letter of the first two words). */
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
```

Append to the END of `src/app/globals.css` (do not touch the existing rules):

```css
/* Visually hidden, screen-reader visible. Used wherever meaning is
   otherwise carried by color alone (status dots, spinners). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4: Implement ShiftBlock**

Create `src/components/ui/ShiftBlock.module.css`:

```css
.block {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1.5px solid transparent;
  font-family: var(--font-sans);
}

.block[data-compact="true"] {
  padding: 6px 8px;
}

button.block {
  cursor: pointer;
}

button.block:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.block[data-status="confirmed"] {
  background: var(--green-50);
  border-color: var(--green-300);
}
.block[data-status="confirmed"] .role {
  color: var(--green-800);
}

.block[data-status="open"] {
  background: var(--amber-50);
  border-color: var(--amber-300);
}
.block[data-status="open"] .role {
  color: var(--amber-800);
}

.block[data-status="conflict"] {
  background: var(--red-50);
  border-color: var(--red-500);
}
.block[data-status="conflict"] .role {
  color: var(--red-700);
}

.block[data-status="draft"] {
  background: var(--surface-sunken);
  border-color: var(--border-strong);
}
.block[data-status="draft"] .role {
  color: var(--text-secondary);
}

.role {
  font-size: var(--text-label-size);
  font-weight: 600;
}

.block[data-compact="true"] .role {
  font-size: 11px;
}

.time {
  font-size: var(--text-body-sm-size);
  color: var(--text-secondary);
}

.block[data-compact="true"] .time {
  font-size: 10px;
}

.employee {
  font-size: var(--text-body-sm-size);
  color: var(--text-primary);
  font-weight: 500;
}

.block[data-compact="true"] .employee {
  font-size: 10px;
}

.conflict {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 3px;
  padding-top: 3px;
  border-top: 1px solid var(--red-100);
  font-size: 11px;
  line-height: 1.3;
  font-weight: 600;
  color: var(--status-danger);
}

.block[data-compact="true"] .conflict {
  font-size: 9.5px;
}

.conflictIcon {
  flex: none;
  margin-top: 2px;
}
```

Create `src/components/ui/ShiftBlock.tsx`:

```tsx
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./ShiftBlock.module.css";

export type ShiftBlockStatus = "confirmed" | "open" | "conflict" | "draft";

export type ShiftBlockProps = {
  /** Position name shown as the block heading, e.g. "Line cook" (export API — shadows the ARIA attribute on purpose, so no rest spread here). */
  role: string;
  /** Preformatted range, e.g. "7:00 AM – 3:00 PM" (en dash). */
  time: string;
  employeeName?: string;
  status?: ShiftBlockStatus;
  compact?: boolean;
  /** Shown only when status is "conflict". */
  conflictReason?: string;
  onClick?: () => void;
  className?: string;
};

export function ShiftBlock({
  role,
  time,
  employeeName,
  status = "confirmed",
  compact = false,
  conflictReason,
  onClick,
  className,
}: ShiftBlockProps) {
  const content = (
    <>
      <span className={styles.role}>{role}</span>
      <span className={styles.time}>{time}</span>
      {employeeName && <span className={styles.employee}>{employeeName}</span>}
      {status === "conflict" && conflictReason && (
        <span className={styles.conflict}>
          <Icon
            name="alert-triangle"
            size={compact ? 9 : 11}
            strokeWidth={2.5}
            className={styles.conflictIcon}
          />
          {conflictReason}
        </span>
      )}
    </>
  );

  const shared = {
    "data-status": status,
    "data-compact": compact ? "true" : undefined,
    className: cx(styles.block, className),
  };

  return onClick ? (
    <button type="button" onClick={onClick} {...shared}>
      {content}
    </button>
  ) : (
    <div {...shared}>{content}</div>
  );
}
```

- [ ] **Step 5: Implement WeekGridCell**

Create `src/components/ui/WeekGridCell.module.css`:

```css
.cell {
  min-height: 72px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}

.cell[data-conflict="true"] {
  border: 1.5px dashed var(--status-danger);
}

.empty {
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-default);
  background: var(--surface-card);
  color: var(--border-strong);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.empty:hover {
  background: var(--surface-brand-soft);
  color: var(--text-brand);
}

.empty:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  color: var(--text-brand);
}
```

Create `src/components/ui/WeekGridCell.tsx`:

```tsx
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./WeekGridCell.module.css";

export type WeekGridCellProps = {
  children?: React.ReactNode;
  empty?: boolean;
  hasConflict?: boolean;
  /** Fired by the add button in empty cells. */
  onClick?: () => void;
  /** Accessible name for the add button. @default "Add shift" */
  addLabel?: string;
  className?: string;
};

/**
 * Empty cells are a real add <button>; occupied cells are a plain <div>
 * (children are usually ShiftBlock buttons — nesting buttons is invalid).
 */
export function WeekGridCell({
  children,
  empty = false,
  hasConflict = false,
  onClick,
  addLabel = "Add shift",
  className,
}: WeekGridCellProps) {
  if (empty) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={addLabel}
        data-conflict={hasConflict ? "true" : undefined}
        className={cx(styles.cell, styles.empty, className)}
      >
        <Icon name="plus" size={16} />
      </button>
    );
  }
  return (
    <div
      data-conflict={hasConflict ? "true" : undefined}
      className={cx(styles.cell, className)}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Implement AvatarStatus and ConflictChip**

Create `src/components/ui/AvatarStatus.module.css`:

```css
.root {
  position: relative;
  display: inline-flex;
  font-family: var(--font-sans);
}

.circle {
  border-radius: 50%;
  background: var(--green-100);
  color: var(--green-800);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.dot {
  position: absolute;
  bottom: 0;
  right: 0;
  border-radius: 50%;
  border: 2px solid var(--surface-card);
}

.dot[data-status="available"] {
  background: var(--status-success);
}
.dot[data-status="unavailable"] {
  background: var(--status-danger);
}
.dot[data-status="pending"] {
  background: var(--status-warning);
}
.dot[data-status="off"] {
  background: var(--neutral-400);
}
```

Create `src/components/ui/AvatarStatus.tsx`:

```tsx
import { cx } from "./cx";
import { initialsOf } from "./initials";
import styles from "./AvatarStatus.module.css";

export type AvatarStatusValue = "available" | "unavailable" | "pending" | "off";

const STATUS_LABEL: Record<AvatarStatusValue, string> = {
  available: "Available",
  unavailable: "Unavailable",
  pending: "Pending",
  off: "Off",
};

export type AvatarStatusProps = {
  name: string;
  status?: AvatarStatusValue;
  size?: number;
} & React.ComponentPropsWithRef<"span">;

export function AvatarStatus({
  name,
  status = "available",
  size = 40,
  className,
  ...rest
}: AvatarStatusProps) {
  return (
    <span className={cx(styles.root, className)} {...rest}>
      <span
        className={styles.circle}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
      <span
        data-status={status}
        className={styles.dot}
        style={{
          width: Math.round(size * 0.28),
          height: Math.round(size * 0.28),
        }}
      />
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </span>
  );
}
```

Note: the initials circle is `aria-hidden` (screen readers hear the status text, not a meaningless "MG"; the surrounding screen prints the person's name). Testing Library's `getByText` finds `aria-hidden` nodes by default, so the `getByText("MG")` assertion still passes.

Create `src/components/ui/ConflictChip.module.css`:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--status-danger-bg);
  color: var(--status-danger);
  font-family: var(--font-sans);
  font-size: var(--text-body-sm-size);
  font-weight: 600;
}
```

Create `src/components/ui/ConflictChip.tsx`:

```tsx
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./ConflictChip.module.css";

export type ConflictChipProps = React.ComponentPropsWithRef<"span">;

export function ConflictChip({
  className,
  children,
  ...rest
}: ConflictChipProps) {
  return (
    <span className={cx(styles.chip, className)} {...rest}>
      <Icon name="alert-triangle" size={14} strokeWidth={2.2} />
      {children}
    </span>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/scheduling.test.tsx`
Expected: PASS — 9 tests.

- [ ] **Step 8: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/initials.ts src/components/ui/ShiftBlock.tsx src/components/ui/ShiftBlock.module.css src/components/ui/WeekGridCell.tsx src/components/ui/WeekGridCell.module.css src/components/ui/AvatarStatus.tsx src/components/ui/AvatarStatus.module.css src/components/ui/ConflictChip.tsx src/components/ui/ConflictChip.module.css src/components/ui/scheduling.test.tsx src/app/globals.css
git commit -m "feat: port scheduling primitives with accessible semantics"
```

---

### Task 9: time-field-parse + TimeField

**Files:**
- Create: `src/components/ui/time-field-parse.ts`
- Create: `src/components/ui/TimeField.tsx`
- Test: `src/components/ui/time-field-parse.test.ts`, `src/components/ui/TimeField.test.tsx`

The findings doc calls free-text time entry with zero validation the export's worst data-entry defect. This task builds the validated replacement used on every shift/availability form.

**Interfaces:**
- Consumes: `Input` (Task 4). The roadmap pins `parseTime12h` as a Phase 3 `src/lib/time.ts` export; Phase 1 ships a **local pure copy** here so this phase has no dependency on Phase 3. **Phase 3 must move this implementation into `src/lib/time.ts` and change this file to `export { parseTime12h, type ParsedTime } from "@/lib/time";`** — the roadmap signature is used verbatim so the move is mechanical.
- Produces:
  - `parseTime12h(input: string): { hour: number; minute: number } | null` from `@/components/ui/time-field-parse` — 24-hour result (`"7:00 AM"` → `{hour: 7, minute: 0}`, `"2:30 PM"` → `{hour: 14, minute: 30}`, `"12:00 AM"` → `{hour: 0, minute: 0}`, `"12:00 PM"` → `{hour: 12, minute: 0}`); `null` for anything invalid. Accepts `h`, `h:mm`, case-insensitive `AM/PM/a.m./p.m.`, optional space, surrounding whitespace. Meridiem is required (a bare "7:00" is ambiguous → invalid). Also exports `type ParsedTime = { hour: number; minute: number }`.
  - `TimeField` (`'use client'`) from `@/components/ui/TimeField`: `type TimeFieldProps = { label?: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string; disabled?: boolean; className?: string }`. Controlled text field; after first blur, a non-empty unparseable value shows the error "Enter a time like 7:00 AM" (and `aria-invalid` via Input); an external `error` prop overrides the internal message. Default `placeholder="7:00 AM"`.

- [ ] **Step 1: Write the failing parser tests**

Create `src/components/ui/time-field-parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTime12h } from "@/components/ui/time-field-parse";

describe("parseTime12h", () => {
  it.each([
    ["7:00 AM", { hour: 7, minute: 0 }],
    ["7:30 pm", { hour: 19, minute: 30 }],
    ["12:00 AM", { hour: 0, minute: 0 }], // midnight
    ["12:15 PM", { hour: 12, minute: 15 }], // noon
    ["11:45 pm", { hour: 23, minute: 45 }],
    ["7 AM", { hour: 7, minute: 0 }], // minutes optional
    ["7am", { hour: 7, minute: 0 }], // no space
    ["  8:05 am  ", { hour: 8, minute: 5 }], // surrounding whitespace
    ["9:00 a.m.", { hour: 9, minute: 0 }], // dotted meridiem
  ])("parses %j", (input, expected) => {
    expect(parseTime12h(input)).toEqual(expected);
  });

  it.each([
    "",
    "7:00", // no meridiem — ambiguous
    "13:00 PM", // hour out of 1–12
    "0:30 AM",
    "24:00 AM",
    "7:60 AM", // bad minutes
    "7:0 AM", // minutes must be two digits
    "700 AM",
    "seven AM",
    "7:00 XM",
  ])("rejects %j", (input) => {
    expect(parseTime12h(input)).toBeNull();
  });
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run: `npx vitest run src/components/ui/time-field-parse.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/ui/time-field-parse"`.

- [ ] **Step 3: Implement the parser**

Create `src/components/ui/time-field-parse.ts`:

```ts
export type ParsedTime = { hour: number; minute: number };

/**
 * Parse a 12-hour wall-clock string ("7:00 AM", "7 pm", "9:00 a.m.") into
 * a 24-hour { hour, minute }. Returns null for anything invalid — including
 * a missing meridiem, which would be ambiguous.
 *
 * NOTE (Phase 3): this is the roadmap's src/lib/time.ts parseTime12h,
 * shipped locally so Phase 1 stands alone. Phase 3 moves the implementation
 * to src/lib/time.ts and replaces this file's body with:
 *   export { parseTime12h, type ParsedTime } from "@/lib/time";
 */
export function parseTime12h(input: string): ParsedTime | null {
  const match = /^\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\s*$/i.exec(
    input
  );
  if (!match) return null;
  const rawHour = Number(match[1]);
  if (rawHour < 1 || rawHour > 12) return null;
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const isPm = match[3].toLowerCase().startsWith("p");
  let hour = rawHour % 12; // 12 AM -> 0; 12 PM -> 0, then +12 below
  if (isPm) hour += 12;
  return { hour, minute };
}
```

- [ ] **Step 4: Run parser tests to verify they pass**

Run: `npx vitest run src/components/ui/time-field-parse.test.ts`
Expected: PASS — 19 tests.

- [ ] **Step 5: Write the failing TimeField tests**

Create `src/components/ui/TimeField.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TimeField } from "@/components/ui/TimeField";

const ERROR = "Enter a time like 7:00 AM";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <TimeField label="Start time" value={value} onChange={setValue} />;
}

describe("TimeField", () => {
  it("accepts a valid 12-hour time without an error", async () => {
    render(<Harness />);
    const field = screen.getByLabelText("Start time");
    await userEvent.type(field, "7:00 AM");
    await userEvent.tab();
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("shows a specific error for an invalid time after blur", async () => {
    render(<Harness />);
    const field = screen.getByLabelText("Start time");
    await userEvent.type(field, "25:00");
    await userEvent.tab();
    expect(screen.getByText(ERROR)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the error live once the value becomes valid", async () => {
    render(<Harness initial="99" />);
    const field = screen.getByLabelText("Start time");
    await userEvent.click(field);
    await userEvent.tab(); // blur -> touched, error shows
    expect(screen.getByText(ERROR)).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, "2:30 PM");
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
  });

  it("does not flag an empty field (required-ness is the form's job)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Start time"));
    await userEvent.tab();
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
  });

  it("prefers an external error over the internal one", async () => {
    render(
      <TimeField
        label="Start time"
        value="7:00 AM"
        onChange={() => {}}
        error="This shift overlaps with Maria's 2:00 PM – 6:00 PM shift"
      />
    );
    expect(
      screen.getByText(
        "This shift overlaps with Maria's 2:00 PM – 6:00 PM shift"
      )
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run TimeField tests to verify they fail**

Run: `npx vitest run src/components/ui/TimeField.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/TimeField"`.

- [ ] **Step 7: Implement TimeField**

Create `src/components/ui/TimeField.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "./Input";
import { parseTime12h } from "./time-field-parse";

export type TimeFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** External error (e.g. a conflict message) — overrides internal validation. */
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * 12-hour time field. Validates on blur (then live) with parseTime12h; an
 * empty value is not an error — leave required-ness to the form.
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder = "7:00 AM",
  disabled = false,
  className,
}: TimeFieldProps) {
  const [touched, setTouched] = useState(false);
  const invalid =
    touched && value.trim() !== "" && parseTime12h(value) === null;
  const shownError = error ?? (invalid ? "Enter a time like 7:00 AM" : undefined);

  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setTouched(true)}
      error={shownError}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
    />
  );
}
```

- [ ] **Step 8: Run all Task 9 tests to verify they pass**

Run: `npx vitest run src/components/ui/time-field-parse.test.ts src/components/ui/TimeField.test.tsx`
Expected: PASS — 24 tests total.

- [ ] **Step 9: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/time-field-parse.ts src/components/ui/time-field-parse.test.ts src/components/ui/TimeField.tsx src/components/ui/TimeField.test.tsx
git commit -m "feat: add validated 12-hour TimeField with parseTime12h"
```

---

### Task 10: Textarea, Avatar, StatCard, EmptyState, Spinner

**Files:**
- Create: `src/components/ui/Textarea.tsx`, `src/components/ui/Textarea.module.css`
- Create: `src/components/ui/Avatar.tsx`, `src/components/ui/Avatar.module.css`
- Create: `src/components/ui/StatCard.tsx`, `src/components/ui/StatCard.module.css`
- Create: `src/components/ui/EmptyState.tsx`, `src/components/ui/EmptyState.module.css`
- Create: `src/components/ui/Spinner.tsx`, `src/components/ui/Spinner.module.css`
- Test: `src/components/ui/net-new.test.tsx`

StatCard reference: the export's hand-rolled version in `"/Users/gary/dev/RosterHouse/RosterHouse Design System/ui_kits/manager-web/DashboardScreen.jsx"` (`{ label, value, tone }` where `tone` colors the value). EmptyState and Spinner are net-new — the export ships almost no empty/loading states (review finding); these are the building blocks every later screen uses.

**Interfaces:**
- Consumes: `cx`, `Icon`, `Card`, `initialsOf`, the global `.sr-only` class (Task 8), tokens.
- Produces (all server-safe):
  - `Textarea`: `type TextareaProps = { label?: string; error?: string } & React.ComponentPropsWithRef<"textarea">`. Same composite split as Input: `className` on wrapper, rest + ref on `<textarea>`, default `rows={3}`, label/`aria-invalid`/`aria-describedby` wiring identical to Input.
  - `Avatar`: `type AvatarProps = { name: string; size?: number } & React.ComponentPropsWithRef<"span">`. Initials only, no status dot, default `size=40`.
  - `StatCard`: `type StatCardProps = { label: string; value: React.ReactNode; tone?: string; className?: string }` — `tone` is an optional CSS color token string for the value, e.g. `"var(--status-warning)"` (matches the export's dashboard usage).
  - `EmptyState`: `type EmptyStateProps = { icon?: IconName; title: string; description?: string; action?: React.ReactNode; className?: string }`. Default `icon="inbox"`. Centered layout.
  - `Spinner`: `type SpinnerProps = { size?: number; label?: string; className?: string }`. Default `size=20`, `label="Loading…"`. `role="status"` with sr-only label; pure-CSS rotation.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/net-new.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "@/components/ui/Textarea";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

describe("Textarea", () => {
  it("associates the label and defaults to 3 rows", () => {
    render(<Textarea label="Shift notes" />);
    const area = screen.getByLabelText("Shift notes");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("rows", "3");
  });

  it("wires an error with aria attributes", () => {
    render(<Textarea label="Note" error="Add a short note for your manager" />);
    const area = screen.getByLabelText("Note");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription(
      "Add a short note for your manager"
    );
  });
});

describe("Avatar", () => {
  it("renders initials without a status dot", () => {
    const { container } = render(<Avatar name="Maria Garcia" />);
    expect(screen.getByText("MG")).toBeInTheDocument();
    expect(container.querySelectorAll("span span").length).toBe(0);
  });
});

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Coverage gaps this week" value="2" />);
    expect(screen.getByText("Coverage gaps this week")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("applies the tone color to the value", () => {
    render(
      <StatCard
        label="Clocked in now"
        value="4"
        tone="var(--status-success)"
      />
    );
    expect(screen.getByText("4")).toHaveStyle({
      color: "var(--status-success)",
    });
  });
});

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="No shifts this week"
        description="Add a shift to get started."
        action={<button type="button">Add shift</button>}
      />
    );
    expect(screen.getByText("No shifts this week")).toBeInTheDocument();
    expect(screen.getByText("Add a shift to get started.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add shift" })
    ).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("announces loading via role status with an sr-only label", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");
  });

  it("accepts a custom label", () => {
    render(<Spinner label="Publishing schedule…" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Publishing schedule…"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/net-new.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Textarea"`.

- [ ] **Step 3: Implement Textarea and Avatar**

Create `src/components/ui/Textarea.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font-sans);
  min-width: 0;
}

.label {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  color: var(--text-primary);
}

.textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--surface-card);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-body-size);
  line-height: var(--text-body-line);
  color: var(--text-primary);
  resize: vertical;
  transition:
    box-shadow var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.textarea::placeholder {
  color: var(--text-tertiary);
}

.textarea:focus-visible {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}

.textarea:disabled {
  background: var(--surface-sunken);
}

.hasError {
  border-color: var(--status-danger);
}

.error {
  font-size: var(--text-body-sm-size);
  color: var(--status-danger);
}
```

Create `src/components/ui/Textarea.tsx`:

```tsx
import { useId } from "react";
import { cx } from "./cx";
import styles from "./Textarea.module.css";

export type TextareaProps = {
  label?: string;
  error?: string;
} & React.ComponentPropsWithRef<"textarea">;

/** className on the wrapper; rest props + ref on the <textarea> (same split as Input). */
export function Textarea({
  label,
  error,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const errorId = `${areaId}-error`;
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={areaId}>
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cx(styles.textarea, error && styles.hasError)}
        {...rest}
      />
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
```

Create `src/components/ui/Avatar.module.css`:

```css
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--green-100);
  color: var(--green-800);
  font-family: var(--font-sans);
  font-weight: 700;
  flex: none;
}
```

Create `src/components/ui/Avatar.tsx`:

```tsx
import { cx } from "./cx";
import { initialsOf } from "./initials";
import styles from "./Avatar.module.css";

export type AvatarProps = {
  name: string;
  size?: number;
} & React.ComponentPropsWithRef<"span">;

export function Avatar({
  name,
  size = 40,
  className,
  style,
  ...rest
}: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        ...style,
      }}
      {...rest}
    >
      {initialsOf(name)}
    </span>
  );
}
```

- [ ] **Step 4: Implement StatCard, EmptyState, Spinner**

Create `src/components/ui/StatCard.module.css`:

```css
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 6px;
}
```

Create `src/components/ui/StatCard.tsx`:

```tsx
import { Card } from "./Card";
import styles from "./StatCard.module.css";

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  /** Optional CSS color token for the value, e.g. "var(--status-warning)". */
  tone?: string;
  className?: string;
};

export function StatCard({ label, value, tone, className }: StatCardProps) {
  return (
    <Card className={className}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </Card>
  );
}
```

Create `src/components/ui/EmptyState.module.css`:

```css
.root {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-9) var(--space-6);
  font-family: var(--font-sans);
}

.iconWrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-sunken);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.title {
  font-size: var(--text-h3-size);
  font-weight: var(--text-h3-weight);
  color: var(--text-primary);
}

.description {
  font-size: var(--text-body-sm-size);
  color: var(--text-secondary);
  max-width: 36ch;
}

.action {
  margin-top: var(--space-3);
}
```

Create `src/components/ui/EmptyState.tsx`:

```tsx
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";
import styles from "./EmptyState.module.css";

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.root, className)}>
      <span className={styles.iconWrap}>
        <Icon name={icon} size={22} />
      </span>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.description}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
```

Create `src/components/ui/Spinner.module.css`:

```css
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ring {
  display: inline-block;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spinner-rotate 800ms linear infinite;
}

@keyframes spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
```

Create `src/components/ui/Spinner.tsx`:

```tsx
import { cx } from "./cx";
import styles from "./Spinner.module.css";

export type SpinnerProps = {
  size?: number;
  /** Screen-reader text. @default "Loading…" */
  label?: string;
  className?: string;
};

export function Spinner({
  size = 20,
  label = "Loading…",
  className,
}: SpinnerProps) {
  return (
    <span role="status" className={cx(styles.root, className)}>
      <span
        className={styles.ring}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/net-new.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Textarea.tsx src/components/ui/Textarea.module.css src/components/ui/Avatar.tsx src/components/ui/Avatar.module.css src/components/ui/StatCard.tsx src/components/ui/StatCard.module.css src/components/ui/EmptyState.tsx src/components/ui/EmptyState.module.css src/components/ui/Spinner.tsx src/components/ui/Spinner.module.css src/components/ui/net-new.test.tsx
git commit -m "feat: add Textarea, Avatar, StatCard, EmptyState, Spinner"
```

---

### Task 11: Toaster (context + portal + queue + auto-dismiss)

**Files:**
- Create: `src/components/ui/Toaster.tsx`, `src/components/ui/Toaster.module.css`
- Test: `src/components/ui/Toaster.test.tsx`

**Interfaces:**
- Consumes: `Toast`, `ToastTone` (Task 7).
- Produces (all from `@/components/ui/Toaster`, `'use client'`):
  - `type ToastInput = { title: string; description?: string; tone?: ToastTone }` (tone defaults to `"success"`).
  - `useToast(): { toast: (input: ToastInput) => void }` — throws with "useToast must be used inside <ToasterProvider>" when unwrapped. **This exact return shape (`{ toast }`) is the contract later phases call.**
  - `ToasterProvider({ children })` — wrap app layouts (Phase 2 does this for `/manager` and `/(employee)`; Task 14 wraps the gallery). Renders queued toasts bottom-right in a portal with `aria-live="polite"`.
  - `TOAST_DURATION_MS = 3500`, `TOAST_EXIT_MS = 280` — exported so tests never hardcode magic numbers.
  - Behavior: `toast()` appends to the queue; each toast auto-dismisses after 3.5 s by entering a `leaving` state (exit animation, 280 ms = `--duration-slow`) and is then removed; the Toast's Dismiss button triggers the same exit path early.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/Toaster.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  TOAST_DURATION_MS,
  TOAST_EXIT_MS,
  ToasterProvider,
  useToast,
} from "@/components/ui/Toaster";

function Trigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast({
          title: "Schedule published",
          description: "12 employees notified.",
          tone: "success",
        })
      }
    >
      Fire toast
    </button>
  );
}

describe("Toaster", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast when toast() is called", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    expect(screen.getByText("12 employees notified.")).toBeInTheDocument();
  });

  it("queues multiple toasts at once", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    expect(screen.getAllByText("Schedule published")).toHaveLength(2);
  });

  it("auto-dismisses after 3.5 s plus the exit animation", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // exit has begun; toast stays mounted for the animation
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Schedule published")).not.toBeInTheDocument();
  });

  it("dismisses early from the toast's Dismiss button", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Schedule published")).not.toBeInTheDocument();
  });

  it("throws a helpful error when useToast is used unwrapped", () => {
    function Naked() {
      useToast();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(
      "useToast must be used inside <ToasterProvider>"
    );
  });
});
```

(fireEvent, not userEvent: userEvent's delays fight fake timers; the click itself is not what is under test.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/Toaster.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Toaster"`.

- [ ] **Step 3: Implement Toaster**

Create `src/components/ui/Toaster.module.css`:

```css
.viewport {
  position: fixed;
  bottom: var(--space-7);
  right: var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  z-index: 200;
}

.item {
  animation: toast-in var(--duration-base) var(--ease-out);
}

.itemLeaving {
  animation: toast-out var(--duration-slow) var(--ease-out) forwards;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(8px);
  }
}
```

Create `src/components/ui/Toaster.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Toast, type ToastTone } from "./Toast";
import styles from "./Toaster.module.css";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type QueuedToast = ToastInput & { id: number; leaving: boolean };

type ToastContextValue = { toast: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export const TOAST_DURATION_MS = 3500;
/** Matches --duration-slow (the exit animation length). */
export const TOAST_EXIT_MS = 280;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToasterProvider>");
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const [mounted, setMounted] = useState(false); // portal target exists only client-side
  const nextId = useRef(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  const beginExit = useCallback((id: number) => {
    setToasts((ts) =>
      ts.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    window.setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts, { id, leaving: false, ...input }]);
      window.setTimeout(() => beginExit(id), TOAST_DURATION_MS);
    },
    [beginExit]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className={styles.viewport} aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={t.leaving ? styles.itemLeaving : styles.item}
              >
                <Toast
                  tone={t.tone ?? "success"}
                  title={t.title}
                  description={t.description}
                  onClose={() => beginExit(t.id)}
                />
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/Toaster.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Toaster.tsx src/components/ui/Toaster.module.css src/components/ui/Toaster.test.tsx
git commit -m "feat: add Toaster provider with queue and auto-dismiss"
```

---

### Task 12: Sheet (mobile bottom sheet)

**Files:**
- Create: `src/components/ui/Sheet.tsx`, `src/components/ui/Sheet.module.css`
- Test: `src/components/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: `cx`, `useModalBehavior` (Task 7).
- Produces: `Sheet` (`'use client'`) from `@/components/ui/Sheet` with a Dialog-identical API: `type SheetProps = { open: boolean; onClose?: () => void; title?: string; children?: React.ReactNode; footer?: React.ReactNode; className?: string }`. Bottom-anchored panel, max-width 480px, scrim `rgba(10, 20, 17, 0.4)` (`data-testid="sheet-scrim"`), top corners `var(--radius-xl)` (22px), slide-up 240ms `var(--ease-out)`. Same focus trap/Escape/scroll-lock as Dialog. Phase 4/5 employee flows open this on mobile where the manager app would use Dialog.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/Sheet.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "@/components/ui/Sheet";

describe("Sheet", () => {
  it("renders nothing when closed", () => {
    render(
      <Sheet open={false} title="Request swap">
        Body
      </Sheet>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a modal dialog with title and children when open", () => {
    render(
      <Sheet open title="Request swap">
        Who should cover this shift?
      </Sheet>
    );
    const sheet = screen.getByRole("dialog", { name: "Request swap" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet).toHaveTextContent("Who should cover this shift?");
  });

  it("closes on scrim click and on Escape, not on panel click", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Request swap">
        Body
      </Sheet>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("sheet-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus into the sheet on open", () => {
    render(
      <Sheet
        open
        title="Request swap"
        footer={<button type="button">Send request</button>}
      >
        Body
      </Sheet>
    );
    expect(
      screen.getByRole("button", { name: "Send request" })
    ).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/Sheet.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ui/Sheet"`.

- [ ] **Step 3: Implement Sheet**

Create `src/components/ui/Sheet.module.css`:

```css
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(10, 20, 17, 0.4);
  z-index: 100;
  font-family: var(--font-sans);
}

.panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0 auto;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--surface-card);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-lg);
  padding: var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: sheet-up 240ms var(--ease-out);
}

.panel:focus {
  outline: none;
}

.title {
  font-size: var(--text-h2-size);
  font-weight: var(--text-h2-weight);
  line-height: var(--text-h2-line);
  color: var(--text-primary);
}

.body {
  color: var(--text-primary);
  font-size: var(--text-body-size);
}

.footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

Create `src/components/ui/Sheet.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useModalBehavior } from "./use-modal-behavior";
import styles from "./Sheet.module.css";

export type SheetProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/** Mobile bottom sheet with Dialog's exact API and modal behavior. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(open, panelRef, onClose);

  if (!open) return null;

  return createPortal(
    <div className={styles.scrim} data-testid="sheet-scrim" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(styles.panel, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/Sheet.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/ui/Sheet.tsx src/components/ui/Sheet.module.css src/components/ui/Sheet.test.tsx
git commit -m "feat: add Sheet bottom-sheet with shared modal behavior"
```

---

### Task 13: Chrome — ManagerSidebar, EmployeeTabBar, EmployeeTopBar, DatePager

**Files:**
- Create: `src/components/chrome/ManagerSidebar.tsx`, `src/components/chrome/ManagerSidebar.module.css`
- Create: `src/components/chrome/EmployeeTabBar.tsx`, `src/components/chrome/EmployeeTabBar.module.css`
- Create: `src/components/chrome/EmployeeTopBar.tsx`, `src/components/chrome/EmployeeTopBar.module.css`
- Create: `src/components/chrome/DatePager.tsx`, `src/components/chrome/DatePager.module.css`
- Test: `src/components/chrome/chrome.test.tsx`

Export reference: `"/Users/gary/dev/RosterHouse/RosterHouse Design System/ui_kits/manager-web/Sidebar.jsx"` (onClick-div nav on `useState` tabs — becomes real `next/link` + `usePathname`), the `TopBar` function and bottom `TABS` bar in `"/Users/gary/dev/RosterHouse/RosterHouse Design System/ui_kits/employee-mobile/EmployeeApp.jsx"`, and the pager row in `".../ui_kits/manager-web/ScheduleView.jsx"` (ghost chevron buttons + centered period label + "Today").

Nav destinations are the roadmap route map. **The routes do not exist yet** — clicking a link in the gallery will 404 until Phases 2–5 build them; that is expected and fine for this phase.

**Interfaces:**
- Consumes: `cx`, `Icon`, `IconName`, `initialsOf`, `next/link`, `next/navigation` (`usePathname`), tokens.
- Produces (all from `@/components/chrome/...`):
  - `ManagerSidebar` (`'use client'`): `type ManagerSidebarProps = { locationName: string; userName: string }`. Fixed 232px left rail, brand green surface. Nav (exact hrefs, exact sentence-case labels, exact icons): Dashboard `/manager` `layout-dashboard` (exact match), Schedule `/manager/schedule` `calendar`, Team `/manager/team` `users`, Availability `/manager/availability` `calendar-check`, Time off `/manager/time-off` `clock`, Swaps & open shifts `/manager/swaps` `repeat` (prefix match for all non-dashboard items). Active item gets `aria-current="page"`. Location chip is static display (multi-location switching is out of scope). Phase 2 supplies the real `locationName`/`userName` from the session.
  - `EmployeeTabBar` (`'use client'`): `type EmployeeTabBarProps = { className?: string }`. Five links: Shifts `/shifts` `calendar` (active on `/shifts` or `/shifts/*`), Availability `/availability` `calendar-check`, Clock `/clock` `timer`, Open shifts `/swaps` `repeat`, Profile `/profile` `user`. Active link gets `aria-current="page"`.
  - `EmployeeTopBar` (server-safe): `type EmployeeTopBarProps = { title: string; backHref?: string; action?: React.ReactNode; className?: string }`. `backHref` renders a chevron-left link labelled "Back"; `action` is a right-side slot (Phase 4 puts the notification bell there).
  - `DatePager` (server-safe): `type DatePagerProps = { label: string; prevHref: string; nextHref: string; todayHref?: string; prevLabel?: string; nextLabel?: string; className?: string }`. Defaults `prevLabel="Previous"`, `nextLabel="Next"` (Phase 3 passes "Previous week" etc.). All controls are `next/link` anchors — paging is URL state per the roadmap (`?week=YYYY-MM-DD`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/chrome/chrome.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { EmployeeTopBar } from "@/components/chrome/EmployeeTopBar";
import { DatePager } from "@/components/chrome/DatePager";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

describe("ManagerSidebar", () => {
  it("renders all six nav items as real links", () => {
    pathnameMock.mockReturnValue("/manager");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    const expected: Array<[string, string]> = [
      ["Dashboard", "/manager"],
      ["Schedule", "/manager/schedule"],
      ["Team", "/manager/team"],
      ["Availability", "/manager/availability"],
      ["Time off", "/manager/time-off"],
      ["Swaps & open shifts", "/manager/swaps"],
    ];
    for (const [name, href] of expected) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("marks the current section with aria-current", () => {
    pathnameMock.mockReturnValue("/manager/schedule");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    expect(screen.getByRole("link", { name: "Schedule" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current");
  });

  it("shows location, user name, and user initials", () => {
    pathnameMock.mockReturnValue("/manager");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    expect(screen.getByText("Downtown")).toBeInTheDocument();
    expect(screen.getByText("Jamie Park")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });
});

describe("EmployeeTabBar", () => {
  it("renders five tab links and marks the active one", () => {
    pathnameMock.mockReturnValue("/clock");
    render(<EmployeeTabBar />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Clock/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("keeps Shifts active on a shift detail page", () => {
    pathnameMock.mockReturnValue("/shifts/abc123");
    render(<EmployeeTabBar />);
    expect(screen.getByRole("link", { name: /Shifts/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

describe("EmployeeTopBar", () => {
  it("renders the title as a heading and an optional back link", () => {
    render(<EmployeeTopBar title="Shift detail" backHref="/shifts" />);
    expect(
      screen.getByRole("heading", { name: "Shift detail" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/shifts"
    );
  });

  it("renders the action slot", () => {
    render(
      <EmployeeTopBar
        title="Hi, Maria"
        action={<button type="button">Notifications</button>}
      />
    );
    expect(
      screen.getByRole("button", { name: "Notifications" })
    ).toBeInTheDocument();
  });
});

describe("DatePager", () => {
  it("renders prev/next/today as links around the label", () => {
    render(
      <DatePager
        label="Jul 6 – Jul 12"
        prevHref="/manager/schedule?week=2026-06-29"
        nextHref="/manager/schedule?week=2026-07-13"
        todayHref="/manager/schedule"
        prevLabel="Previous week"
        nextLabel="Next week"
      />
    );
    expect(screen.getByText("Jul 6 – Jul 12")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous week" })
    ).toHaveAttribute("href", "/manager/schedule?week=2026-06-29");
    expect(screen.getByRole("link", { name: "Next week" })).toHaveAttribute(
      "href",
      "/manager/schedule?week=2026-07-13"
    );
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/manager/schedule"
    );
  });

  it("omits Today when no todayHref is given", () => {
    render(<DatePager label="Jul 6 – Jul 12" prevHref="/a" nextHref="/b" />);
    expect(screen.queryByRole("link", { name: "Today" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/chrome/chrome.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/chrome/ManagerSidebar"`.

- [ ] **Step 3: Implement ManagerSidebar**

Create `src/components/chrome/ManagerSidebar.module.css`:

```css
.sidebar {
  width: 232px;
  flex: none;
  min-height: 100dvh;
  background: var(--surface-brand);
  color: var(--text-inverse);
  display: flex;
  flex-direction: column;
  padding: var(--space-6) var(--space-5);
  gap: var(--space-8);
  font-family: var(--font-sans);
}

.brand {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.location {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.08);
  font-size: 13px;
  font-weight: 600;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.navItem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  color: inherit;
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-out);
}

.navItem:hover {
  background: rgba(255, 255, 255, 0.08);
}

.navItem:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.navItemActive {
  background: rgba(255, 255, 255, 0.14);
}

.user {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
}

.userAvatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}
```

Create `src/components/chrome/ManagerSidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { initialsOf } from "@/components/ui/initials";
import styles from "./ManagerSidebar.module.css";

const NAV: Array<{
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}> = [
  { href: "/manager", label: "Dashboard", icon: "layout-dashboard", exact: true },
  { href: "/manager/schedule", label: "Schedule", icon: "calendar" },
  { href: "/manager/team", label: "Team", icon: "users" },
  { href: "/manager/availability", label: "Availability", icon: "calendar-check" },
  { href: "/manager/time-off", label: "Time off", icon: "clock" },
  { href: "/manager/swaps", label: "Swaps & open shifts", icon: "repeat" },
];

export type ManagerSidebarProps = {
  locationName: string;
  userName: string;
};

export function ManagerSidebar({ locationName, userName }: ManagerSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>RosterHouse</div>
      <div className={styles.location}>
        <Icon name="map-pin" size={14} />
        <span>{locationName}</span>
      </div>
      <nav className={styles.nav} aria-label="Manager">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(styles.navItem, active && styles.navItemActive)}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.user}>
        <span className={styles.userAvatar} aria-hidden="true">
          {initialsOf(userName)}
        </span>
        <span>{userName}</span>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Implement EmployeeTabBar**

Create `src/components/chrome/EmployeeTabBar.module.css`:

```css
.bar {
  display: flex;
  border-top: 1px solid var(--border-default);
  background: var(--surface-card);
  padding: 8px 4px 14px;
  font-family: var(--font-sans);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 10.5px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  padding: 4px 0;
}

.tab:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.tabActive {
  color: var(--text-brand);
}
```

Create `src/components/chrome/EmployeeTabBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import styles from "./EmployeeTabBar.module.css";

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/shifts", label: "Shifts", icon: "calendar" },
  { href: "/availability", label: "Availability", icon: "calendar-check" },
  { href: "/clock", label: "Clock", icon: "timer" },
  { href: "/swaps", label: "Open shifts", icon: "repeat" },
  { href: "/profile", label: "Profile", icon: "user" },
];

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type EmployeeTabBarProps = { className?: string };

export function EmployeeTabBar({ className }: EmployeeTabBarProps) {
  const pathname = usePathname();
  return (
    <nav className={cx(styles.bar, className)} aria-label="Employee">
      {TABS.map((t) => {
        const active = isActive(t.href, pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(styles.tab, active && styles.tabActive)}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={t.icon} size={19} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Implement EmployeeTopBar and DatePager**

Create `src/components/chrome/EmployeeTopBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 8px;
  font-family: var(--font-sans);
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back {
  display: inline-flex;
  color: var(--text-primary);
  border-radius: var(--radius-sm);
}

.back:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.title {
  font-size: var(--text-h1-size);
  font-weight: var(--text-h1-weight);
  line-height: var(--text-h1-line);
  color: var(--text-primary);
}

.action {
  display: flex;
  align-items: center;
}
```

Create `src/components/chrome/EmployeeTopBar.tsx`:

```tsx
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import styles from "./EmployeeTopBar.module.css";

export type EmployeeTopBarProps = {
  title: string;
  backHref?: string;
  /** Right-side slot; Phase 4 places the notification bell here. */
  action?: React.ReactNode;
  className?: string;
};

export function EmployeeTopBar({
  title,
  backHref,
  action,
  className,
}: EmployeeTopBarProps) {
  return (
    <header className={cx(styles.bar, className)}>
      <div className={styles.left}>
        {backHref && (
          <Link href={backHref} className={styles.back} aria-label="Back">
            <Icon name="chevron-left" size={22} />
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  );
}
```

Create `src/components/chrome/DatePager.module.css`:

```css
.pager {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
}

.arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: var(--radius-sm);
  color: var(--text-brand);
  transition: background var(--duration-base) var(--ease-out);
}

.arrow:hover {
  background: var(--surface-brand-soft);
}

.arrow:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.label {
  font-weight: 700;
  font-size: 16px;
  color: var(--text-primary);
  min-width: 190px;
  text-align: center;
}

.today {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  margin-left: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-brand);
  background: var(--surface-card);
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  transition:
    background var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.today:hover {
  background: var(--surface-brand-soft);
  border-color: var(--border-brand);
}

.today:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

Create `src/components/chrome/DatePager.tsx`:

```tsx
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import styles from "./DatePager.module.css";

export type DatePagerProps = {
  /** Preformatted period label, e.g. "Jul 6 – Jul 12" (en dash). */
  label: string;
  prevHref: string;
  nextHref: string;
  todayHref?: string;
  /** @default "Previous" — pass e.g. "Previous week" per view. */
  prevLabel?: string;
  /** @default "Next" */
  nextLabel?: string;
  className?: string;
};

/** URL-state pager: all three controls are links, so paging survives reloads. */
export function DatePager({
  label,
  prevHref,
  nextHref,
  todayHref,
  prevLabel = "Previous",
  nextLabel = "Next",
  className,
}: DatePagerProps) {
  return (
    <div className={cx(styles.pager, className)}>
      <Link href={prevHref} className={styles.arrow} aria-label={prevLabel}>
        <Icon name="chevron-left" size={16} />
      </Link>
      <span className={styles.label}>{label}</span>
      <Link href={nextHref} className={styles.arrow} aria-label={nextLabel}>
        <Icon name="chevron-right" size={16} />
      </Link>
      {todayHref && (
        <Link href={todayHref} className={styles.today}>
          Today
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/chrome/chrome.test.tsx`
Expected: PASS — 9 tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/components/chrome
git commit -m "feat: add nav chrome with real links and active states"
```

---

### Task 14: `/design-system` gallery route

**Files:**
- Create: `src/app/design-system/page.tsx`

**Interfaces:**
- Consumes: every component from Tasks 2–13 (exact imports in the code below).
- Produces: the route `/design-system` — this phase's manual QA surface and every later phase's visual reference. Renders every primitive in every state (all Button variants/sizes/disabled, Input default/error/disabled/icon, all Badge tones, all four Toast tones static plus live Toaster triggers, Dialog and Sheet open/close, all ShiftBlock statuses, WeekGridCell empty/filled/conflict, all AvatarStatus dots, TimeField live validation, EmptyState + Spinner as the canonical loading/empty blocks, and all four chrome components). No layout file needed — the root layout already applies tokens and Figtree.

- [ ] **Step 1: Implement the gallery page**

The page is `'use client'` (it demos interactive state); tab-bar/sidebar links will 404 until later phases build those routes — expected. Create `src/app/design-system/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStatus } from "@/components/ui/AvatarStatus";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { TimeField } from "@/components/ui/TimeField";
import { Toast } from "@/components/ui/Toast";
import { ToasterProvider, useToast } from "@/components/ui/Toaster";
import { Tooltip } from "@/components/ui/Tooltip";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import { DatePager } from "@/components/chrome/DatePager";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { EmployeeTopBar } from "@/components/chrome/EmployeeTopBar";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <h2
        style={{
          fontSize: "var(--text-h2-size)",
          fontWeight: "var(--text-h2-weight)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-5)",
      }}
    >
      {children}
    </div>
  );
}

const POSITIONS = [
  { value: "line-cook", label: "Line cook" },
  { value: "server", label: "Server" },
  { value: "dishwasher", label: "Dishwasher" },
  { value: "host", label: "Host" },
];

function ButtonsSection() {
  return (
    <Section title="Buttons">
      <Row>
        <Button>Publish schedule</Button>
        <Button variant="secondary">Save draft</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="accent">Claim shift</Button>
        <Button variant="danger">Delete shift</Button>
        <Button disabled>Publish schedule</Button>
      </Row>
      <Row>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button icon={<Icon name="plus" size={16} />}>Add shift</Button>
      </Row>
      <div style={{ maxWidth: 360 }}>
        <Button fullWidth size="lg">
          Log in
        </Button>
      </div>
    </Section>
  );
}

function FormsSection() {
  const [checked, setChecked] = useState(true);
  const [smsOn, setSmsOn] = useState(true);
  const [position, setPosition] = useState("");
  const [note, setNote] = useState("");
  return (
    <Section title="Form fields">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-5)",
          maxWidth: 800,
        }}
      >
        <Input label="Phone or email" placeholder="maria@example.com" />
        <Input
          label="Password"
          type="password"
          error="Enter at least 8 characters"
        />
        <Input label="Disabled" disabled placeholder="Not editable" />
        <Input
          label="With icon"
          icon={<Icon name="clock" size={16} />}
          placeholder="7:00 AM"
        />
        <Select
          label="Position"
          placeholder="Choose a position"
          options={POSITIONS}
          value={position}
          onChange={setPosition}
        />
        <Textarea
          label="Shift notes"
          placeholder="Bring your own knife kit."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Row>
        <Checkbox
          label="Line cook"
          checked={checked}
          onChange={setChecked}
        />
        <Checkbox label="Disabled" disabled />
        <Switch
          label="Text message alerts"
          checked={smsOn}
          onChange={setSmsOn}
        />
        <Switch label="Disabled" disabled />
      </Row>
    </Section>
  );
}

function TimeFieldSection() {
  const [start, setStart] = useState("");
  return (
    <Section title="Time field">
      <div style={{ maxWidth: 280 }}>
        <TimeField label="Start time" value={start} onChange={setStart} />
      </div>
      <p style={{ fontSize: "var(--text-body-sm-size)", color: "var(--text-secondary)" }}>
        Try "7:00 AM" (valid) and "25:00" (invalid, error appears after you
        leave the field).
      </p>
    </Section>
  );
}

function FeedbackSection() {
  return (
    <Section title="Badges, tags, tooltip">
      <Row>
        <Badge tone="success">Confirmed</Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="danger">Conflict</Badge>
        <Badge tone="info">Draft</Badge>
        <Badge tone="neutral">Off</Badge>
      </Row>
      <Row>
        <Tag>Line cook</Tag>
        <Tag color="brand">Server</Tag>
        <Tag color="accent">Host</Tag>
        <Tag onRemove={() => {}}>Removable</Tag>
      </Row>
      <Row>
        <Tooltip label="Add shift">
          <Button variant="secondary" size="sm" aria-label="Add shift">
            <Icon name="plus" size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="Shown below" side="bottom">
          <Button variant="ghost" size="sm">
            Hover or focus me
          </Button>
        </Tooltip>
      </Row>
    </Section>
  );
}

function ToastSection() {
  const { toast } = useToast();
  return (
    <Section title="Toasts">
      <Row>
        <Toast
          tone="success"
          title="Schedule published"
          description="12 employees notified."
        />
        <Toast
          tone="warning"
          title="Shift unassigned"
          description="Saturday 4:00 PM – 10:00 PM has no server."
        />
      </Row>
      <Row>
        <Toast
          tone="danger"
          title="Could not save shift"
          description="This shift overlaps with Maria's 2:00 PM – 6:00 PM shift."
          onClose={() => {}}
        />
        <Toast
          tone="info"
          title="Reminder"
          description="Your Line cook shift starts at 7:00 AM tomorrow."
        />
      </Row>
      <Row>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: "Schedule published",
              description: "12 employees notified.",
              tone: "success",
            })
          }
        >
          Fire success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: "Could not save shift",
              description:
                "This shift overlaps with Maria's 2:00 PM – 6:00 PM shift.",
              tone: "danger",
            })
          }
        >
          Fire danger toast
        </Button>
      </Row>
    </Section>
  );
}

function DialogSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <Section title="Dialog and sheet">
      <Row>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open sheet
        </Button>
      </Row>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Publish schedule"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Publish</Button>
          </>
        }
      >
        This will notify 12 employees about their shifts for Jul 6 – Jul 12.
      </Dialog>
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Request swap"
        footer={
          <Button fullWidth onClick={() => setSheetOpen(false)}>
            Send request
          </Button>
        }
      >
        Anyone qualified can pick up this shift once your manager approves.
      </Sheet>
    </Section>
  );
}

function TabsSection() {
  const [view, setView] = useState("week");
  return (
    <Section title="Tabs">
      <Tabs
        tabs={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        value={view}
        onChange={setView}
      />
    </Section>
  );
}

function SchedulingSection() {
  return (
    <Section title="Scheduling">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
          gap: "var(--space-4)",
          maxWidth: 760,
        }}
      >
        <ShiftBlock
          role="Line cook"
          time="7:00 AM – 3:00 PM"
          employeeName="Maria Garcia"
          status="confirmed"
          onClick={() => {}}
        />
        <ShiftBlock role="Server" time="4:00 PM – 10:00 PM" status="open" />
        <ShiftBlock
          role="Server"
          time="2:00 PM – 6:00 PM"
          employeeName="Sam Torres"
          status="conflict"
          conflictReason="Overlaps with Sam's 4:00 PM – 10:00 PM shift"
        />
        <ShiftBlock
          role="Dishwasher"
          time="6:00 PM – 12:00 AM"
          employeeName="Alex Kim"
          status="draft"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 160px)",
          gap: "var(--space-4)",
        }}
      >
        <WeekGridCell empty onClick={() => {}} />
        <WeekGridCell>
          <ShiftBlock
            role="Host"
            time="11:00 AM – 5:00 PM"
            employeeName="Priya Shah"
            compact
          />
        </WeekGridCell>
        <WeekGridCell hasConflict>
          <ShiftBlock
            role="Server"
            time="2:00 PM – 6:00 PM"
            employeeName="Sam Torres"
            status="conflict"
            compact
            conflictReason="Double-booked"
          />
        </WeekGridCell>
      </div>
      <Row>
        <AvatarStatus name="Maria Garcia" status="available" />
        <AvatarStatus name="Sam Torres" status="unavailable" />
        <AvatarStatus name="Priya Shah" status="pending" />
        <AvatarStatus name="Alex Kim" status="off" />
        <Avatar name="Jamie Park" />
        <ConflictChip>
          This shift overlaps with Maria's 2:00 PM – 6:00 PM shift
        </ConflictChip>
      </Row>
    </Section>
  );
}

function StatesSection() {
  return (
    <Section title="Loading, empty, and stat blocks">
      <Row>
        <Spinner />
        <Spinner size={32} label="Publishing schedule…" />
      </Row>
      <Card padding="0" style={{ maxWidth: 420 }}>
        <EmptyState
          title="No shifts this week"
          description="Add a shift to get started."
          action={
            <Button size="sm" icon={<Icon name="plus" size={14} />}>
              Add shift
            </Button>
          }
        />
      </Card>
      <div style={{ display: "flex", gap: "var(--space-4)", maxWidth: 760 }}>
        <StatCard
          label="Coverage gaps this week"
          value="2"
          tone="var(--status-warning)"
        />
        <StatCard label="Pending requests" value="3" />
        <StatCard
          label="Clocked in now"
          value="4"
          tone="var(--status-success)"
        />
      </div>
    </Section>
  );
}

function ChromeSection() {
  return (
    <Section title="Chrome">
      <p style={{ fontSize: "var(--text-body-sm-size)", color: "var(--text-secondary)" }}>
        Links point at real routes that later phases build; a 404 on click is
        expected for now.
      </p>
      <div
        style={{
          height: 480,
          width: 232,
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <ManagerSidebar locationName="Downtown" userName="Jamie Park" />
      </div>
      <div
        style={{
          width: 390,
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <EmployeeTopBar
          title="Hi, Maria"
          action={
            <Button variant="ghost" size="sm" aria-label="Notifications">
              <Icon name="bell" size={20} />
            </Button>
          }
        />
        <EmployeeTopBar title="Shift detail" backHref="/design-system" />
        <EmployeeTabBar />
      </div>
      <DatePager
        label="Jul 6 – Jul 12"
        prevHref="/design-system?week=prev"
        nextHref="/design-system?week=next"
        todayHref="/design-system"
        prevLabel="Previous week"
        nextLabel="Next week"
      />
    </Section>
  );
}

export default function DesignSystemPage() {
  return (
    <ToasterProvider>
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "var(--space-8) var(--space-6) var(--space-12)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-10)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-h1-size)",
              fontWeight: "var(--text-h1-weight)",
            }}
          >
            Design system
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Every primitive in every state. This page is the manual QA surface
            for Phase 1.
          </p>
        </div>
        <ButtonsSection />
        <FormsSection />
        <TimeFieldSection />
        <FeedbackSection />
        <ToastSection />
        <DialogSection />
        <TabsSection />
        <SchedulingSection />
        <StatesSection />
        <ChromeSection />
      </main>
    </ToasterProvider>
  );
}
```

- [ ] **Step 2: Verify the build and full test suite**

Run: `npm run build`
Expected: exits 0, `/design-system` listed in the route summary.

Run: `npx vitest run`
Expected: all test files pass (harness + Icon + cx + Button + forms + select-tabs + feedback + Toast + Dialog + scheduling + time-field-parse + TimeField + net-new + Toaster + Sheet + chrome).

- [ ] **Step 3: Eyeball the gallery**

```bash
cd /Users/gary/dev/RosterHouse
npm run dev
```

Open `http://localhost:3000/design-system` and check against the checklist in "Phase verification" below (or run the `/qa` skill against it). Stop the dev server afterwards.

- [ ] **Step 4: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add src/app/design-system
git commit -m "feat: add /design-system gallery route"
```

---

### Task 15: Lint guardrails (no raw hex, Figtree only)

**Files:**
- Modify: `eslint.config.mjs`
- Test: `src/styles/design-guardrails.test.ts`

The export ships an adherence oxlint config (`"/Users/gary/dev/RosterHouse/RosterHouse Design System/_adherence.oxlintrc.json"`) that bans raw hex colors and non-Figtree font families. This task ports that intent to the repo's ESLint (covers `.ts`/`.tsx`, including inline styles) **plus** a vitest guard test (covers `.css`/`.module.css`, which ESLint does not parse). Token definition files are exempt — they are where the hex values legitimately live.

**Interfaces:**
- Consumes: the vitest harness (Task 1); all component CSS written in Tasks 3–14 must already comply (they do if written as specified — the only raw colors in them are the two designed `rgba()` scrim/white-alpha values, and only hex is banned).
- Produces: `npm run lint` fails on any string literal or template containing a hex color in `src/**/*.{ts,tsx}` (except `src/generated/**`), and on any `fontFamily` style property not using `var(--font-sans)`/`var(--font-mono)`; `npx vitest run src/styles/design-guardrails.test.ts` fails on hex colors or non-token `font-family` declarations in any CSS file under `src/app/**` or `src/components/**`. Later phases inherit both guards automatically.

- [ ] **Step 1: Write the failing CSS guard test**

Create `src/styles/design-guardrails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Token files (src/styles/tokens/**) are exempt: hex lives there by design.
// process.cwd() is the repo root when vitest runs (no __dirname in ESM).
const CSS_ROOTS = [
  path.resolve(process.cwd(), "src/app"),
  path.resolve(process.cwd(), "src/components"),
];

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
// font-family declarations must reference the token variables
const BAD_FONT_FAMILY = /font-family\s*:(?![^;]*var\(--font-(?:sans|mono)\))/;

function cssFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...cssFilesUnder(full));
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

describe("design guardrails (CSS)", () => {
  const files = CSS_ROOTS.flatMap(cssFilesUnder);

  it("finds css files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("uses no raw hex colors outside the token files", () => {
    const offenders = files.filter((f) =>
      HEX_COLOR.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("sets font-family only via the design token variables", () => {
    const offenders = files.filter((f) =>
      BAD_FONT_FAMILY.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard test**

Run: `npx vitest run src/styles/design-guardrails.test.ts`
Expected: PASS if Tasks 3–14 were written as specified (the test "fails first" in the useful sense: it fails whenever anyone reintroduces hex — verify that in Step 5). If it FAILS now, the listed offender files contain raw hex or a non-token font-family: fix them to use tokens, do not weaken the test.

- [ ] **Step 3: Add the ESLint rules**

Replace the entire contents of `eslint.config.mjs` with:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client:
    "src/generated/**",
  ]),
  {
    // Design-token adherence (ported from the export's _adherence.oxlintrc.json):
    // no raw hex colors, no non-Figtree font families in app code.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Raw hex color — use a design token via var(--...) instead.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Raw hex color — use a design token via var(--...) instead.",
        },
        {
          selector:
            "Property[key.name='fontFamily'] > Literal[value!=/var\\(--font-(sans|mono)\\)/]",
          message:
            "Font not provided by the design system. Use var(--font-sans) (Figtree) or var(--font-mono).",
        },
      ],
    },
  },
]);

export default eslintConfig;
```

- [ ] **Step 4: Verify lint passes on the clean tree**

Run: `npm run lint`
Expected: exits 0 (warnings acceptable, no errors).

- [ ] **Step 5: Prove both guards actually catch violations (canary)**

```bash
cd /Users/gary/dev/RosterHouse
cat > src/components/ui/lint-canary.tsx << 'EOF'
export const bad = { color: "#12312B", fontFamily: "Comic Sans MS" };
EOF
npm run lint
```

Expected: lint FAILS on `src/components/ui/lint-canary.tsx` with both messages — "Raw hex color — use a design token via var(--...) instead." (the `#12312B` literal) and "Font not provided by the design system." (the `fontFamily` property).

```bash
cat > src/components/ui/lint-canary.module.css << 'EOF'
.bad { color: #ff0000; font-family: Arial; }
EOF
npx vitest run src/styles/design-guardrails.test.ts
```

Expected: FAIL — both guard assertions list `lint-canary.module.css` as an offender.

```bash
rm src/components/ui/lint-canary.tsx src/components/ui/lint-canary.module.css
npm run lint && npx vitest run src/styles/design-guardrails.test.ts
```

Expected: both PASS again.

- [ ] **Step 6: Run the full suite one last time**

Run: `npx vitest run && npm run build && npm run lint`
Expected: everything green, exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/gary/dev/RosterHouse
git add eslint.config.mjs src/styles/design-guardrails.test.ts
git commit -m "chore: add design-token lint guardrails (no hex, Figtree only)"
```

---

## Phase verification (roadmap gate)

Run after Task 15, before calling the phase done:

1. `npm run build` — exits 0, `/design-system` in the route list.
2. `npx vitest run` — all suites green.
3. `npm run lint` — no errors.
4. `git log --oneline` — one commit per task (15 commits for this phase), working tree clean (`git status`).
5. Manual QA on `http://localhost:3000/design-system` (`npm run dev`, or the `/qa` skill). Checklist:
   - Buttons: five variants render distinctly; hover darkens (CSS, no flicker); press nudges down 1px; disabled is half-opacity and inert; keyboard focus shows the green ring (`--shadow-focus`) on every control on the page — Tab through the whole page.
   - Inputs: focused field gets brand border + ring; error field shows red border + specific message; disabled is sunken.
   - Select: opens with keyboard (Enter/Space/arrows), placeholder is muted, chevron doesn't intercept clicks.
   - TimeField: type `25:00`, click away — "Enter a time like 7:00 AM" appears; correct it to `7:00 AM` — error clears while typing.
   - Toasts: static row shows four different tone icons (check / triangle / x / bell); "Fire success toast" slides a toast in bottom-right, which auto-dismisses ~3.5 s later with a fade-down; Dismiss removes it early.
   - Dialog: opens centered with scrim; Tab cycles inside only; Escape and scrim click close it; focus returns to the "Open dialog" button.
   - Sheet: slides up from the bottom with 22px top corners; same close behaviors.
   - Scheduling: four ShiftBlock statuses match the export palette; conflict block shows reason with icon; empty WeekGridCell is a focusable + button; conflict cell has dashed red border; AvatarStatus dots show four colors.
   - Chrome: sidebar renders six links (no active item on this route — expected); tab bar shows five labelled links; DatePager arrows + Today are links; clicking chrome links 404s (routes come in later phases — expected).
   - No horizontal scrollbar on the page; everything renders in Figtree.
6. Railway deploy check per roadmap (config already exists): deploy and confirm `/api/health` and `/design-system` respond.

## Deviations and additions vs the roadmap (for the record)

- `parseTime12h` ships as a local copy in `src/components/ui/time-field-parse.ts` (roadmap places it in Phase 3's `src/lib/time.ts`); Phase 3 must move it and re-export from the old path. Signature is identical.
- `useToast()` returns `{ toast }` (roadmap left the shape open).
- New contract not in the roadmap: `WeekGridCell` gains `addLabel?: string` (default "Add shift"); `EmployeeTopBar` API is `{ title, backHref?, action? }`; `DatePager` API is `{ label, prevHref, nextHref, todayHref?, prevLabel?, nextLabel? }`; `ManagerSidebar` API is `{ locationName, userName }`; helpers `cx()`, `initialsOf()`, `useModalBehavior()`; constants `TOAST_DURATION_MS`/`TOAST_EXIT_MS`.
- `ShiftBlock` deliberately does NOT spread rest props/ref (its `role` prop shadows the ARIA attribute); it accepts `className` only. All other ported primitives follow the full className + rest + ref contract (Input/Select/Textarea route rest+ref to the inner control, className to the wrapper).
- Icon set includes `play` and `square` (used by the export's time-clock toggle, found via grep) on top of the roadmap's list.
