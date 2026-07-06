import React from "react";

/**
 * Card — surface container for grouped content.
 */
export function Card({ children, padding = "var(--space-6)", hoverable = false, style = {} }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding,
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "box-shadow var(--duration-base) var(--ease-out)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
