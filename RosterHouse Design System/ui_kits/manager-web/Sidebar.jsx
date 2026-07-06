(function () {
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { key: "schedule", label: "Schedule", icon: "calendar" },
  { key: "team", label: "Team", icon: "users" },
  { key: "availability", label: "Availability", icon: "calendar-check" },
  { key: "timeoff", label: "Time off", icon: "clock" },
  { key: "swaps", label: "Swaps & open shifts", icon: "repeat" },
];

function Sidebar({ active, onSelect, location, onLocationClick }) {
  return (
    <div
      style={{
        width: 232,
        flex: "none",
        background: "var(--surface-brand)",
        color: "var(--text-inverse)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-6) var(--space-5)",
        gap: "var(--space-8)",
        fontFamily: "var(--font-sans)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>RosterHouse</div>

      <div
        onClick={onLocationClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          background: "rgba(255,255,255,0.08)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>{location}</span>
        <i data-lucide="chevron-right" style={{ width: 14, height: 14 }}></i>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => (
          <div
            key={n.key}
            onClick={() => onSelect(n.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: active === n.key ? "rgba(255,255,255,0.14)" : "transparent",
              transition: "background var(--duration-fast) var(--ease-out)",
            }}
          >
            <i data-lucide={n.icon} style={{ width: 18, height: 18 }}></i>
            {n.label}
          </div>
        ))}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          JP
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Jamie Park</div>
      </div>
    </div>
  );
}

window.__rhManagerSidebar = { Sidebar };

})();
