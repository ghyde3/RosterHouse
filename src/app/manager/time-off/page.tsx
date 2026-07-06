import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { listDecidedTimeOff, listTimeOff } from "@/lib/requests";
import { TimeOffApprovals } from "@/components/manager/TimeOffApprovals";

export default async function ManagerTimeOffPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const [pending, decided] = await Promise.all([
    listTimeOff(location.id, "pending"),
    listDecidedTimeOff(location.id),
  ]);

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <h1
        style={{
          fontSize: "var(--text-h1-size)",
          fontWeight: "var(--text-h1-weight)",
          color: "var(--text-primary)",
          margin: "0 0 6px",
        }}
      >
        Time off
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 18px" }}>
        Review time-off requests before the schedule is built around them.
      </p>
      <TimeOffApprovals pending={pending} decided={decided} />
    </div>
  );
}
