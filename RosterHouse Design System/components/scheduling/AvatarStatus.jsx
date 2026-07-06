import React from "react";

/**
 * AvatarStatus — employee avatar (initials) with an availability/status dot.
 */
export function AvatarStatus({ name, status = "available", size = 40 }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dotColor = {
    available: "var(--status-success)",
    unavailable: "var(--status-danger)",
    pending: "var(--status-warning)",
    off: "var(--neutral-400)",
  }[status];

  return (
    <span style={{ position: "relative", display: "inline-flex", fontFamily: "var(--font-sans)" }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--green-100)",
          color: "var(--green-800)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: size * 0.38,
        }}
      >
        {initials}
      </span>
      <span
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: "50%",
          background: dotColor,
          border: "2px solid var(--surface-card)",
        }}
      />
    </span>
  );
}
