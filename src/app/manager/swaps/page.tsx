import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { listPendingApprovals } from "@/lib/requests";
import { ApprovalsQueue } from "@/components/manager/ApprovalsQueue";

export default async function ManagerSwapsPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const approvals = await listPendingApprovals(location.id);

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
        Swaps &amp; open shifts
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 18px" }}>
        Approve shift swaps, drops, and claims before they take effect.
      </p>
      <ApprovalsQueue items={approvals} />
    </div>
  );
}
