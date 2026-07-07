"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toaster";
import styles from "@/components/employee/employee.module.css";

export function CalendarFeed({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  // Origin is browser-only; useSyncExternalStore renders "" on the server and
  // the real origin after hydration without a setState-in-effect cascade.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const feedUrl = token && origin ? `${origin}/api/calendar/${token}` : null;

  async function regenerate() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/calendar-token", { method: "POST" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      setToken(body.data.token);
      toast({
        tone: "success",
        title: token ? "Calendar link reset" : "Calendar link created",
        description: token ? "The old link no longer works." : undefined,
      });
    } catch {
      toast({
        tone: "danger",
        title: "Couldn't update your calendar link",
        description: "Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast({ tone: "success", title: "Link copied" });
    } catch {
      toast({ tone: "danger", title: "Couldn't copy the link" });
    }
  }

  return (
    <Card>
      <div className={styles.cardStack}>
        <div className={styles.muted}>
          Subscribe to your shifts in your phone&apos;s calendar app.
        </div>
        {token ? (
          <>
            <Input label="Feed URL" value={feedUrl ?? ""} readOnly />
            <div className={styles.cardRow}>
              <Button size="sm" onClick={copyLink}>
                Copy link
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={regenerate}>
                Reset link
              </Button>
            </div>
            <div className={styles.muted}>
              Resetting creates a new link and the old one stops working.
            </div>
          </>
        ) : (
          <div className={styles.cardRow}>
            <div className={styles.muted}>No calendar link yet.</div>
            <Button size="sm" disabled={busy} onClick={regenerate}>
              Create link
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
