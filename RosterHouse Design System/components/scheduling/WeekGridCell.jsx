import React from "react";

/**
 * WeekGridCell — a single day/time cell in the manager's schedule grid.
 */
export function WeekGridCell({ children, empty = false, hasConflict = false, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 72,
        padding: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        borderRadius: "var(--radius-sm)",
        border: hasConflict ? "1.5px dashed var(--status-danger)" : empty ? "1px solid var(--border-default)" : "none",
        background: empty ? (hover ? "var(--surface-brand-soft)" : "var(--surface-card)") : "transparent",
        cursor: empty ? "pointer" : "default",
        transition: "background var(--duration-fast) var(--ease-out)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {empty && !children ? (
        <span style={{ fontSize: 18, color: hover ? "var(--text-brand)" : "var(--border-strong)", textAlign: "center" }}>+</span>
      ) : (
        children
      )}
    </div>
  );
}
