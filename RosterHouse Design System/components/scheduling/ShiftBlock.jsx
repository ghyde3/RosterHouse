import React from "react";

/**
 * ShiftBlock — a scheduled shift as it appears on the week grid or a list.
 */
export function ShiftBlock({ role, time, employeeName, status = "confirmed", compact = false, conflictReason, onClick }) {
  const palettes = {
    confirmed: { bg: "var(--green-50)", border: "var(--green-300)", fg: "var(--green-800)" },
    open: { bg: "var(--amber-50)", border: "var(--amber-300)", fg: "var(--amber-800)" },
    conflict: { bg: "var(--red-50)", border: "var(--red-500)", fg: "var(--red-700)" },
    draft: { bg: "var(--surface-sunken)", border: "var(--border-strong)", fg: "var(--text-secondary)" },
  }[status];

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
        boxSizing: "border-box",
        padding: compact ? "6px 8px" : "10px 12px",
        background: palettes.bg,
        border: `1.5px solid ${palettes.border}`,
        borderRadius: "var(--radius-md)",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ fontSize: compact ? 11 : "var(--text-label-size)", fontWeight: 600, color: palettes.fg }}>
        {role}
      </div>
      <div style={{ fontSize: compact ? 10 : "var(--text-body-sm-size)", color: "var(--text-secondary)" }}>{time}</div>
      {employeeName && (
        <div style={{ fontSize: compact ? 10 : "var(--text-body-sm-size)", color: "var(--text-primary)", fontWeight: 500 }}>
          {employeeName}
        </div>
      )}
      {status === "conflict" && conflictReason && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 4,
            marginTop: 3,
            paddingTop: 3,
            borderTop: "1px solid var(--red-100)",
            fontSize: compact ? 9.5 : 11,
            lineHeight: 1.3,
            fontWeight: 600,
            color: "var(--status-danger)",
          }}
        >
          <svg width={compact ? "9" : "11"} height={compact ? "9" : "11"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {conflictReason}
        </div>
      )}
    </div>
  );
}
