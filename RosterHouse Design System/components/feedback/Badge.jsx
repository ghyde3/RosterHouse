import React from "react";

/**
 * Badge — small status/count indicator, often on avatars or nav icons.
 */
export function Badge({ tone = "success", children }) {
  const tones = {
    success: { bg: "var(--status-success-bg)", fg: "var(--status-success)" },
    warning: { bg: "var(--status-warning-bg)", fg: "var(--amber-800)" },
    danger: { bg: "var(--status-danger-bg)", fg: "var(--status-danger)" },
    info: { bg: "var(--status-info-bg)", fg: "var(--status-info)" },
    neutral: { bg: "var(--surface-sunken)", fg: "var(--text-secondary)" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption-size)",
        fontWeight: "var(--text-caption-weight)",
        letterSpacing: "var(--text-caption-tracking)",
        textTransform: "uppercase",
        background: tones.bg,
        color: tones.fg,
      }}
    >
      {children}
    </span>
  );
}
