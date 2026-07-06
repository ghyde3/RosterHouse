Domain primitive (intentional addition) — one cell of the manager week-grid
calendar, the core scheduling surface.

```jsx
<WeekGridCell empty onClick={addShift} />
<WeekGridCell><ShiftBlock compact ... /></WeekGridCell>
<WeekGridCell hasConflict><ShiftBlock compact status="conflict" ... /></WeekGridCell>
```

Empty cells show a "+" affordance on hover, tinted with
`--surface-brand-soft`. `hasConflict` switches the border to a dashed red
outline.
