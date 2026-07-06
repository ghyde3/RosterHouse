import React, { useEffect } from "react";

/**
 * Dialog — modal overlay for focused tasks (assign shift, confirm publish).
 */
export function Dialog({ open, onClose, title, children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose && onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 20, 17, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "90vw",
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--space-7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {title && (
          <div style={{ fontSize: "var(--text-h2-size)", fontWeight: "var(--text-h2-weight)", color: "var(--text-primary)" }}>
            {title}
          </div>
        )}
        <div style={{ color: "var(--text-primary)", fontSize: "var(--text-body-size)" }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}
