import React from "react";

/**
 * Tag — removable label chip, used for roles/skills/filters.
 */
export function Tag({ children, onRemove, color = "neutral" }) {
  const colors = {
    neutral: { bg: "var(--surface-sunken)", fg: "var(--text-primary)" },
    brand: { bg: "var(--surface-brand-soft)", fg: "var(--text-brand)" },
    accent: { bg: "var(--amber-100)", fg: "var(--amber-800)" },
  }[color];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-sm-size)",
        fontWeight: 500,
        background: colors.bg,
        color: colors.fg,
      }}
    >
      {children}
      {onRemove && (
        <span onClick={onRemove} style={{ cursor: "pointer", opacity: 0.6, fontWeight: 700 }}>
          ×
        </span>
      )}
    </span>
  );
}
