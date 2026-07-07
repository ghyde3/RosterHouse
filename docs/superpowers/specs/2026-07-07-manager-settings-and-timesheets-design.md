# RosterHouse — Manager settings, positions, availability & timesheets

**Date:** 2026-07-07
**Status:** Approved (design questions answered by Gary 2026-07-07; flag any
changes before/during implementation)
**Inputs:** subsystem map (4 parallel readers over clock data, positions,
availability overview, and nav/settings/config + synthesis); the phase-3
scheduling engine and the (un-merged) schedule-templates feature this builds on.
**Branch:** `feat/manager-settings`, off the `feat/schedule-templates` HEAD
(builds on the un-merged templates work; both land together when shipped).

## What we're building

A **Settings** hub for managers plus a **Timesheets / Time & Attendance** area,
delivered as four self-contained phases on one spec:

1. **Settings foundation** — a Settings page (replacing the Templates nav
   entry) that edits location config and re-homes template management.
2. **Positions management** — add / rename / reorder / archive the roles that
   drive scheduling (previously frozen at signup).
3. **Availability** — group the team-availability overview by role and filter
   it by day and status.
4. **Timesheets** — turn the clock-in/out punches (today used only for the
   dashboard's "clocked-in now" count) into timesheets, punch history, actual
   labor cost, schedule-vs-actual reconciliation, manager corrections, and CSV
   export.

Purely additive except where noted: the templates *management* routes move under
Settings (the schedule-builder Save/Apply buttons stay put), and two models gain
nullable columns (`Position.archivedAt`, `TimeClockEntry.editedByUserId/editedAt`).

## Decisions (with reasoning)

1. **Remove Templates from the nav; add Settings.** Templates are a scheduling
   workflow reached from the schedule builder, not a top-level destination. The
   list/editor relocate under Settings (Gary's pick) so all manager
   administration lives in one place. New sidebar gear icon for Settings.

2. **Positions: archive, never hard-delete** (Gary's pick). `Shift.positionId`
   has no `onDelete`, so a hard delete of a used position throws at the DB.
   Add a nullable `Position.archivedAt`. **Archived roles disappear from every
   *new*-scheduling picker** (assign dialog, invites, template editor, position
   filters) but existing data is untouched — the schedule grid shows a row for
   any position that is **active OR has a shift in the viewed week**, so nothing
   already scheduled vanishes. Add / rename / reorder operate on active
   positions. Name uniqueness is enforced **case-insensitively** (matching the
   signup dedup), tighter than the DB's case-sensitive `@@unique`.

3. **Location config exposed now:** `name`, `timezone`, `overtimeHoursPerWeek`
   (blank = OT conflicts off), `address`. **Geofence (lat/lng/radius) is
   deferred** — it needs a map picker. Changing `timezone` retroactively shifts
   all wall-clock rendering, so the UI confirms before saving.

4. **Availability: group by *primary* role + filter by day/status** (Gary's
   pick). Uses data already on hand (`primaryPositionName`); only a stable
   `orderBy` and exposing `primaryPositionId` are added. **Secondary/qualified-
   role filtering is deferred** — it's the only part needing a query change.

5. **Timesheets are weekly**, navigated by date range like the schedule pager
   (no pay-period config — YAGNI). Reconciliation is **computed at read time,
   never stored** (mirrors the conflicts engine). **CSV export only** (no PDF
   lib in the stack).

6. **Managers can edit / close / add / delete punches** (Gary's pick), each
   stamped with an audit trail (`editedByUserId`, `editedAt`). Timesheets must
   be trustworthy for export, and missed clock-outs are routine. Open entries in
   a past week are flagged and excluded from totals until closed.

7. **Reconciliation surfaces no-show + late + overtime** (Gary's pick).
   Matching is by the `TimeClockEntry.shiftId` already captured (best-effort) at
   clock-in — no window-overlap heuristic. **No-show** = an assigned, published
   shift in the week with no entry pointing at it. **Late** = an entry with a
   `shiftId` whose clock-in is > **5 min** after that shift's start (fixed grace,
   not yet configurable). **Overtime** = actual weekly hours over
   `location.overtimeHoursPerWeek`.

## Data model changes

```prisma
model Position {
  // … existing fields …
  archivedAt DateTime? // null = active; set = hidden from new scheduling
}

model TimeClockEntry {
  // … existing fields …
  editedByUserId String?   // manager who last corrected this entry (audit)
  editedAt       DateTime? // when it was corrected
}
```

Two migrations (or one). No other schema changes; reconciliation and hours are
derived, not stored.

---

## Phase 1 — Settings foundation

**Routes** (new `/manager/settings` area with a shared sub-nav):
- `/manager/settings` — **Location** config form.
- `/manager/settings/positions` — Positions (Phase 2).
- `/manager/settings/templates` — Templates list (relocated).
- `/manager/settings/templates/[templateId]` — Template editor (relocated).

A `src/app/manager/settings/layout.tsx` renders a horizontal sub-nav (Location ·
Positions · Templates), active-highlighted by pathname, above each section.

**Nav:** in `ManagerSidebar` NAV, remove the Templates entry, add
`{ href: "/manager/settings", label: "Settings", icon: "settings" }`; add a
`settings` (gear) glyph to `src/components/ui/Icon.tsx`.

**Location config:** `PATCH /api/locations/[locationId]/route.ts` (manager guard;
`guard.location.id === locationId`; zod: `name` non-empty, `timezone` a valid
IANA zone via `Intl.supportedValuesOf("timeZone")`, `overtimeHoursPerWeek`
nullable non-negative int, `address` nullable). The form is a client component;
`timezone` is a `Select` of common US zones; on change it shows a confirm
("changes how all existing times display") before the PATCH.

**Templates relocation:** move `src/app/manager/templates/**` → `src/app/manager/
settings/templates/**`; repoint `SaveAsTemplateDialog`'s post-save navigation and
`TemplatesView`'s edit links to `/manager/settings/templates/[id]`; delete the old
routes. The schedule-builder Save/Apply dialogs are unchanged.

---

## Phase 2 — Positions management

**Section** at `/manager/settings/positions`: a list of active positions (each:
name, up/down reorder, Rename, Archive), an **Add position** input, and a
collapsed **Archived** list with Unarchive. No drag lib in the stack → up/down
buttons.

**Endpoints** (manager guard + tenancy on every one):
- `POST /api/positions` — `{ name }` → next `sortOrder`, case-insensitive unique
  (409 on collision), returns the position.
- `PATCH /api/positions/[positionId]` — `{ name? }` (case-insensitive unique) and/
  or `{ archived: boolean }` (sets/clears `archivedAt`).
- `PATCH /api/positions/reorder` — `{ orderedIds: string[] }` → assigns
  `sortOrder` by index in one transaction.

**Archive-aware reads:** add `where: { archivedAt: null }` to the position
queries that feed *new* scheduling — the assign-shift employee/position pickers
(schedule page positions), invite position options, template editor positions,
and the availability position filter. **`getScheduleWeekData`** changes its grid
rows to *active positions ∪ positions referenced by this week's shifts*, so an
archived role with shifts still renders. Team/detail views that display a
shift's position keep joining `Position` regardless (archived still shows on old
records).

---

## Phase 3 — Availability grouping & filtering

**Query** (`src/lib/queries/availability.ts`): add
`orderBy: [{ primaryPosition: { sortOrder: "asc" } }, { user: { name: "asc" } }]`
and expose `primaryPositionId` (+ keep `primaryPositionName`) on
`OverviewEmployee`.

**View:** section the roster under **primary-position headers** (in `sortOrder`,
with an "Unassigned" group for null primary), plus client-side controls:
- **Day filter** — All / Mon…Sun (hides other day columns).
- **Status filter** — All / Available / Unavailable / On time-off this week
  (derived from each employee's existing `days[]`).

The page passes the location's active positions for any position-scoped control.
No secondary-role filtering (deferred).

---

## Phase 4 — Timesheets / Time & Attendance

**Route:** `/manager/timesheets` (server component), weekly, date-range nav like
the schedule pager (defaults to current week). New nav item
`{ href: "/manager/timesheets", label: "Timesheets", icon: "timer" }`.

**Data (`src/lib/timesheet-data.ts`):** `getTimesheetWeekData(locationId,
weekStart)` fetches the week's `TimeClockEntry` rows (joined to employee + shift)
and the week's shifts, then returns per employee:
- `entries[]` — each with `clockInAt`, `clockOutAt`, computed `hours`
  (reuse the interval logic in `src/lib/timeclock.ts`), matched shift, and
  per-entry flags: `incomplete` (no clock-out), `late` (matched shift, clock-in >
  start + 5 min), `edited` (audit present).
- `hoursActual` (sum of completed entries), `laborCost` (`hoursActual` ×
  `hourlyRate`, null if no rate).
- week flags: `lateCount`, `noShowCount` (assigned published shifts with no
  matching entry), `overtime` (`hoursActual` > `overtimeHoursPerWeek`).

**View (`TimesheetsView`):** per-employee sections (name · week hours · cost ·
flag badges), expandable to the day-by-day punch rows; each punch row has Edit
and Delete; each employee/day has Add-punch. Manager edits go through:

- `POST /api/time-clock-entries` — `{ employeeProfileId, clockInAt, clockOutAt?,
  shiftId? }`; stamps `editedByUserId`/`editedAt`.
- `PATCH /api/time-clock-entries/[id]` — `{ clockInAt?, clockOutAt? }`; re-stamps
  audit.
- `DELETE /api/time-clock-entries/[id]`.
All manager-guarded and tenancy-scoped (`entry.locationId === guard.location.id`).

**Export:** `GET /api/locations/[locationId]/timesheets/export?weekStart=…` →
`text/csv` (employee, date, clock-in, clock-out, hours, cost, flags), from the
same `getTimesheetWeekData`. A download button on the page.

**Dashboard:** `getDashboardData` gains an **actual labor cost** figure
(week-to-date actual hours × rate) shown next to the existing *projected* one.

## Reuse surface (don't reinvent)

`requireManagerForApi` + `guard.location.id` tenancy; `jsonOk`/`jsonErr`/
`handleApiError`; zod-in-shared-schemas; `weekStartOfISO`/`weekDatesOf`/
`addDaysISO`/`localTimeOfDay`/`formatTime` (`lib/time.ts`); the interval-sum in
`lib/timeclock.ts`; `getScheduleWeekData` patterns for week fetch + per-employee
grouping; `Dialog`/`Button`/`Select`/`Input`/`Badge`/`Card`/`useToast`/
`router.refresh`; CSS modules + design tokens (no Tailwind); the schedule
`DatePager` for week navigation; the availability grid CSS for grouping.

## Out of scope (deliberately)

Geofence config **and** geofence enforcement/audit (clock-data feature 5);
qualified/secondary-role availability filtering; configurable late-grace or
pay-period settings; PDF export; drag-to-reorder positions; hard-deleting
positions; punch approval/lock workflows; multi-location. All build cleanly on
this design later.

## Testing (vitest, matching existing route-integration + lib-unit patterns)

- **Location PATCH:** valid update; invalid timezone → 400; tenancy → 403;
  `overtimeHoursPerWeek` nullable accepted.
- **Positions:** create (case-insensitive dup → 409); rename (dup → 409);
  reorder persists `sortOrder`; archive sets `archivedAt` and excludes from
  new-scheduling pickers; `getScheduleWeekData` still shows an archived position
  that has a shift this week; unarchive restores it.
- **Availability:** ordered by primary `sortOrder` then name; grouping keys +
  "Unassigned"; day/status filters derive correctly.
- **Timesheets:** hours sum (incl. cross-midnight, DST); incomplete entry
  excluded + flagged; late/no-show/overtime detection; labor cost with/without
  rate; manager edit/close/add/delete stamps audit + enforces tenancy; CSV rows
  match the computed data.
- **Nav:** Settings present, Templates absent; templates reachable at the new
  `/manager/settings/templates` paths; schedule-builder save navigates there.
