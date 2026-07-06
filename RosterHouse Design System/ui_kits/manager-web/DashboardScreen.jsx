(function () {
const { Card, Badge, AvatarStatus, ConflictChip } = window.RosterHouseDesignSystem_17c92d;

function StatCard({ label, value, tone }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ fontFamily: "var(--font-sans)" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: tone || "var(--text-primary)", marginTop: 6 }}>{value}</div>
      </div>
    </Card>
  );
}

function DashboardScreen({ conflictCount, onGoSchedule, onGoTimeOff, onGoSwaps }) {
  const clockedIn = [
    { name: "Maria Garcia", role: "Line cook" },
    { name: "Alex Kim", role: "Host" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", fontFamily: "var(--font-sans)" }}>
      <div style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Good afternoon, Jamie
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <StatCard label="Coverage gaps this week" value="2" tone="var(--status-warning)" />
        <StatCard label="Pending requests" value="3" />
        <StatCard label="Projected labor cost" value="$4,120" />
        <StatCard label="Clocked in now" value={clockedIn.length} tone="var(--status-success)" />
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        <Card style={{ flex: 1 }} hoverable>
          <div onClick={onGoSchedule} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>2 shifts have conflicts</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Resolve before you publish this week's schedule.</div>
            <div style={{ marginTop: 10 }}><ConflictChip>View in Schedule Builder</ConflictChip></div>
          </div>
        </Card>
        <Card style={{ flex: 1 }} hoverable>
          <div onClick={onGoTimeOff} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>2 time-off requests waiting</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Sam Torres, Alex Kim are waiting on a decision.</div>
            <div style={{ marginTop: 10 }}><Badge tone="warning">Needs review</Badge></div>
          </div>
        </Card>
        <Card style={{ flex: 1 }} hoverable>
          <div onClick={onGoSwaps} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>1 swap request</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Priya Shah wants to swap her Saturday shift.</div>
            <div style={{ marginTop: 10 }}><Badge tone="info">Needs review</Badge></div>
          </div>
        </Card>
      </div>

      <div style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)" }}>
        Clocked in now
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {clockedIn.map((c) => (
          <Card key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, width: 220 }}>
            <AvatarStatus name={c.name} status="available" />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.role}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

window.__rhManagerDashboard = { DashboardScreen };

})();
