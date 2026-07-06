Domain primitive (intentional addition — no source component library exists;
this represents a scheduled shift, the core object of the product).

```jsx
<ShiftBlock role="Line cook" time="7:00 AM – 3:00 PM" employeeName="Maria G." status="confirmed" onClick={openShift} />
<ShiftBlock role="Server" time="2:00 PM – 6:00 PM" employeeName="Sam T." status="conflict" conflictReason="Overlaps Sam's 6–10 PM Dishwasher shift" />
```

Status drives color: `confirmed` (green), `open` (amber — unfilled, claimable),
`conflict` (red — double-booked/outside availability), `draft` (neutral —
unpublished). Use `compact` for dense week-grid cells.
