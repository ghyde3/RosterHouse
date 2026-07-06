"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatDurationHrs } from "@/lib/time";
import type { TimeClockState } from "@/lib/timeclock";
import styles from "./TimeClock.module.css";

type Phase =
  | { kind: "out" }
  | { kind: "in"; clockInAt: string; positionName: string | null }
  | { kind: "summary"; hoursToday: number };

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // denied, unavailable, or timed out — punch anyway
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

function formatElapsed(fromIso: string, nowMs: number): string {
  const total = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

export function TimeClock({ initial }: { initial: TimeClockState }) {
  const [phase, setPhase] = useState<Phase>(
    initial.activeEntry
      ? { kind: "in", clockInAt: initial.activeEntry.clockInAt, positionName: initial.activeEntry.positionName }
      : { kind: "out" },
  );
  const [busy, setBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const clockedIn = phase.kind === "in";

  useEffect(() => {
    if (!clockedIn) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clockedIn]);

  async function punch() {
    setBusy(true);
    setError(null);
    setGeoNote(null);
    const coords = await getPosition();
    const endpoint = clockedIn ? "/api/time-clock/clock-out" : "/api/time-clock/clock-in";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords ?? {}),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      if (clockedIn) {
        setPhase({ kind: "summary", hoursToday: json.data.hoursToday });
        if (coords === null) {
          setGeoNote("We couldn't get your location — you're still clocked out; your manager may follow up.");
        } else if (json.data.locationVerified === false) {
          setGeoNote("Your location looks out of range — you're still clocked out; your manager may follow up.");
        }
      } else {
        setPhase({ kind: "in", clockInAt: json.data.clockInAt, positionName: json.data.positionName });
        if (coords === null) {
          setGeoNote("We couldn't get your location — you're still clocked in; your manager may follow up.");
        } else if (json.data.locationVerified === false) {
          setGeoNote("Your location looks out of range — you're still clocked in; your manager may follow up.");
        }
      }
    } catch {
      setError("Something went wrong. You may not be clocked " + (clockedIn ? "out" : "in") + " — try again.");
    } finally {
      setBusy(false);
    }
  }

  const statusLine = clockedIn
    ? `Clocked in${phase.kind === "in" && phase.positionName ? ` for ${phase.positionName}` : ""} · ${initial.locationName}`
    : "You're not clocked in right now.";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "18px 20px 20px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)", margin: 0 }}>
        Time clock
      </h1>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{statusLine}</div>

        {clockedIn && phase.kind === "in" && (
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {formatElapsed(phase.clockInAt, nowMs)}
          </div>
        )}

        <button
          type="button"
          className={`${styles.clockButton}${clockedIn ? ` ${styles.clockedIn}` : ""}`}
          disabled={busy}
          onClick={punch}
        >
          <Icon name={clockedIn ? "square" : "play"} size={28} />
          {busy ? "One moment…" : clockedIn ? "Clock out" : "Clock in"}
        </button>

        {phase.kind === "summary" && (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              Clocked out — {formatDurationHrs(phase.hoursToday)} today.
            </p>
          </Card>
        )}

        {phase.kind === "out" && initial.todayShift && (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              Today: {initial.todayShift.positionName}, {initial.todayShift.timeLabel}
            </p>
          </Card>
        )}

        {geoNote && (
          <p role="status" style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            {geoNote}
          </p>
        )}
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)", margin: 0 }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
          Uses your phone's location to confirm you're on-site.
        </p>
      </div>
    </div>
  );
}
