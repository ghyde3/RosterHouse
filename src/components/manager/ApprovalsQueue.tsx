"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toaster";
import type { ApprovalItem } from "@/lib/requests";

export function ApprovalsQueue({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0, fontFamily: "var(--font-sans)" }}>
        All caught up — no pending requests.
      </p>
    );
  }

  async function decide(item: ApprovalItem, decision: "approve" | "deny") {
    setBusyId(item.id);
    try {
      const url = item.kind === "swap" ? `/api/swap-requests/${item.id}` : `/api/open-shift-claims/${item.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ tone: "danger", title: "Couldn't save that decision", description: json.error.message });
        return;
      }
      const warnings: { message: string }[] = json.data.warnings ?? [];
      if (decision === "approve" && warnings.length > 0) {
        toast({
          tone: "warning",
          title: "Approved with a conflict",
          description: warnings.map((w) => w.message).join(" "),
        });
      } else {
        toast({
          tone: "success",
          title: decision === "approve" ? "Request approved" : "Request denied",
          description: `${item.employeeName} will be notified.`,
        });
      }
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't save that decision", description: "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "var(--font-sans)" }}>
      {items.map((item) => (
        <Card key={`${item.kind}-${item.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.employeeName}</span>
              <Badge tone={item.kind === "swap" ? "info" : "warning"}>
                {item.kind === "swap" ? "Swap" : "Open shift"}
              </Badge>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.detail}</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
              {item.subDetail}
              {item.note ? ` · "${item.note}"` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <Button variant="ghost" size="sm" disabled={busyId === item.id} onClick={() => decide(item, "deny")}>
              Deny
            </Button>
            <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => decide(item, "approve")}>
              Approve
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
