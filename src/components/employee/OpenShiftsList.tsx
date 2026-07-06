"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toaster";
import type { OpenShiftItem } from "@/lib/requests";

export function OpenShiftsList({ items }: { items: OpenShiftItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyState title="No open shifts right now" description="New shifts your manager posts show up here first." />;
  }

  async function claim(item: OpenShiftItem) {
    setBusyId(item.shiftId);
    try {
      const res = await fetch(`/api/open-shifts/${item.shiftId}/claims`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        toast({ tone: "danger", title: "Couldn't request that shift", description: json.error.message });
        return;
      }
      setRequested((r) => ({ ...r, [item.shiftId]: true }));
      toast({ tone: "success", title: "Request sent", description: "Your manager will review it." });
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't request that shift", description: "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => {
        const pending = item.myClaimStatus === "pending" || requested[item.shiftId];
        return (
          <Card key={item.shiftId}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "var(--font-sans)" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.dayLabel}</div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{item.positionName}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.timeLabel}</div>
                {!item.qualified && (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Ask your manager to add the {item.positionName} position to pick this up.
                  </div>
                )}
              </div>
              {pending ? (
                <Badge tone="warning">Requested</Badge>
              ) : item.myClaimStatus === "denied" ? (
                <Badge tone="neutral">Denied</Badge>
              ) : (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={!item.qualified || busyId === item.shiftId}
                  onClick={() => claim(item)}
                >
                  Claim
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
