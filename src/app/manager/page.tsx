import { requireManager } from "@/lib/auth";
import { Card } from "@/components/ui/Card";

export default async function ManagerDashboardPage() {
  const user = await requireManager();
  const firstName = user.name.split(" ")[0] || "there";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Dashboard
      </h1>
      <Card>
        <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Welcome, {firstName}.</p>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          Schedule insights will appear here. Start by inviting your team on the team page.
        </p>
      </Card>
    </div>
  );
}
