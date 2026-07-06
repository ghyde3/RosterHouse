(function () {
const { ShiftBlock, WeekGridCell } = window.RosterHouseDesignSystem_17c92d;

const ROLES = ["Line cook", "Server", "Dishwasher", "Host"];

function WeekGrid({ days, shiftsByCell, onCellClick }) {
  const DAYS = days;
  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "110px repeat(7, minmax(128px, 1fr))",
          position: "sticky",
          top: 0,
          background: "var(--surface-page)",
          zIndex: 2,
          paddingBottom: 8,
        }}
      >
        <div />
        {DAYS.map((d) => (
          <div key={d} style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      {ROLES.map((role) => (
        <div key={role} style={{ display: "grid", gridTemplateColumns: "110px repeat(7, minmax(128px, 1fr))", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "flex-start", paddingTop: 6 }}>
            {role}
          </div>
          {DAYS.map((day) => {
            const key = `${role}|${day}`;
            const dayShifts = shiftsByCell[key] || [];
            const hasConflict = dayShifts.some((s) => s.status === "conflict");
            return (
              <WeekGridCell
                key={key}
                empty={dayShifts.length === 0}
                hasConflict={hasConflict}
                onClick={() => dayShifts.length === 0 && onCellClick(role, day, null, null)}
              >
                {dayShifts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                    {dayShifts.map((shift, idx) => (
                      <ShiftBlock
                        key={idx}
                        compact
                        role={shift.role}
                        time={shift.time}
                        employeeName={shift.employeeName}
                        status={shift.status}
                        conflictReason={shift.conflictReason}
                        onClick={() => onCellClick(role, day, shift, idx)}
                      />
                    ))}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onCellClick(role, day, null, null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        padding: "5px 0",
                        borderRadius: "var(--radius-sm)",
                        border: "1px dashed var(--border-strong)",
                        color: "var(--text-tertiary)",
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      + Add
                    </div>
                  </div>
                )}
              </WeekGridCell>
            );
          })}
        </div>
      ))}
    </div>
  );
}

window.__rhManagerWeekGrid = { WeekGrid, ROLES };

})();
