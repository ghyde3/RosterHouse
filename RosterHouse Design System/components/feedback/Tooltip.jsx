import React, { useState } from "react";

/**
 * Tooltip — small hover label for icon-only controls.
 */
export function Tooltip({ label, children, side = "top" }) {
  const [show, setShow] = useState(false);
  const pos = {
    top: { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
  }[side];

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          style={{
            position: "absolute",
            ...pos,
            whiteSpace: "nowrap",
            background: "var(--green-900)",
            color: "var(--text-inverse)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-sm-size)",
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-md)",
            zIndex: 20,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
