"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { TimeOffItem } from "@/lib/requests";

export function TimeOffApprovals({ pending, decided }: { pending: TimeOffItem[]; decided: TimeOffItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denying, setDenying] = useState<TimeOffItem | null>(null);
  const [denyNote, setDenyNote] = useState("");

  async function decide(request: TimeOffItem, decision: "approve" | "deny", note?: string) {
    setBusyId(request.id);
    try {
      const res = await fetch(`/api/time-off/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ tone: "danger", title: "Couldn't save that decision", description: json.error.message });
        return;
      }
      toast({
        tone: "success",
        title: decision === "approve" ? "Time off approved" : "Request denied",
        description: `${request.employeeName} will be notified.`,
      });
      setDenying(null);
      setDenyNote("");
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't save that decision", description: "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "var(--font-sans)" }}>
      {pending.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>All caught up — no pending requests.</p>
      )}
      {pending.map((r) => (
        <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.employeeName}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {r.rangeLabel} · {r.reasonLabel}
              {r.note ? ` · ${r.note}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <Button variant="ghost" size="sm" disabled={busyId === r.id} onClick={() => setDenying(r)}>
              Deny
            </Button>
            <Button variant="secondary" size="sm" disabled={busyId === r.id} onClick={() => decide(r, "approve")}>
              Approve
            </Button>
          </div>
        </Card>
      ))}

      <h2
        style={{
          fontSize: "var(--text-h3-size)",
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "18px 0 0",
        }}
      >
        Decided in the last 30 days
      </h2>
      {decided.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>No decisions in the last 30 days.</p>
      )}
      {decided.map((r) => (
        <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.employeeName}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {r.rangeLabel} · {r.reasonLabel}
            </div>
          </div>
          <StatusBadge status={r.status as "approved" | "denied"} />
        </Card>
      ))}

      <Dialog
        open={denying !== null}
        onClose={() => {
          setDenying(null);
          setDenyNote("");
        }}
        title="Deny this request?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDenying(null);
                setDenyNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busyId !== null}
              onClick={() => denying && decide(denying, "deny", denyNote)}
            >
              Deny request
            </Button>
          </>
        }
      >
        {denying && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-sans)" }}>
            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0 }}>
              {denying.employeeName} asked for {denying.rangeLabel} ({denying.reasonLabel.toLowerCase()}).
            </p>
            <Textarea
              label="Add a note (optional)"
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              placeholder="e.g. That week is fully booked already."
              rows={3}
            />
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              The note is included in the notification {denying.employeeName} receives.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
