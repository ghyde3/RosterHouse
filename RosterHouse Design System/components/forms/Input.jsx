import React, { useState } from "react";

/**
 * Input — single-line text field.
 */
export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  error,
  disabled = false,
  icon = null,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-sans)", minWidth: 0 }}>
      {label && (
        <label style={{ fontSize: "var(--text-label-size)", fontWeight: "var(--text-label-weight)", color: "var(--text-primary)" }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          height: 44,
          width: "100%",
          boxSizing: "border-box",
          background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
          border: `1.5px solid ${error ? "var(--status-danger)" : focused ? "var(--border-focus)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-md)",
          boxShadow: focused ? "var(--shadow-focus)" : "none",
          transition: "box-shadow var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out)",
        }}
      >
        {icon}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-size)",
            color: "var(--text-primary)",
          }}
        />
      </div>
      {error && (
        <span style={{ fontSize: "var(--text-body-sm-size)", color: "var(--status-danger)" }}>{error}</span>
      )}
    </div>
  );
}
