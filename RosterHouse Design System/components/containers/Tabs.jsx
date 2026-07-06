import React, { useState } from "react";

/**
 * Tabs — segmented navigation between views (e.g. Schedule / Availability / Time off).
 */
export function Tabs({ tabs = [], value, defaultValue, onChange }) {
  const [internal, setInternal] = useState(defaultValue || (tabs[0] && tabs[0].value));
  const active = value !== undefined ? value : internal;

  function select(v) {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  }

  return (
    <div style={{ display: "flex", gap: 4, background: "var(--surface-sunken)", padding: 4, borderRadius: "var(--radius-md)", fontFamily: "var(--font-sans)", width: "fit-content" }}>
      {tabs.map((t) => (
        <div
          key={t.value}
          onClick={() => select(t.value)}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-label-size)",
            fontWeight: 600,
            color: active === t.value ? "var(--text-brand)" : "var(--text-secondary)",
            background: active === t.value ? "var(--surface-card)" : "transparent",
            boxShadow: active === t.value ? "var(--shadow-sm)" : "none",
            cursor: "pointer",
            transition: "background var(--duration-base) var(--ease-out)",
          }}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}
