"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toaster";

export function DropRequestButton({
  shiftId,
  shiftLabel,
  hasPendingDrop,
}: {
  shiftId: string;
  shiftLabel: string;
  hasPendingDrop: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (hasPendingDrop) {
    return (
      <Button variant="ghost" fullWidth disabled>
        Drop requested
      </Button>
    );
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/drop-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setOpen(false);
      toast({ tone: "success", title: "Drop request sent", description: "Your manager will review it." });
      router.refresh();
    } catch {
      setError("Something went wrong sending your request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" fullWidth onClick={() => setOpen(true)}>
        Ask to drop this shift
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Ask to drop this shift"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={submit}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-sans)" }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            If your manager approves, you&apos;re taken off the {shiftLabel} and it becomes an open shift for
            teammates to claim.
          </p>
          <Textarea
            label="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I have a conflict that day."
            rows={3}
          />
          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
              {error}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
