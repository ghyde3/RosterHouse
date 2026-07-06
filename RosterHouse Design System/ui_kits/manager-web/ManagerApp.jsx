(function () {
const { Sidebar } = window.__rhManagerSidebar;
const { WeekGrid } = window.__rhManagerWeekGrid;
const { AssignShiftDialog } = window.__rhManagerAssignDialog;
const { DashboardScreen } = window.__rhManagerDashboard;
const { AvailabilityOverview } = window.__rhManagerAvailability;
const { SwapApprovals } = window.__rhManagerSwaps;
const { ScheduleView } = window.__rhManagerScheduleView;
const { Button, Badge, ConflictChip, AvatarStatus, Card, Toast, Dialog } = window.RosterHouseDesignSystem_17c92d;

const INITIAL_SHIFTS = {
  "Line cook|Mon 6": [{ role: "Line cook", time: "7:00 AM – 3:00 PM", employeeName: "Maria Garcia", status: "confirmed" }],
  "Line cook|Tue 7": [{ role: "Line cook", time: "7:00 AM – 3:00 PM", employeeName: "Maria Garcia", status: "confirmed" }],
  "Line cook|Wed 8": [{ role: "Line cook", time: "7:00 AM – 3:00 PM", employeeName: "Diego Ramirez", status: "confirmed" }],
  "Line cook|Thu 9": [{ role: "Line cook", time: "7:00 AM – 3:00 PM", employeeName: "Maria Garcia", status: "confirmed" }],
  "Line cook|Fri 10": [
    { role: "Line cook", time: "7:00 AM – 3:00 PM", employeeName: "Maria Garcia", status: "confirmed" },
    { role: "Line cook", time: "3:00 PM – 11:00 PM", employeeName: "Diego Ramirez", status: "confirmed" },
  ],
  "Line cook|Sat 11": [{ role: "Line cook", time: "9:00 AM – 5:00 PM", employeeName: "Diego Ramirez", status: "confirmed" }],

  "Server|Mon 6": [
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Sam Torres", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Priya Shah", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", status: "open" },
  ],
  "Server|Tue 7": [
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Chloe Nguyen", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Sam Torres", status: "confirmed" },
  ],
  "Server|Wed 8": [
    { role: "Server", time: "2:00 PM – 6:00 PM", employeeName: "Sam Torres", status: "conflict", conflictReason: "Overlaps Sam's 5–11 PM Dishwasher shift the same day" },
    { role: "Server", time: "6:00 PM – 10:00 PM", employeeName: "Chloe Nguyen", status: "confirmed" },
  ],
  "Server|Thu 9": [
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Priya Shah", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Marcus Bell", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", status: "open" },
  ],
  "Server|Fri 10": [
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Sam Torres", status: "confirmed" },
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Priya Shah", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Chloe Nguyen", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Marcus Bell", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Taylor Osei", status: "draft" },
    { role: "Server", time: "6:00 PM – 11:00 PM", employeeName: "Grace Lin", status: "confirmed" },
    { role: "Server", time: "6:00 PM – 11:00 PM", status: "open" },
  ],
  "Server|Sat 11": [
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Sam Torres", status: "confirmed" },
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Priya Shah", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Chloe Nguyen", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 10:00 PM", employeeName: "Marcus Bell", status: "confirmed" },
  ],
  "Server|Sun 12": [
    { role: "Server", time: "11:00 AM – 4:00 PM", employeeName: "Priya Shah", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 9:00 PM", employeeName: "Taylor Osei", status: "confirmed" },
    { role: "Server", time: "4:00 PM – 9:00 PM", employeeName: "Grace Lin", status: "confirmed" },
  ],

  "Dishwasher|Wed 8": [{ role: "Dishwasher", time: "5:00 PM – 11:00 PM", employeeName: "Sam Torres", status: "conflict", conflictReason: "Overlaps Sam's 2–6 PM Server shift the same day" }],
  "Dishwasher|Thu 9": [{ role: "Dishwasher", time: "6:00 PM – 12:00 AM", employeeName: "Jordan Park", status: "draft" }],
  "Dishwasher|Fri 10": [
    { role: "Dishwasher", time: "11:00 AM – 5:00 PM", employeeName: "Jordan Park", status: "confirmed" },
    { role: "Dishwasher", time: "5:00 PM – 12:00 AM", employeeName: "Alex Kim", status: "confirmed" },
  ],

  "Host|Fri 10": [{ role: "Host", time: "11:00 AM – 3:00 PM", employeeName: "Alex Kim", status: "confirmed" }],
  "Host|Sat 11": [{ role: "Host", time: "11:00 AM – 3:00 PM", employeeName: "Alex Kim", status: "confirmed" }],
};

const TEAM = [
  { name: "Maria Garcia", role: "Line cook", status: "available" },
  { name: "Sam Torres", role: "Server", status: "unavailable" },
  { name: "Jordan Park", role: "Dishwasher", status: "available" },
  { name: "Alex Kim", role: "Host", status: "pending" },
  { name: "Priya Shah", role: "Server", status: "off" },
  { name: "Diego Ramirez", role: "Line cook", status: "available" },
  { name: "Chloe Nguyen", role: "Server", status: "available" },
  { name: "Marcus Bell", role: "Server", status: "available" },
  { name: "Taylor Osei", role: "Server", status: "pending" },
  { name: "Grace Lin", role: "Server", status: "available" },
];

const TIME_OFF = [
  { name: "Sam Torres", range: "Jul 14 – Jul 16", reason: "Family trip" },
  { name: "Alex Kim", range: "Jul 20", reason: "Doctor appointment" },
];

function ManagerApp() {
  const [nav, setNav] = React.useState("dashboard");

  React.useEffect(() => {
    window.lucide && window.lucide.createIcons();
  });
  const [shifts, setShifts] = React.useState(INITIAL_SHIFTS);
  const [dialog, setDialog] = React.useState(null); // { role, day, existing }
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [published, setPublished] = React.useState(false);

  const conflictCount = Object.values(shifts).flat().filter((s) => s.status === "conflict").length;

  function cellClick(role, day, existing, index) {
    setDialog({ role, day, existing, index });
  }

  function saveShift(patch) {
    const key = `${dialog.role}|${dialog.day}`;
    setShifts((s) => {
      const list = s[key] ? [...s[key]] : [];
      const entry = {
        role: dialog.role,
        time: patch.time,
        employeeName: patch.employeeName || undefined,
        status: patch.employeeName ? "draft" : "open",
      };
      if (dialog.index != null) {
        list[dialog.index] = entry;
      } else {
        list.push(entry);
      }
      return { ...s, [key]: list };
    });
    setDialog(null);
  }

  function deleteShift() {
    const key = `${dialog.role}|${dialog.day}`;
    setShifts((s) => {
      const list = (s[key] || []).filter((_, i) => i !== dialog.index);
      const next = { ...s };
      if (list.length) next[key] = list;
      else delete next[key];
      return next;
    });
    setDialog(null);
  }

  function publish() {
    setShifts((s) => {
      const next = {};
      Object.entries(s).forEach(([k, list]) => {
        next[k] = list.map((v) => ({ ...v, status: v.status === "draft" ? "confirmed" : v.status }));
      });
      return next;
    });
    setPublished(true);
    setPublishOpen(false);
    setToast({ title: "Schedule published", description: "10 employees notified by push and text" });
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 720, background: "var(--surface-page)" }}>
      <Sidebar active={nav} onSelect={setNav} location="Downtown location" onLocationClick={() => {}} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "var(--space-8)", boxSizing: "border-box", overflow: "auto", position: "relative" }}>
        {nav === "schedule" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
            <div>
              <div style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
                Schedule
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <Badge tone={published ? "success" : "warning"}>{published ? "Published" : "Draft"}</Badge>
                {conflictCount > 0 && <ConflictChip>{conflictCount} conflict{conflictCount > 1 ? "s" : ""} to resolve</ConflictChip>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary">Add shift</Button>
              <Button variant="primary" onClick={() => setPublishOpen(true)}>
                Publish schedule
              </Button>
            </div>
          </div>
        )}

        {nav === "dashboard" && (
          <DashboardScreen
            conflictCount={conflictCount}
            onGoSchedule={() => setNav("schedule")}
            onGoTimeOff={() => setNav("timeoff")}
            onGoSwaps={() => setNav("swaps")}
          />
        )}

        {nav === "schedule" && <ScheduleView shiftsByCell={shifts} onCellClick={cellClick} />}

        {nav === "availability" && <AvailabilityOverview />}

        {nav === "swaps" && <SwapApprovals />}

        {nav === "team" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TEAM.map((t) => (
              <Card key={t.name} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <AvatarStatus name={t.name} status={t.status} />
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{t.role}</div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {nav === "timeoff" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TIME_OFF.map((r) => (
              <Card key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{r.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
                    {r.range} · {r.reason}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" size="sm">Deny</Button>
                  <Button variant="secondary" size="sm">Approve</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {toast && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200 }}>
            <Toast tone="success" title={toast.title} description={toast.description} onClose={() => setToast(null)} />
          </div>
        )}
      </div>

      <AssignShiftDialog
        open={!!dialog}
        role={dialog && dialog.role}
        day={dialog && dialog.day}
        existing={dialog && dialog.existing}
        onClose={() => setDialog(null)}
        onSave={saveShift}
        onDelete={deleteShift}
      />

      {publishOpen && (
        <Dialog
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          title="Publish this week's schedule?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={publish}>Publish</Button>
            </>
          }
        >
          5 employees will be notified by push and text as soon as you publish.
        </Dialog>
      )}
    </div>
  );
}

window.__rh_manager = { ManagerApp };

})();
