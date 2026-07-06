import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function EmployeeHomePage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0] || "there";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px 20px" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Hi, {firstName}
      </h1>
      <EmptyState
        title="No shifts to show yet"
        description="Your shifts will appear here once your manager publishes a schedule."
      />
    </div>
  );
}
