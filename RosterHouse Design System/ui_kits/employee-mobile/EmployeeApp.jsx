(function () {
const { useState } = React;
const { Button, Badge, Card, Switch, Dialog, ConflictChip, Tag, Input, Tabs, Select } = window.RosterHouseDesignSystem_17c92d;

const MY_SHIFTS = [
  { role: "Line cook", time: "7:00 AM – 3:00 PM", day: "Today · Tue Jul 7", location: "Downtown location", status: "confirmed", coworkers: ["Sam Torres", "Alex Kim"], notes: "Bring your own knife kit." },
  { role: "Line cook", time: "7:00 AM – 3:00 PM", day: "Wed Jul 8", location: "Downtown location", status: "confirmed", coworkers: ["Priya Shah"], notes: "" },
  { role: "Line cook", time: "2:00 PM – 8:00 PM", day: "Fri Jul 10", location: "Downtown location", status: "confirmed", coworkers: ["Jordan Park", "Sam Torres"], notes: "Inventory count at close." },
];

const OPEN_SHIFTS = [
  { role: "Server", time: "4:00 PM – 10:00 PM", day: "Sat Jul 12" },
  { role: "Dishwasher", time: "6:00 PM – 12:00 AM", day: "Sun Jul 13" },
];

const NOTIFICATIONS = [
  { title: "Schedule published", body: "Your manager published next week's schedule.", tone: "success", when: "2h ago" },
  { title: "Shift reminder", body: "Your Line cook shift starts at 7:00 AM tomorrow.", tone: "info", when: "1d ago" },
  { title: "Swap request approved", body: "Sam Torres will cover your Fri shift.", tone: "success", when: "2d ago" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function TopBar({ title, onBack, onBell }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <i onClick={onBack} data-lucide="chevron-left" style={{ width: 22, height: 22, color: "var(--text-primary)", cursor: "pointer" }}></i>
        )}
        <div style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
          {title}
        </div>
      </div>
      {onBell && <i onClick={onBell} data-lucide="bell" style={{ width: 22, height: 22, color: "var(--text-primary)", cursor: "pointer" }}></i>}
    </div>
  );
}

function LoginScreen({ onLogin, onGoInvite }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "72px 24px 24px", height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-brand)", fontFamily: "var(--font-sans)" }}>RosterHouse</div>
      <div style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginTop: 12 }}>
        Log in
      </div>
      <Input label="Phone or email" placeholder="maria@example.com" />
      <Input label="Password" type="password" placeholder="••••••••" />
      <Button variant="primary" fullWidth size="lg" onClick={onLogin}>Log in</Button>
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
        Forgot password?
      </div>
      <div
        onClick={onGoInvite}
        style={{ marginTop: "auto", textAlign: "center", fontSize: 14, color: "var(--text-brand)", fontWeight: 600, fontFamily: "var(--font-sans)", cursor: "pointer" }}
      >
        New here? Accept your invite
      </div>
    </div>
  );
}

function AcceptInviteScreen({ onJoin, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 24px", height: "100%", boxSizing: "border-box" }}>
      <TopBar title="Accept invite" onBack={onBack} />
      <div style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
        Jamie Park invited you to join <strong style={{ color: "var(--text-primary)" }}>Downtown location</strong> on RosterHouse.
      </div>
      <Input label="Full name" placeholder="Maria Garcia" />
      <Input label="Phone number" placeholder="(555) 123-4567" />
      <Input label="Create password" type="password" placeholder="••••••••" />
      <Button variant="primary" fullWidth size="lg" onClick={onJoin} style={{ marginTop: 8 }}>
        Join team
      </Button>
    </div>
  );
}

function HomeScreen({ onOpenShift, onBell }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 20px 20px" }}>
      <TopBar title="Hi, Maria" onBell={onBell} />
      <div
        style={{
          background: "var(--surface-brand)",
          color: "var(--text-inverse)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-6)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700 }}>You're all set for this week.</div>
        <div style={{ fontSize: 13, color: "var(--green-200)", marginTop: 4 }}>3 shifts · 24 hrs total</div>
      </div>

      <div style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginTop: 6 }}>
        Upcoming shifts
      </div>
      {MY_SHIFTS.map((s, i) => (
        <Card key={i} hoverable style={{ cursor: "pointer" }}>
          <div onClick={() => onOpenShift(s)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{s.day}</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{s.role}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{s.time}</div>
            </div>
            <Badge tone="success">Confirmed</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ShiftDetailScreen({ shift, onBack }) {
  if (!shift) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 20px 20px" }}>
      <TopBar title="Shift detail" onBack={onBack} />
      <Card>
        <div style={{ fontFamily: "var(--font-sans)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{shift.day}</div>
          <div style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{shift.role}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>{shift.time}</div>
          <div style={{ marginTop: 10 }}><Badge tone="success">Confirmed</Badge></div>
        </div>
      </Card>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "var(--font-sans)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)" }}>
            <i data-lucide="map-pin" style={{ width: 16, height: 16, color: "var(--text-secondary)" }}></i>
            {shift.location}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)" }}>
            <i data-lucide="users" style={{ width: 16, height: 16, color: "var(--text-secondary)" }}></i>
            With {shift.coworkers.join(", ")}
          </div>
        </div>
      </Card>
      {shift.notes && (
        <Card>
          <div style={{ fontFamily: "var(--font-sans)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Note from your manager</div>
            <div style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 4 }}>{shift.notes}</div>
          </div>
        </Card>
      )}
      <Button variant="ghost" fullWidth>Request swap</Button>
    </div>
  );
}

const AVAILABILITY_PRESETS = [
  { key: "everyday", label: "Every day", days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true } },
  { key: "weekdays", label: "Weekdays only", days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false } },
  { key: "weekends", label: "Weekends only", days: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: true, Sun: true } },
];

function AvailabilityScreen() {
  const [mode, setMode] = useState("simple"); // simple | advanced
  const [avail, setAvail] = useState({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false });
  const [hours, setHours] = useState({
    Mon: { start: "9:00 AM", end: "5:00 PM" }, Tue: { start: "9:00 AM", end: "5:00 PM" }, Wed: { start: "9:00 AM", end: "5:00 PM" },
    Thu: { start: "9:00 AM", end: "5:00 PM" }, Fri: { start: "9:00 AM", end: "5:00 PM" }, Sat: { start: "9:00 AM", end: "5:00 PM" }, Sun: { start: "9:00 AM", end: "5:00 PM" },
  });
  const [reqOpen, setReqOpen] = useState(false);
  const [reqStart, setReqStart] = useState("");
  const [reqEnd, setReqEnd] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqNote, setReqNote] = useState("");

  function applyPreset(preset) {
    setAvail(preset.days);
  }

  function setHour(day, field, value) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [field]: value } }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 20px 20px" }}>
      <TopBar title="Availability" />
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
        Your weekly availability repeats every week until you change it.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {AVAILABILITY_PRESETS.map((p) => (
          <Button key={p.key} variant="secondary" size="sm" onClick={() => applyPreset(p)}>
            {p.label}
          </Button>
        ))}
      </div>

      <Tabs
        tabs={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Advanced" }]}
        defaultValue="simple"
        onChange={setMode}
      />

      {mode === "simple" && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DAYS.map((d) => (
              <Switch key={d} label={d} checked={avail[d]} onChange={(v) => setAvail((a) => ({ ...a, [d]: v }))} />
            ))}
          </div>
        </Card>
      )}

      {mode === "advanced" && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ display: "flex", flexDirection: "column", gap: avail[d] ? 10 : 0 }}>
                <Switch label={d} checked={avail[d]} onChange={(v) => setAvail((a) => ({ ...a, [d]: v }))} />
                {avail[d] && (
                  <div style={{ display: "flex", gap: 8, paddingLeft: 2 }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        placeholder="9:00 AM"
                        value={hours[d].start}
                        onChange={(e) => setHour(d, "start", e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input
                        placeholder="5:00 PM"
                        value={hours[d].end}
                        onChange={(e) => setHour(d, "end", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button variant="secondary" fullWidth onClick={() => setReqOpen(true)}>
        Request time off
      </Button>

      <Dialog
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="Request time off"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setReqOpen(false)}>Send request</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label="Start date" type="date" value={reqStart} onChange={(e) => setReqStart(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="End date" type="date" value={reqEnd} onChange={(e) => setReqEnd(e.target.value)} />
            </div>
          </div>
          <Select
            label="Reason"
            value={reqReason}
            onChange={setReqReason}
            placeholder="Select a reason"
            options={[
              { value: "vacation", label: "Vacation" },
              { value: "sick", label: "Sick" },
              { value: "personal", label: "Personal" },
              { value: "other", label: "Other" },
            ]}
          />
          {reqReason === "other" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "var(--text-label-size)", fontWeight: "var(--text-label-weight)", color: "var(--text-primary)" }}>
                Tell your manager why
              </label>
              <textarea
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder="e.g. Family emergency, moving day…"
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  background: "var(--surface-card)",
                  border: "1.5px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-body-size)",
                  color: "var(--text-primary)",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>
          )}
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Your manager will review this request. You'll get a push notification once it's approved or denied.
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function SwapScreen() {
  const [claimed, setClaimed] = useState({});
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 20px 20px" }}>
      <TopBar title="Open shifts" />
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
        Claim an open shift, or ask a teammate to cover one of yours.
      </div>
      {OPEN_SHIFTS.map((s, i) => (
        <Card key={i}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{s.day}</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{s.role}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{s.time}</div>
            </div>
            <Button variant={claimed[i] ? "secondary" : "accent"} size="sm" disabled={!!claimed[i]} onClick={() => setClaimed((c) => ({ ...c, [i]: true }))}>
              {claimed[i] ? "Claimed" : "Claim"}
            </Button>
          </div>
        </Card>
      ))}

      <div style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginTop: 6 }}>
        My shifts
      </div>
      {MY_SHIFTS.slice(0, 2).map((s, i) => (
        <Card key={i}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{s.day}</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{s.role}</div>
            </div>
            <Button variant="ghost" size="sm">Request swap</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function NotificationsScreen({ onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 20px 20px" }}>
      <TopBar title="Notifications" onBack={onBack} />
      {NOTIFICATIONS.map((n, i) => (
        <Card key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{n.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{n.body}</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-sans)", flex: "none" }}>{n.when}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TimeClockScreen() {
  const [clockedIn, setClockedIn] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 20px 20px" }}>
      <TopBar title="Time clock" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
        {clockedIn ? "Clocked in for Line cook · Downtown location" : "You're not clocked in right now."}
      </div>
      <div
        onClick={() => setClockedIn((c) => !c)}
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: clockedIn ? "var(--status-danger-bg)" : "var(--surface-brand)",
          color: clockedIn ? "var(--status-danger)" : "var(--text-inverse)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 6,
          margin: "20px 0",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: 18,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <i data-lucide={clockedIn ? "square" : "play"} style={{ width: 28, height: 28 }}></i>
        {clockedIn ? "Clock out" : "Clock in"}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-sans)" }}>
        Uses your phone's location to confirm you're on-site.
      </div>
      </div>
    </div>
  );
}

function ProfileScreen() {
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 20px 20px" }}>
      <TopBar title="Profile" />
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-sans)" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--green-100)", color: "var(--green-800)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            MG
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Maria Garcia</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Line cook · Downtown location</div>
          </div>
        </div>
      </Card>
      <div style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
        Notification preferences
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Switch label="Push notifications" checked={push} onChange={setPush} />
          <Switch label="Text messages (SMS)" checked={sms} onChange={setSms} />
          <Switch label="Email" checked={email} onChange={setEmail} />
        </div>
      </Card>
      <Button variant="ghost" fullWidth>Log out</Button>
    </div>
  );
}

const TABS = [
  { key: "home", label: "Shifts", icon: "calendar" },
  { key: "availability", label: "Availability", icon: "calendar-check" },
  { key: "clock", label: "Clock", icon: "timer" },
  { key: "swap", label: "Open shifts", icon: "repeat" },
  { key: "profile", label: "Profile", icon: "user" },
];

function PhoneShell({ children }) {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        background: "var(--surface-page)",
        borderRadius: 36,
        border: "8px solid var(--neutral-900)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {children}
    </div>
  );
}

function EmployeeApp() {
  const [auth, setAuth] = useState("login"); // login | invite | app
  const [tab, setTab] = useState("home");
  const [push, setPush] = useState(null); // { type: 'shiftDetail'|'notifications', shift? }

  React.useEffect(() => {
    window.lucide && window.lucide.createIcons();
  });

  if (auth === "login") {
    return (
      <PhoneShell>
        <div style={{ flex: 1, overflow: "auto" }}>
          <LoginScreen onLogin={() => setAuth("app")} onGoInvite={() => setAuth("invite")} />
        </div>
      </PhoneShell>
    );
  }
  if (auth === "invite") {
    return (
      <PhoneShell>
        <div style={{ flex: 1, overflow: "auto" }}>
          <AcceptInviteScreen onJoin={() => setAuth("app")} onBack={() => setAuth("login")} />
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div style={{ flex: 1, overflow: "auto" }}>
        {push && push.type === "shiftDetail" && <ShiftDetailScreen shift={push.shift} onBack={() => setPush(null)} />}
        {push && push.type === "notifications" && <NotificationsScreen onBack={() => setPush(null)} />}
        {!push && tab === "home" && <HomeScreen onOpenShift={(s) => setPush({ type: "shiftDetail", shift: s })} onBell={() => setPush({ type: "notifications" })} />}
        {!push && tab === "availability" && <AvailabilityScreen />}
        {!push && tab === "clock" && <TimeClockScreen />}
        {!push && tab === "swap" && <SwapScreen />}
        {!push && tab === "profile" && <ProfileScreen />}
      </div>
      {!push && (
        <div
          style={{
            display: "flex",
            borderTop: "1px solid var(--border-default)",
            background: "var(--surface-card)",
            padding: "8px 4px 14px",
          }}
        >
          {TABS.map((t) => (
            <div
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                color: tab === t.key ? "var(--text-brand)" : "var(--text-tertiary)",
                fontFamily: "var(--font-sans)",
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              <i data-lucide={t.icon} style={{ width: 19, height: 19 }}></i>
              {t.label}
            </div>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

window.__rh_employee = { EmployeeApp };

})();
