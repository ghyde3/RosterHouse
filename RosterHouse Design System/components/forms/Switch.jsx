import React from "react";

/**
 * Switch — on/off toggle, used for settings & notification preferences.
 */
export function Switch({ label, checked = false, onChange, disabled = false }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-size)",
        color: "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label && <span>{label}</span>}
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 40,
          height: 24,
          flex: "none",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--accent-primary)" : "var(--neutral-300)",
          position: "relative",
          transition: "background var(--duration-base) var(--ease-out)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "var(--shadow-sm)",
            transition: "left var(--duration-base) var(--ease-out)",
          }}
        />
      </span>
    </label>
  );
}
