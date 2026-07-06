(function () {
const { WeekGrid, ROLES } = window.__rhManagerWeekGrid;
const { ShiftBlock, Button, Tabs, Badge } = window.RosterHouseDesignSystem_17c92d;

// Mon Jul 6, 2026 — week offset 0. Matches the demo shift data's day keys ("Mon 6" … "Sun 12").
const ANCHOR = new Date(2026, 6, 6);
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function dayKeyOf(date) {
  return `${WEEKDAY_ABBR[date.getDay()]} ${date.getDate()}`;
}
function fmtShort(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addButton(onClick, label) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "7px 0",
        borderRadius: "var(--radius-sm)",
        border: "1px dashed var(--border-strong)",
        color: "var(--text-tertiary)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}

function DayView({ dayKey, shiftsByCell, onCellClick }) {
  const rows = ROLES.map((role) => ({ role, shifts: shiftsByCell[`${role}|${dayKey}`] || [] }));
  const total = rows.reduce((sum, r) => sum + r.shifts.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
      {total === 0 && (
        <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>No shifts scheduled for this day yet.</div>
      )}
      {rows.map((r) => (
        <div key={r.role}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
            {r.role} {r.shifts.length > 0 && `· ${r.shifts.length}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
            {r.shifts.map((shift, idx) => (
              <ShiftBlock
                key={idx}
                role={shift.role}
                time={shift.time}
                employeeName={shift.employeeName}
                status={shift.status}
                conflictReason={shift.conflictReason}
                onClick={() => onCellClick(r.role, dayKey, shift, idx)}
              />
            ))}
            {addButton(() => onCellClick(r.role, dayKey, null, null), `+ Add ${r.role} shift`)}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthView({ monthDate, shiftsByCell, onSelectDay }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const gridStart = addDays(firstOfMonth, -startWeekday);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  function countForDay(date) {
    const key = dayKeyOf(date);
    return ROLES.reduce((sum, role) => sum + (shiftsByCell[`${role}|${key}`] || []).length, 0);
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {cells.map((date, i) => {
          const inMonth = date.getMonth() === month;
          const count = countForDay(date);
          return (
            <div
              key={i}
              onClick={() => onSelectDay(date)}
              style={{
                minHeight: 78,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                padding: 8,
                cursor: "pointer",
                background: inMonth ? "var(--surface-card)" : "var(--surface-sunken)",
                opacity: inMonth ? 1 : 0.5,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{date.getDate()}</div>
              {count > 0 && <Badge tone="success">{count} shift{count > 1 ? "s" : ""}</Badge>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleView({ shiftsByCell, onCellClick }) {
  const [mode, setMode] = React.useState("week");
  const [offset, setOffset] = React.useState(0);

  function switchMode(m) {
    setMode(m);
    setOffset(0);
  }

  let periodLabel = "";
  let body = null;

  if (mode === "week") {
    const weekStart = addDays(ANCHOR, offset * 7);
    const days = Array.from({ length: 7 }, (_, i) => dayKeyOf(addDays(weekStart, i)));
    periodLabel = `${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}`;
    body = <WeekGrid days={days} shiftsByCell={shiftsByCell} onCellClick={onCellClick} />;
  } else if (mode === "day") {
    const date = addDays(ANCHOR, offset);
    periodLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    body = <DayView dayKey={dayKeyOf(date)} shiftsByCell={shiftsByCell} onCellClick={onCellClick} />;
  } else {
    const monthDate = new Date(ANCHOR.getFullYear(), ANCHOR.getMonth() + offset, 1);
    periodLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    body = (
      <MonthView
        monthDate={monthDate}
        shiftsByCell={shiftsByCell}
        onSelectDay={(date) => {
          setMode("day");
          setOffset(Math.round((date - ANCHOR) / (1000 * 60 * 60 * 24)));
        }}
      />
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o - 1)}>
            <i data-lucide="chevron-left" style={{ width: 16, height: 16 }}></i>
          </Button>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", minWidth: 190, textAlign: "center" }}>
            {periodLabel}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o + 1)}>
            <i data-lucide="chevron-right" style={{ width: 16, height: 16 }}></i>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOffset(0)}>
            Today
          </Button>
        </div>
        <Tabs
          value={mode}
          tabs={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          onChange={switchMode}
        />
      </div>
      {body}
    </div>
  );
}

window.__rhManagerScheduleView = { ScheduleView };

})();
