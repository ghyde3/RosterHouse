(function () {
const { useState } = React;
const { Card, Button, AvatarStatus, Badge } = window.RosterHouseDesignSystem_17c92d;

const INITIAL_REQUESTS = [
  { id: 1, type: "swap", name: "Priya Shah", detail: "Wants to swap her Sat Jul 12, 4–10 PM Server shift", covering: "Open to anyone qualified" },
  { id: 2, type: "open", name: "Unfilled", detail: "Sun Jul 13, 6 PM–12 AM Dishwasher — claimed by Alex Kim", covering: "Awaiting your approval" },
];

function SwapApprovals() {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);

  function decide(id) {
    setRequests((r) => r.filter((req) => req.id !== id));
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <div style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", marginBottom: 6 }}>
        Swaps &amp; open shifts
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>
        Approve shift swaps and claims before they take effect.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.length === 0 && (
          <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>All caught up — no pending requests.</div>
        )}
        {requests.map((r) => (
          <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <AvatarStatus name={r.name === "Unfilled" ? "Open Shift" : r.name} status="pending" />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{r.name}</span>
                  <Badge tone={r.type === "swap" ? "info" : "warning"}>{r.type === "swap" ? "Swap" : "Open shift"}</Badge>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{r.detail}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => decide(r.id)}>Deny</Button>
              <Button variant="secondary" size="sm" onClick={() => decide(r.id)}>Approve</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

window.__rhManagerSwaps = { SwapApprovals };

})();
