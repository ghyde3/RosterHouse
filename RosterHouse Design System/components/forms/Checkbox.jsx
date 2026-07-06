import React from "react";

/**
 * Checkbox — binary selection control.
 */
export function Checkbox({ label, checked = false, onChange, disabled = false }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-size)",
        color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 20,
          height: 20,
          flex: "none",
          borderRadius: "var(--radius-sm)",
          border: `1.5px solid ${checked ? "var(--accent-primary)" : "var(--border-strong)"}`,
          background: checked ? "var(--accent-primary)" : "var(--surface-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}
