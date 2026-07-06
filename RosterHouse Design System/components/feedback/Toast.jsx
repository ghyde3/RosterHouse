import React from "react";

/**
 * Toast — transient notification banner (schedule published, shift updated).
 */
export function Toast({ tone = "success", title, description, onClose }) {
  const tones = {
    success: { icon: "var(--status-success)", iconBg: "var(--status-success-bg)" },
    warning: { icon: "var(--amber-700)", iconBg: "var(--status-warning-bg)" },
    danger: { icon: "var(--status-danger)", iconBg: "var(--status-danger-bg)" },
    info: { icon: "var(--status-info)", iconBg: "var(--status-info-bg)" },
  }[tone];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: 320,
        padding: "14px 16px",
        background: "var(--surface-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: tones.iconBg,
          color: tones.icon,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--text-h3-size)", fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
        {description && (
          <div style={{ fontSize: "var(--text-body-sm-size)", color: "var(--text-secondary)", marginTop: 4 }}>
            {description}
          </div>
        )}
      </div>
      {onClose && (
        <span onClick={onClose} style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, lineHeight: 1 }}>
          ×
        </span>
      )}
    </div>
  );
}
