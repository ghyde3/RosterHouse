"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { TimeField } from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toaster";
import type { AvailabilityExceptionDto } from "@/lib/queries/availability-exceptions";
import { formatDayFull, hhmmTo12h, parse12hToHhmm } from "@/lib/time-format";
import s from "./availability.module.css";
import ui from "@/components/employee/employee.module.css";

function exceptionLabel(e: AvailabilityExceptionDto): string {
  if (!e.isAvailable) return "Unavailable";
  if (e.startTime && e.endTime) {
    return `Available ${hhmmTo12h(e.startTime)} – ${hhmmTo12h(e.endTime)}`;
  }
  return "Available all day";
}

export function ExceptionsSection({
  exceptions,
  todayISO,
}: {
  exceptions: AvailabilityExceptionDto[];
  todayISO: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [available, setAvailable] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function add() {
    if (!date) {
      setError("Pick a date.");
      return;
    }
    let startTime: string | null = null;
    let endTime: string | null = null;
    if (available && (start.trim() !== "" || end.trim() !== "")) {
      if (start.trim() === "" || end.trim() === "") {
        setError("Enter both a start and end time, or leave both blank for all day.");
        return;
      }
      startTime = parse12hToHhmm(start);
      endTime = parse12hToHhmm(end);
      if (!startTime || !endTime) {
        setError("Enter times like 9:00 AM.");
        return;
      }
      if (startTime >= endTime) {
        setError("End time must be after start time.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/availability/exceptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          isAvailable: available,
          startTime,
          endTime,
          note: note.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error.message);
        return;
      }
      setDate("");
      setAvailable(false);
      setStart("");
      setEnd("");
      setNote("");
      toast({ tone: "success", title: "Exception saved" });
      router.refresh();
    } catch {
      setError("Something went wrong saving the exception. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: string) {
    setRemoving(d);
    try {
      const res = await fetch("/api/me/availability/exceptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: d }),
      });
      const body = await res.json();
      if (!body.ok) {
        toast({ tone: "danger", title: "Couldn't remove the exception", description: body.error.message });
        return;
      }
      router.refresh();
    } catch {
      toast({
        tone: "danger",
        title: "Couldn't remove the exception",
        description: "Check your connection and try again.",
      });
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className={s.exceptionsSection}>
      <h3 className={ui.sectionTitle}>Exceptions</h3>
      <div className={ui.muted}>
        One-off changes for specific dates. An exception overrides your weekly availability for
        that day.
      </div>

      {exceptions.length > 0 && (
        <Card>
          <div className={ui.cardStack}>
            {exceptions.map((e) => (
              <div key={e.date} className={s.exceptionRow}>
                <div>
                  <div className={s.exceptionDate}>{formatDayFull(e.date)}</div>
                  <div className={s.exceptionMeta}>
                    {exceptionLabel(e)}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removing === e.date}
                  onClick={() => remove(e.date)}
                >
                  {removing === e.date ? "Removing…" : "Remove"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className={ui.cardStack}>
          <Input
            label="Date"
            type="date"
            min={todayISO}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Switch
            label="Available this day"
            checked={available}
            onChange={(next) => {
              setAvailable(next);
              setError(null);
            }}
          />
          {available && (
            <>
              <div className={s.times}>
                <div className={s.timeField}>
                  <TimeField label="Start" placeholder="9:00 AM" value={start} onChange={setStart} />
                </div>
                <div className={s.timeField}>
                  <TimeField label="End" placeholder="5:00 PM" value={end} onChange={setEnd} />
                </div>
              </div>
              <div className={s.hint}>Leave both times blank if you&apos;re available all day.</div>
            </>
          )}
          <Input
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Doctor appointment"
          />
          {error && (
            <div className={s.dayError} role="alert">
              {error}
            </div>
          )}
          <Button variant="secondary" fullWidth disabled={busy} onClick={add}>
            {busy ? "Saving…" : "Add exception"}
          </Button>
        </div>
      </Card>
    </section>
  );
}
