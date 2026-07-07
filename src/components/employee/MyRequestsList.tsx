// Server-safe: no state, no handlers.
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { MyRequestItem } from "@/lib/requests";

export function MyRequestsList({ items }: { items: MyRequestItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No requests yet" description="Swap, drop, and claim requests you send show up here." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <Card key={`${item.kind}-${item.id}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "var(--font-sans)" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.detail}</div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}
