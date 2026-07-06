import React, { useState, useRef, useEffect } from "react";

/**
 * Select — dropdown for a small set of options (role, location, status).
 */
export function Select({ label, value, onChange, options = [], placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-sans)", position: "relative" }}>
      {label && (
        <label style={{ fontSize: "var(--text-label-size)", fontWeight: "var(--text-label-weight)", color: "var(--text-primary)" }}>
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          padding: "0 12px",
          background: "var(--surface-card)",
          border: `1.5px solid ${open ? "var(--border-focus)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-md)",
          boxShadow: open ? "var(--shadow-focus)" : "none",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body-size)",
          color: current ? "var(--text-primary)" : "var(--text-tertiary)",
          cursor: "pointer",
        }}
      >
        {current ? current.label : placeholder}
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--surface-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          {options.map((o) => (
            <div
              key={o.value}
              onClick={() => {
                onChange && onChange(o.value);
                setOpen(false);
              }}
              style={{
                padding: "10px 12px",
                fontSize: "var(--text-body-size)",
                color: "var(--text-primary)",
                background: o.value === value ? "var(--surface-brand-soft)" : "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = o.value === value ? "var(--surface-brand-soft)" : "transparent")}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
