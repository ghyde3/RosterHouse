"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { TimeOffItem } from "@/lib/requests";

const REASON_OPTIONS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

export function TimeOffSection({ requests }: { requests: TimeOffItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setStartDate("");
    setEndDate("");
    setReason("");
    setNote("");
    setError(null);
  }

  async function submit() {
    if (!startDate || !endDate) {
      setError("Pick a start and end date.");
      return;
    }
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      close();
      toast({ tone: "success", title: "Request sent", description: "Your manager will review it." });
      router.refresh();
    } catch {
      setError("Something went wrong sending your request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "var(--font-sans)" }}>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        Request time off
      </Button>

      {requests.length > 0 && (
        <>
          <h3
            style={{
              fontSize: "var(--text-h3-size)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "6px 0 0",
            }}
          >
            Time off
          </h3>
          {requests.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.rangeLabel}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {r.reasonLabel}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            </Card>
          ))}
        </>
      )}

      <Sheet
        open={open}
        onClose={close}
        title="Request time off"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={submit}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Select
            label="Reason"
            value={reason}
            onChange={setReason}
            placeholder="Select a reason"
            options={REASON_OPTIONS}
          />
          {reason === "other" && (
            <Textarea
              label="Tell your manager why"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Family emergency, moving day…"
              rows={3}
            />
          )}
          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
              {error}
            </div>
          )}
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Your manager will review this request. You&apos;ll get a notification once it&apos;s decided.
          </p>
        </div>
      </Sheet>
    </section>
  );
}
