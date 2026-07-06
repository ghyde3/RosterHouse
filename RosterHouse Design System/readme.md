# RosterHouse Design System

RosterHouse is a shift-management platform for hourly, blue-collar-first
teams — restaurants, retail, warehouses. The MVP loop: employees set
availability → a manager drags shifts onto a week grid with conflict
warnings → the manager publishes → staff get pushed/texted their schedule →
employees view it on mobile.

**Sources.** No Figma file, codebase, or existing brand assets were attached
for this run — this design system was built from scratch from a written
product/feature spec (shift-management app breakdown covering MVP, phase 2,
and phase 3 features) and a short design-direction Q&A with the user
(products to cover, brand personality, color direction, type direction, icon
system). There is no existing RosterHouse visual identity to source from; if
one exists, attach it (Figma link, repo, brand guide) and this system should
be rebuilt against it rather than kept as-is.

## Products covered

1. **Manager web app** — schedule builder, week-grid calendar, shift
   assignment, conflict warnings, publish/draft state.
2. **Employee mobile app** — upcoming shifts, availability, shift swap/open
   shift requests, notifications.

(Marketing site was not selected for this pass.)

## Index

- `styles.css` — root stylesheet, `@import`s everything below. Link this one
  file to use the system.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`
  (radius/shadow/motion), `fonts.css` (webfont loading).
- `components/` — reusable React primitives, grouped by concern:
  - `components/forms/` — Button, Input, Select, Checkbox, Switch
  - `components/feedback/` — Badge, Tag, Toast, Tooltip
  - `components/containers/` — Card, Dialog, Tabs
  - `components/scheduling/` — ShiftBlock, WeekGridCell, AvatarStatus,
    ConflictChip (domain primitives — intentional additions, see below)
- `ui_kits/manager-web/` — Dashboard, Schedule Builder (week grid), Team, Availability overview, Time-off approvals, Swap/open-shift approvals (click-through)
- `ui_kits/employee-mobile/` — Login, Accept invite, My Shifts + Shift detail, Availability, Time Clock, Open Shifts/Swap, Notifications, Profile (click-through)
- `guidelines/` — foundation specimen cards for the Design System tab
- `assets/icons/` — Lucide icon set (SVG)
- `SKILL.md` — portable skill wrapper for use in Claude Code

## Intentional additions

No component source was attached, so the **standard set** (Button, Input,
Select, Checkbox, Switch, Card, Badge, Tag, Tabs, Dialog, Toast, Tooltip) was
authored fresh, sized to a shift-scheduling app. On top of that, four
**scheduling-domain primitives** were added because the product can't be
represented without them:
- `ShiftBlock` — a scheduled shift as it appears on the week grid.
- `WeekGridCell` — a single day/time cell in the schedule grid (empty,
  hover, conflict states).
- `AvatarStatus` — an employee avatar with an availability/clock-in status
  dot.
- `ConflictChip` — an inline warning chip (double-booked, outside
  availability, overtime).

## Content fundamentals

- **Voice:** direct, plain-spoken, reassuring. Talk like a shift lead, not a
  SaaS marketer — short sentences, concrete nouns ("shift," "schedule,"
  "swap"), no jargon like "leverage" or "optimize."
- **Person:** "you" throughout, addressed to the person using the screen in
  front of them. Managers get "your team," "your schedule"; employees get
  "your shifts," "your availability."
- **Casing:** sentence case everywhere — buttons, headers, nav labels.
  Never title case, never all-caps except tiny eyebrow labels (e.g.
  "PUBLISHED" status pill) which use letter-spacing instead of shouting.
- **Tone by context:** neutral and efficient in the schedule grid ("Assign
  shift," "3 conflicts"); warmer and more human in employee-facing copy
  ("You're all set for this week," "Your manager published a new
  schedule"). Confirmations are calm, not celebratory — no exclamation
  points in transactional copy.
- **Errors/warnings:** specific and actionable, never blaming. "This shift
  overlaps with Maria's 2–6 shift" rather than "Conflict detected."
- **Emoji:** not used in UI chrome. Reserved, if ever, for casual
  notification copy (e.g. a shift-swap confirmation text) — not present in
  any screen in this kit.
- **Numbers/time:** always show real clock times (7:00 AM–3:00 PM), never
  24-hour military time; durations spelled out ("8 hrs") not decimal.

## Visual foundations

- **Color:** deep forest green (`--green-800 #12312B`) is the brand
  primary — used for primary actions, active nav, brand chrome. Harvest
  amber (`--amber-500 #F2A93B`) is the secondary accent — used sparingly for
  highlights, the "open shift" flag, and callouts, never as a primary
  button color. Warm paper neutrals (cream `#EDE6DA`/`#F7F3EA` surfaces,
  warm ink `#2A241C` text) replace cold grays throughout — nothing is pure
  white/black/blue-gray. Semantic colors (success/warning/danger/info) are
  warm-tinted variants, not stock red/green/blue.
- **Type:** Figtree, a rounded humanist sans, for everything — display,
  body, UI labels. No serif, no separate display face. Weight does the
  work: 700/800 for headlines, 600 for labels/buttons, 400 for body.
- **Spacing:** 4px base unit, scale at 2/4/8/12/16/20/24/32/40/48/64/80/96.
  Generous padding inside cards and shift blocks — dense schedule grids
  still need 8–12px breathing room per cell to stay tappable on mobile.
- **Backgrounds:** flat warm-paper surfaces, no gradients, no photography,
  no textures/patterns. Cards float on a cream page background via shadow
  + a 1px hairline border, not color blocking.
- **Animation:** minimal and functional — 120–280ms ease-out transitions
  on hover/press/open states (`--ease-out`, `--ease-standard`). No bounce,
  no spring physics, no decorative looping animation. A published schedule
  or a saved shift settles quietly; nothing celebrates with confetti/motion.
- **Hover states:** primary surfaces darken one step (`--accent-hover`);
  outlined/ghost elements gain a soft tinted background
  (`--surface-brand-soft`). No lightening-on-hover, no color inversion.
- **Press states:** darken one step further (`--accent-active`) plus a
  1px translateY(1px) — a light physical "push," no scale/shrink.
- **Borders:** 1px hairline, warm neutral (`--border-default`), used on
  cards, inputs, table cells. Focus state swaps to a 2px brand-green ring
  plus `--shadow-focus` (soft green glow, not a hard outline).
- **Shadows:** soft and warm-tinted (`rgba(42,36,28,…)` never pure black),
  three steps — sm for resting cards, md for raised/hoverable cards, lg for
  modals/popovers. No inner shadows.
- **Corner radii:** consistently rounded, friendly-not-bubbly —
  6px small controls (checkboxes, tags), 10px inputs/buttons, 16px cards,
  22px large containers/sheets, full pill for status badges and the
  primary FAB.
- **Transparency/blur:** none in the base kit — surfaces are opaque. The
  one exception is a modal/sheet scrim (`rgba(10,20,17,0.4)`, no blur).
- **Imagery:** none provided — no product photography or illustration
  assets exist for this brand yet. Avatars use initials-on-color rather
  than photos; empty states use simple iconography (Lucide), not
  illustration.
- **Layout rules:** manager web app uses a fixed left rail + sticky
  week-grid header (time/day labels stay visible while scrolling shifts).
  Mobile app is single-column, thumb-reachable — primary actions live in a
  bottom tab bar or a bottom sheet, never top-right-corner-only.

## Iconography

No icon font, sprite sheet, or custom icon set was attached. **Lucide**
(SVG line icons, 1.5–2px stroke) was chosen as the closest match to the
brand's plain, friendly, no-frills tone — flagging this as a substitution.
It's loaded via the Lucide CDN script (`unpkg.com/lucide`) in components and
UI kits (`<i data-lucide="calendar">` + `lucide.createIcons()`); no binary
asset download was possible from this environment, so nothing is duplicated
into `assets/` — components reference the CDN directly. Unicode characters
and emoji are not used as icons anywhere in the kit.

## Caveats — please help iterate

- **No existing RosterHouse brand assets were attached** (no Figma, no
  codebase, no logo, no fonts). Everything here — palette, type choice,
  component shapes, both UI kits — is a from-scratch proposal based on the
  feature spec and your Q&A answers, not a recreation of anything real.
  If RosterHouse already has a brand, logo, or app, please attach it and
  treat this as a rough draft to be corrected against ground truth.
  **No logo exists yet** — the wordmark is set in plain Figtree everywhere
  a mark would go.
  **Fonts are Google-Fonts-CDN-loaded (Figtree)**, not self-hosted brand
  font files — send real font files if RosterHouse has a licensed typeface.
- Component and screen inventories were sized to the MVP + phase-2 feature
  list from your spec; phase-3 surfaces (POS integration, payroll,
  reporting/analytics, tip pooling) have no screens yet. Multi-location
  switching, org/location onboarding wizard, and billing/subscription
  screens also aren't built yet — flag if you want those next.
