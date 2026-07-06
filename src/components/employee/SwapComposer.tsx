"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";
import type { Coworker } from "@/lib/requests";

export function SwapComposer({
  shiftId,
  shiftLabel,
  coworkers,
  alreadyPending,
}: {
  shiftId: string;
  shiftLabel: string;
  coworkers: Coworker[];
  alreadyPending: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<"anyone" | "specific">("anyone");
  const [covererId, setCovererId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (target === "specific" && !covererId) {
      setError("Pick a coworker, or choose anyone qualified.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/swap-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coveringEmployeeProfileId: target === "specific" ? covererId : null,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      toast({ tone: "success", title: "Request sent", description: "Your manager will review it." });
      router.push("/swaps");
      router.refresh();
    } catch {
      setError("Something went wrong sending your request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const radioRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "var(--text-primary)",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "18px 20px 20px", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", margin: 0 }}>
        Request swap
      </h1>
      <Card>
        <div style={{ fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{shiftLabel}</div>
      </Card>

      {alreadyPending ? (
        <>
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              A swap request for this shift is already waiting for review.
            </p>
          </Card>
          <Button variant="ghost" fullWidth onClick={() => router.push("/swaps")}>
            View my requests
          </Button>
        </>
      ) : (
        <>
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <legend
              style={{
                fontSize: "var(--text-label-size)",
                fontWeight: "var(--text-label-weight)",
                color: "var(--text-primary)",
                padding: 0,
                marginBottom: 4,
              }}
            >
              Who should cover it?
            </legend>
            <label style={radioRow}>
              <input
                type="radio"
                name="swap-target"
                value="anyone"
                checked={target === "anyone"}
                onChange={() => setTarget("anyone")}
              />
              Anyone qualified
            </label>
            <label style={{ ...radioRow, ...(coworkers.length === 0 ? { color: "var(--text-tertiary)", cursor: "default" } : {}) }}>
              <input
                type="radio"
                name="swap-target"
                value="specific"
                checked={target === "specific"}
                disabled={coworkers.length === 0}
                onChange={() => setTarget("specific")}
              />
              A specific coworker
            </label>
          </fieldset>

          {coworkers.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              No qualified coworkers for this position yet, so the request goes out to anyone qualified.
            </p>
          )}

          {target === "specific" && coworkers.length > 0 && (
            <Select
              label="Coworker"
              value={covererId}
              onChange={setCovererId}
              placeholder="Pick a coworker"
              options={coworkers.map((c) => ({ value: c.profileId, label: c.name }))}
            />
          )}

          <Textarea
            label="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Doctor appointment that afternoon."
            rows={3}
          />

          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
              {error}
            </div>
          )}

          <Button variant="primary" fullWidth size="lg" disabled={busy} onClick={submit}>
            {busy ? "Sending…" : "Send request"}
          </Button>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Your manager approves swaps before they take effect.
          </p>
        </>
      )}
    </div>
  );
}
