import React from "react";

/**
 * ConflictChip — inline warning for scheduling conflicts.
 */
export function ConflictChip({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--status-danger-bg)",
        color: "var(--status-danger)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-sm-size)",
        fontWeight: 600,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      {children}
    </span>
  );
}
