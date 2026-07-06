# Design-export review — findings

**Date:** 2026-07-05 · **Method:** 7-agent review (manager kit, employee
kit, components, tokens/infra, gap analysis, data model, completeness
critic) over `RosterHouse Design System/`. Raw structured output:
`docs/superpowers/review/design-review-raw.json`.

## Verdict

The export is a faithful, well-tokenized visual spec — every readme-claimed
screen exists, the token system is clean, and the 16 primitives cover most
needs. But it is a **click-through, not an app**: navigation is `useState`
tab switching, all data is hardcoded (and mutually inconsistent across the
two kits), and several buttons that anchor core flows have no `onClick` at
all. Four gaps are blockers that need net-new UI before the MVP loop can
function.

## Blockers (MVP loop cannot work)

1. **No manager auth or tenant bootstrap.** Zero login/signup screens in
   the manager kit; no org/location/role creation anywhere. Neither user
   population can enter the product.
2. **Team management is read-only.** No invite/add-employee affordance,
   yet the employee kit's Accept-invite screen presupposes an invite was
   sent. The onboarding handoff cannot start.
3. **Conflict detection has no trigger.** Conflicts exist only as seeded
   demo data. `saveShift` never computes them; the assign dialog never
   warns. The MVP's flagship promise has display components (ConflictChip,
   conflict cell styling) but no designed moment of appearance.
4. **Swap creation is entirely missing.** Both employee "Request swap"
   buttons are dead; the manager approval screen is unreachable in
   practice.

## Major gaps (flows dead-end or mislead)

- **Publish model is global + inconsistent:** publishing flips *all* drafts
  across *all* weeks; single app-wide published flag; confirm dialog says
  "5 employees will be notified", toast says "10", the uploaded mockup
  image says "12". Needs per-week publish, republish-after-edit, real
  counts.
- **Dead controls:** header "Add shift" (no handler), time-off
  Approve/Deny (no handlers), swap Approve and Deny call the same
  `decide()` — indistinguishable outcomes, no downstream mutation.
- **Free-text time entry** ("7:00 AM") with zero validation on the
  product's primary data-entry surface; shift identity is display strings
  like `'Server|Mon 6'` split on an en-dash.
- **Availability is lossy end-to-end:** employee advanced per-day hour
  windows → manager overview renders booleans only; no Save affordance on
  the employee screen; availability never surfaces inside the assign
  dialog where it matters; overview lists 5 of the 10 team members.
- **Open-shift claim feedback misleads:** "Claim" flips to "Claimed"
  locally implying success, while the manager side says claims await
  approval. No pending/approved/denied surface for the employee.
- **Time clock is a stateless toggle:** no link to the scheduled shift, no
  timesheet on either app, no geofence-failure or permission-denied
  states despite copy promising location verification.
- **No notification content or delivery design:** no SMS templates, no
  push payloads, no phone verification (TCPA consent also missing), cards
  not tappable, no unread badge wiring.
- **Wage/labor-cost stat has no input surface** ($4,120 projected labor
  cost implies wages nobody can enter).
- **Empty/loading/error states almost entirely absent** (2 empty states
  exist in the whole export); no 404/500; manager web has no responsive
  design (fixed 232px rail, 1440px target).

## Things the critic caught that the readers missed

- **Employees work multiple positions** in the export's own demo data
  (a Server and a Host take Dishwasher shifts; a Host claims a Dishwasher
  open shift), so a single `positionId` FK can't represent reality →
  many-to-many qualification model required (adopted in schema).
- **"Coverage gaps" is uncomputable** — no staffing-targets concept
  anywhere. v1 redefines it as open-shift count (decision #7 in spec).
- **iOS web push requires an installed PWA** (manifest + service worker +
  home-screen install) — none planned anywhere; for an hourly-workforce
  audience SMS is the realistic primary channel.
- **Location has no coordinates/geofence radius** despite promised on-site
  clock-in verification (fields added to schema).
- **Managers can't author the shift notes employees see** — the assign
  dialog has no notes field (added to plan).
- **Overtime conflicts have no threshold config** (per-location default
  40h added to schema, nullable to disable).
- **Cross-kit mock data is contradictory** (Jul 12/13 day-of-week errors,
  a swap referencing a nonexistent shift, three different notified
  counts) → seed data must be authored fresh, not translated.

## Component/porting facts that shape the plan

- 16 primitives are `.jsx` + hand-written `.d.ts`; port to typed `.tsx`.
  The `.d.ts` files use `JSX.Element` (broken under React 19 types).
- 13/16 need `'use client'` only because hover/press is done in JS
  `useState` — moving to CSS `:hover/:active` (which the design guidelines
  themselves specify) makes most primitives server-safe.
- No primitive forwards refs, spreads rest props, or accepts `className`;
  the kits already hit these limits (Button drops `style`, `onClick` on
  divs inside Card). Port opens these APIs.
- Missing primitives the kits hand-roll: Toaster (provider/queue), Textarea,
  Sheet/bottom-sheet, TimeField, plain Avatar, StatCard, Icon wrapper, nav
  chrome (Sidebar/TopBar/tab bar), date-pager. Icons via pinned
  `lucide-react` (~21 icons actually used — grep `data-lucide` dynamic
  usages too: `layout-dashboard`, `calendar-check`, `timer`).
- Accessibility is the dominant defect class: interactive divs everywhere,
  no focus styles, dialogs without focus traps, color-only status dots.
  The wiring pass builds primitives on proper semantics.
- Adherence lint worth carrying over: ban raw hex colors and non-Figtree
  font-families in app code (the export ships an oxlint config).
- Do **not** port: `styles.css` aggregator, `fonts.css` (CDN), UMD/Babel
  demo shells, `_ds_bundle.js`, `window.__rh*` globals, `createIcons()`
  pattern, the `ANCHOR = new Date(2026, 6, 6)` demo-date model.

## Minor (tracked, not scheduled)

Shift-status vocabulary lacks swap-pending/covered states; AvatarStatus
dots lack a legend; publish confirmation is toast-only (no history);
password-only login despite phone-first field (OTP later); no TOS/SMS
consent at invite acceptance; no location address/map for employees;
month-view day keys collide across months.
