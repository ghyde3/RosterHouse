# RosterHouse — Weekly schedule templates (manager)

**Date:** 2026-07-06
**Status:** Approved (design questions answered by Gary 2026-07-06; flag any
changes before / during implementation)
**Inputs:** subsystem architecture map (4 parallel readers + synthesis over the
scheduling UI, shift/schedule APIs, domain layer, and design conventions);
existing scheduling engine shipped in phase 3.

## What we're building

A manager builds a week of shifts once, saves it as a reusable **template**,
and later stamps that template onto a new week to pre-fill the schedule — then
edits and publishes as usual. Templates are the "don't rebuild Monday–Sunday
from scratch every week" feature.

The core loop:

1. **Save as template** — snapshot the week currently on screen into a named
   template.
2. **Apply template** — pick a template + target week, review/confirm who works
   each slot, commit as draft shifts.
3. **Edit as needed** — applied shifts are ordinary draft shifts; the existing
   builder + conflict warnings + publish flow take over unchanged.
4. **Manage** — a Templates page to build/edit templates row-by-row, rename,
   delete.

This is purely additive. The shift-building engine (timezone conversion,
schedule upsert, conflict detection, publish) is reused verbatim; no existing
endpoint or model changes behavior.

## Decisions (with reasoning)

1. **Per-location templates.** Positions and `Location.timezone` are
   location-scoped, and a manager resolves to a single location today
   (`getManagerLocation`, oldest per org). Org-wide / cross-location templates
   would need position-**name** matching across locations and per-target
   timezone resolution — deferred. `@@unique([locationId, name])`.

2. **Templates store day-of-week + wall-clock, never dates/instants.** A
   `Shift` has an absolute `date` (`@db.Date`) and UTC `startsAt`/`endsAt`.
   A template must be week-relative and DST-correct, so each row stores
   `dayOfWeek` (0=Mon..6=Sun, the `AvailabilityRule` convention) and
   `startTime`/`endTime` as **location-local wall-clock strings**. At apply
   time `date = addDaysISO(targetWeek, dayOfWeek)` and the existing
   `shiftInstants(date, start, end, location.timezone)` re-derives the UTC
   instants — preserving intended clock times across a DST boundary and
   handling midnight-crossing shifts for free.

3. **Time format = 12-hour strings ("7:00 AM").** Matches `createShiftSchema` /
   `time12hSchema` / `parseTime12h` and lets the template row editor reuse the
   existing `TimeField` component directly. (Rows are sorted for display by
   parsed minutes, not lexically.)

4. **Assignments are remembered as a soft default, confirmed on every apply.**
   (Gary's pick.) A row stores `employeeProfileId?` — who worked that slot when
   the template was saved. Applying is a **review-and-confirm** step: each
   resolved slot is pre-filled with the remembered person plus conflict hints,
   and the manager keeps, swaps, or sets it Open before anything is written.
   `employeeProfileId` has `onDelete: SetNull`, so an ex-employee's slots simply
   default to Open next time.

5. **Apply into a non-empty week asks: replace or add.** (Gary's pick.) Preview
   reports whether the target week already holds draft/published shifts.
   - **Replace** deletes the week's **draft** shifts, then writes the template.
   - **Add** appends (may duplicate; the manager chose it).
   - **Published shifts are never deleted.** If the target week has published
     shifts, the manager is warned; applying adds draft shifts on top (which
     the existing `hasUnpublishedChanges` logic surfaces as "unpublished
     changes"). We never silently clobber a published schedule.

6. **Open shifts are captured.** Unassigned shifts in the source week become
   open template rows (`employeeProfileId = null`) — they're real coverage
   needs and never conflict.

7. **Notes carry over**, editable after apply. They're often position
   instructions ("bring your knife kit") more than week-specific notes.

8. **Conflicts are advisory at apply, same as everywhere else.** Preview
   surfaces conflict hints for the review screen (reusing
   `buildConflictContext` + `detectConflicts`), but apply never blocks — it
   writes draft shifts and the normal read path re-derives conflicts on the next
   render. Conflicts remain computed, never stored.

9. **Full templates page + row editor** (Gary's pick over lightweight). A
   `/manager/templates` list plus a `/manager/templates/[id]` editor that mirrors
   the week-grid layout (positions × Mon–Sun), so building a template feels like
   building a week. Save-as-template from the builder is the quick-create path;
   the editor is the author/refine path.

## Data model (new)

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
  dayOfWeek         Int     // 0=Mon..6=Sun
  startTime         String  // wall-clock, location-local, 12h ("7:00 AM")
  endTime           String
  notes             String?

  template        ScheduleTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  position        Position         @relation(fields: [positionId], references: [id], onDelete: Cascade)
  employeeProfile EmployeeProfile? @relation(fields: [employeeProfileId], references: [id], onDelete: SetNull)
}
```

Back-relations added to `Location` (`scheduleTemplates`), `Position`
(`templateRows`), `EmployeeProfile` (`templateRows`). New Prisma migration +
`prisma generate`. No changes to `Shift`/`Schedule`.

## Endpoints (new, all `requireManagerForApi` + `guard.location.id` tenancy)

Zod schemas live in `src/lib/template-schemas.ts`; snapshot/resolve helpers in
`src/lib/template-data.ts`. All shift writes go through the same
`shiftInstants` / `getOrCreateSchedule` path as `POST /api/shifts`.

- `GET  /api/schedule-templates` — list templates for the guard's location
  (name, row count, updatedAt). Powers the picker and the Templates page.
- `POST /api/schedule-templates` — create. Two bodies:
  - `{ name, fromWeek: ISODate }` → snapshot that week's shifts into rows.
  - `{ name, rows: TemplateRowInput[] }` → explicit/blank (from the editor).
  - Name collision → 409 with a friendly message (`@@unique`).
- `GET  /api/schedule-templates/{id}` — one template with rows (editor + apply).
- `PATCH /api/schedule-templates/{id}` — rename and/or replace rows (editor
  save). Row replacement is transactional (delete + recreate).
- `DELETE /api/schedule-templates/{id}` — delete (cascade rows).
- `POST /api/schedule-templates/{id}/preview` — body `{ targetWeek }`.
  Read-only. Resolves each row → concrete date; validates the remembered
  position/employee still exist & are active at the location; computes conflict
  hints (per-employee context cached once, per `getScheduleWeekData`); reports
  target-week occupancy (`draftCount`, `publishedCount`) to drive the
  replace/add/warn prompt. Returns resolved rows + flags. Writes nothing.
- `POST /api/schedule-templates/{id}/apply` — body
  `{ targetWeek, mode: 'replace' | 'add', assignments: { [rowId]: employeeProfileId | null } }`.
  Transactional commit. Template rows stay the source of truth for
  position/day/time/notes; the client may only override the **assignee** per row
  (or set null = Open). Server re-validates every position/employee against the
  location. `mode='replace'` deletes existing **draft** shifts for the target
  week's schedule first (never published). Returns `{ created, openCount, week }`.

## UI

**Schedule builder** (`ScheduleView` header actions toolbar, alongside "Add
shift" / "Publish"):
- **"Save as template"** → `SaveAsTemplateDialog` (name input) →
  `POST /api/schedule-templates { name, fromWeek: currentWeek }` → toast.
  Enabled when the week has shifts.
- **"Apply template"** → `ApplyTemplateDialog`, a 3-step flow:
  1. Pick template (`GET` list) + target week (defaults to the viewed week).
  2. Preview (`POST .../preview`) → if the week is non-empty, show replace/add
     (+ published warning).
  3. Review: per-row list, remembered assignee pre-filled with conflict hints;
     keep / swap (`qualifiedEmployees` + `employeeOptionLabel`) / set Open.
     Confirm → `POST .../apply` → `router.refresh()` + toast with counts.

**Templates page:**
- `/manager/templates` (`ManagerSidebar` NAV entry) — list with row count +
  updatedAt; New / Apply / Rename / Delete.
- `/manager/templates/[id]` — editor: positions × Mon–Sun grid reusing the
  existing grid CSS. Cells hold template rows; add/edit via a
  `TemplateShiftDialog` (like `AssignShiftDialog` but a **day-of-week** picker
  instead of a date, and no live conflict check — there is no week to check).
  Save → `PATCH` (rename + rows).

House conventions: CSS modules + design tokens (no Tailwind); `{ ok, data }` /
`{ ok, error }` JSON envelopes; shared zod client+server; `Dialog` / `Button` /
`Select` / `Input` / `useToast` / `router.refresh()`.

## Reuse surface (do not reinvent)

`shiftInstants`, `localTimeOfDay`, `parseTime12h`, `weekStartOfISO`,
`addDaysISO`, `dayOfWeekMon0`, `weekDatesOf` (`lib/time.ts`);
`getOrCreateSchedule`, `getScheduleWeekData`, `toScheduleShift`
(`lib/schedule-data.ts`); `buildConflictContext`, `detectConflicts`
(`lib/conflict-context.ts`, `lib/conflicts.ts`); `requireManagerForApi`
(`lib/manager-guard.ts`); `qualifiedEmployees`, `employeeOptionLabel`,
`AssignShiftDialog`/`WeekGrid` patterns (`components/schedule/`); grid CSS
(`components/schedule/grids.module.css`).

## Out of scope (deliberately)

Applying one template across **multiple weeks** at once (design supports it —
apply is per-week; a range picker is a clean later add); **org-wide /
cross-location** templates (needs position-name matching); template
**versioning / history**; auto-suggesting a template when a manager opens an
empty week; per-position **staffing targets**. All build cleanly on this model.

## Testing (vitest, matching existing route-integration + lib-unit patterns)

- **Round-trip:** save week → apply → shifts preserve wall-clock, including
  (a) a DST-boundary week and (b) a cross-midnight shift.
- **Relativization unit:** shift `date`/instants → `dayOfWeek` + wall-clock and
  back, across timezones.
- **Apply modes:** `replace` deletes only draft shifts; `add` appends;
  published shifts survive both.
- **Assignment resolution:** ex-employee / inactive / deleted position → slot
  coerced to Open (or 404 on tamper); confirmed override is honored.
- **Preview:** conflict hints match `detectConflicts`; occupancy counts drive
  the replace/add prompt.
- **Tenancy:** every endpoint rejects cross-location templates/positions/
  employees; name-uniqueness returns 409.
