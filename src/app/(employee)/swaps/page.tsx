import { requireUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/lib/authz";
import { listMyRequests, listMyUpcomingShifts, listOpenShiftsForEmployee } from "@/lib/requests";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OpenShiftsList } from "@/components/employee/OpenShiftsList";
import { MyRequestsList } from "@/components/employee/MyRequestsList";
import { RequestSwapButton } from "@/components/employee/RequestSwapButton";

const h = (text: string) => (
  <h2 style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)", margin: "6px 0 0" }}>
    {text}
  </h2>
);

export default async function SwapsPage() {
  const user = await requireUser();
  const profile = await getEmployeeProfile(user.id);
  const [openShifts, myShifts, myRequests] = await Promise.all([
    listOpenShiftsForEmployee(profile.id),
    listMyUpcomingShifts(profile.id),
    listMyRequests(profile.id),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px 20px", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", margin: 0 }}>
        Open shifts
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        Claim an open shift, or ask a teammate to cover one of yours.
      </p>
      <OpenShiftsList items={openShifts} />

      {h("My shifts")}
      {myShifts.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>No upcoming shifts.</p>
      )}
      {myShifts.map((s) => (
        <Card key={s.shiftId}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.dayLabel}</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{s.positionName}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.timeLabel}</div>
            </div>
            {s.hasPendingSwap ? (
              <Badge tone="warning">Swap pending</Badge>
            ) : (
              <RequestSwapButton shiftId={s.shiftId} size="sm" fullWidth={false} />
            )}
          </div>
        </Card>
      ))}

      {h("My requests")}
      <MyRequestsList items={myRequests} />
    </div>
  );
}
