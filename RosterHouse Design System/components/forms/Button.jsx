import React, { useState } from "react";

/**
 * Button — primary UI action control.
 * Variants: primary (brand green), secondary (outlined), ghost (text-only),
 * accent (amber, sparing use), danger (destructive).
 */
export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  icon = null,
  fullWidth = false,
  children,
  onClick,
  type = "button",
}) {
  const [state, setState] = useState("rest"); // rest | hover | active

  const sizes = {
    sm: { padding: "6px 12px", fontSize: 13, gap: 6, radius: "var(--radius-sm)" },
    md: { padding: "10px 18px", fontSize: 14, gap: 8, radius: "var(--radius-md)" },
    lg: { padding: "13px 22px", fontSize: 16, gap: 8, radius: "var(--radius-md)" },
  }[size];

  const palettes = {
    primary: {
      rest: { bg: "var(--accent-primary)", fg: "var(--accent-contrast)", border: "transparent" },
      hover: { bg: "var(--accent-hover)", fg: "var(--accent-contrast)", border: "transparent" },
      active: { bg: "var(--accent-active)", fg: "var(--accent-contrast)", border: "transparent" },
    },
    secondary: {
      rest: { bg: "var(--surface-card)", fg: "var(--text-brand)", border: "var(--border-strong)" },
      hover: { bg: "var(--surface-brand-soft)", fg: "var(--text-brand)", border: "var(--border-brand)" },
      active: { bg: "var(--green-100)", fg: "var(--text-brand)", border: "var(--border-brand)" },
    },
    ghost: {
      rest: { bg: "transparent", fg: "var(--text-brand)", border: "transparent" },
      hover: { bg: "var(--surface-brand-soft)", fg: "var(--text-brand)", border: "transparent" },
      active: { bg: "var(--green-100)", fg: "var(--text-brand)", border: "transparent" },
    },
    accent: {
      rest: { bg: "var(--accent-secondary)", fg: "var(--green-900)", border: "transparent" },
      hover: { bg: "var(--accent-secondary-hover)", fg: "var(--green-900)", border: "transparent" },
      active: { bg: "var(--accent-secondary-active)", fg: "var(--green-900)", border: "transparent" },
    },
    danger: {
      rest: { bg: "var(--status-danger)", fg: "#fff", border: "transparent" },
      hover: { bg: "var(--red-700)", fg: "#fff", border: "transparent" },
      active: { bg: "var(--red-700)", fg: "#fff", border: "transparent" },
    },
  }[variant];

  const p = disabled ? palettes.rest : palettes[state];

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setState("hover")}
      onMouseLeave={() => setState("rest")}
      onMouseDown={() => setState("active")}
      onMouseUp={() => setState("hover")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: sizes.gap,
        whiteSpace: "nowrap",
        flexShrink: 0,
        width: fullWidth ? "100%" : "auto",
        padding: sizes.padding,
        fontFamily: "var(--font-sans)",
        fontSize: sizes.fontSize,
        fontWeight: 600,
        lineHeight: 1,
        color: p.fg,
        background: p.bg,
        border: `1.5px solid ${p.border}`,
        borderRadius: sizes.radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transform: !disabled && state === "active" ? "translateY(1px)" : "translateY(0)",
        transition: `background var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out), transform var(--duration-fast) var(--ease-standard)`,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
