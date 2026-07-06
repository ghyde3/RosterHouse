(function () {
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TEAM_AVAILABILITY = [
  { name: "Maria Garcia", days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false } },
  { name: "Sam Torres", days: { Mon: false, Tue: true, Wed: true, Thu: false, Fri: true, Sat: true, Sun: true } },
  { name: "Jordan Park", days: { Mon: true, Tue: true, Wed: false, Thu: true, Fri: true, Sat: false, Sun: false } },
  { name: "Alex Kim", days: { Mon: false, Tue: false, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false } },
  { name: "Priya Shah", days: { Mon: true, Tue: false, Wed: false, Thu: true, Fri: false, Sat: true, Sun: true } },
];

function AvailabilityOverview() {
  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <div style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", marginBottom: 6 }}>
        Team availability
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>
        See who's available before you build next week's schedule.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "160px repeat(7, 1fr)", gap: 8, alignItems: "center" }}>
        <div />
        {DAYS.map((d) => (
          <div key={d} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>{d}</div>
        ))}
        {TEAM_AVAILABILITY.map((person) => (
          <React.Fragment key={person.name}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{person.name}</div>
            {DAYS.map((d) => (
              <div
                key={d}
                style={{
                  height: 34,
                  borderRadius: "var(--radius-sm)",
                  background: person.days[d] ? "var(--status-success-bg)" : "var(--surface-sunken)",
                  border: `1px solid ${person.days[d] ? "var(--green-300)" : "var(--border-default)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {person.days[d] && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-success)" }} />
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

window.__rhManagerAvailability = { AvailabilityOverview };

})();
