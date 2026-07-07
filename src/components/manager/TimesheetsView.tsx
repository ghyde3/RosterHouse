"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { DatePager } from "@/components/chrome/DatePager";
import { TimeField } from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toaster";
import {
  formatTime,
  localISODate,
  localToUtc,
  parseTime12h,
} from "@/lib/time";
import type {
  TimesheetEmployee,
  TimesheetEntry,
  TimesheetWeekData,
} from "@/lib/timesheet-data";
import styles from "./TimesheetsView.module.css";

export type TimesheetsViewProps = {
  locationId: string;
  timezone: string;
  weekStart: string;
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  data: TimesheetWeekData;
};

export function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  return `$${Math.round(cost).toLocaleString("en-US")}`;
}

/** ISO instant → location-local "1:00 PM" (NOT the browser's timezone). */
function clockLabel(iso: string, timezone: string): string {
  return formatTime(new Date(iso), timezone);
}

/** ISO instant → { date: "2026-07-06", time: "9:00 AM" } in `timezone`. */
function toLocalFields(iso: string, timezone: string): { date: string; time: string } {
  const instant = new Date(iso);
  return {
    date: localISODate(instant, timezone),
    time: formatTime(instant, timezone),
  };
}

/** A local date + 12h time string → ISO instant in `timezone`, or null if invalid/incomplete. */
function fromLocalFields(date: string, time: string, timezone: string): string | null {
  if (!date.trim() || !time.trim()) return null;
  const parsed = parseTime12h(time);
  if (!parsed) return null;
  const instant = localToUtc(date, parsed, timezone);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

type EditState =
  | { mode: "add"; employeeProfileId: string; entry?: undefined }
  | { mode: "edit"; employeeProfileId: string; entry: TimesheetEntry }
  | null;

export function TimesheetsView({
  locationId,
  timezone,
  weekStart,
  weekLabel,
  prevHref,
  nextHref,
  todayHref,
  data,
}: TimesheetsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditState>(null);
  const [confirmDelete, setConfirmDelete] = useState<TimesheetEntry | null>(null);
  const [clockInDate, setClockInDate] = useState("");
  const [clockInTime, setClockInTime] = useState("");
  const [clockOutDate, setClockOutDate] = useState("");
  const [clockOutTime, setClockOutTime] = useState("");
  const [busy, setBusy] = useState(false);

  const exportHref = `/api/locations/${locationId}/timesheets/export?weekStart=${weekStart}`;

  function toggle(profileId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function openAdd(employeeProfileId: string) {
    setClockInDate(weekStart);
    setClockInTime("");
    setClockOutDate("");
    setClockOutTime("");
    setEdit({ mode: "add", employeeProfileId });
  }
  function openEdit(employeeProfileId: string, entry: TimesheetEntry) {
    const inFields = toLocalFields(entry.clockInAt, timezone);
    setClockInDate(inFields.date);
    setClockInTime(inFields.time);
    if (entry.clockOutAt) {
      const outFields = toLocalFields(entry.clockOutAt, timezone);
      setClockOutDate(outFields.date);
      setClockOutTime(outFields.time);
    } else {
      setClockOutDate("");
      setClockOutTime("");
    }
    setEdit({ mode: "edit", employeeProfileId, entry });
  }

  async function saveEdit() {
    if (!edit) return;
    const clockInAt = fromLocalFields(clockInDate, clockInTime, timezone);
    if (!clockInAt) {
      toast({ tone: "danger", title: "Enter a clock-in date and time" });
      return;
    }
    const clockOutAt = fromLocalFields(clockOutDate, clockOutTime, timezone);
    setBusy(true);
    try {
      const url =
        edit.mode === "add"
          ? "/api/time-clock-entries"
          : `/api/time-clock-entries/${edit.entry.id}`;
      const method = edit.mode === "add" ? "POST" : "PATCH";
      const body =
        edit.mode === "add"
          ? { employeeProfileId: edit.employeeProfileId, clockInAt, clockOutAt }
          : { clockInAt, clockOutAt };
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error.message);
      toast({ tone: "success", title: edit.mode === "add" ? "Punch added" : "Punch updated" });
      setEdit(null);
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save the punch",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/time-clock-entries/${confirmDelete.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error.message);
      toast({ tone: "success", title: "Punch deleted" });
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't delete the punch",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Timesheets</h1>
          <div className={styles.subtitle}>
            Actual hours from the time clock. Managers can correct punches; open punches are
            excluded from totals until closed.
          </div>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.exportLink} href={exportHref} download>
            <Icon name="arrow-left" size={14} style={{ transform: "rotate(-90deg)" }} />
            Export CSV
          </a>
          <DatePager
            label={weekLabel}
            prevHref={prevHref}
            nextHref={nextHref}
            todayHref={todayHref}
            prevLabel="Previous week"
            nextLabel="Next week"
          />
        </div>
      </div>

      {data.employees.length === 0 ? (
        <EmptyState
          title="No timesheets this week"
          description="Once your team clocks in and out, their hours show up here."
        />
      ) : (
        <div className={styles.list}>
          {data.employees.map((emp) => (
            <Card key={emp.profileId}>
              <button
                type="button"
                className={styles.empRow}
                onClick={() => toggle(emp.profileId)}
                aria-expanded={expanded.has(emp.profileId)}
              >
                <span className={styles.empMain}>
                  <Icon
                    name={expanded.has(emp.profileId) ? "chevron-down" : "chevron-right"}
                    size={16}
                  />
                  <span>
                    <span className={styles.empName}>{emp.name}</span>
                    {emp.primaryPositionName && (
                      <span className={styles.empRole}> · {emp.primaryPositionName}</span>
                    )}
                  </span>
                </span>
                <span className={styles.empStats}>
                  <span className={styles.stat}>
                    <span className={styles.statValue}>{emp.hoursActual}</span> hrs
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statValue}>{formatCost(emp.laborCost)}</span>
                  </span>
                  <EmployeeBadges emp={emp} />
                </span>
              </button>

              {expanded.has(emp.profileId) && (
                <div className={styles.punches}>
                  {emp.entries.length === 0 ? (
                    <div className={styles.emptyPunch}>No punches this week.</div>
                  ) : (
                    emp.entries.map((entry) => (
                      <div key={entry.id} className={styles.punchRow}>
                        <span className={styles.punchTimes}>{entry.date}</span>
                        <span className={styles.punchMeta}>
                          {clockLabel(entry.clockInAt, timezone)} –{" "}
                          {entry.clockOutAt ? clockLabel(entry.clockOutAt, timezone) : "—"}
                          {entry.shiftLabel && <span>· shift {entry.shiftLabel}</span>}
                          {entry.incomplete && <Badge tone="warning">Open</Badge>}
                          {entry.late && <Badge tone="danger">Late</Badge>}
                          {entry.edited && <Badge tone="neutral">Edited</Badge>}
                        </span>
                        <span className={styles.punchActions}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(emp.profileId, entry)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete punch"
                            onClick={() => setConfirmDelete(entry)}
                          >
                            Delete
                          </Button>
                        </span>
                      </div>
                    ))
                  )}
                  <div className={styles.addRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon name="plus" size={14} />}
                      onClick={() => openAdd(emp.profileId)}
                    >
                      Add punch
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit?.mode === "add" ? "Add punch" : "Edit punch"}
      >
        <div className={styles.dialogFields}>
          <div className={styles.timeRow}>
            <Input
              label="Clock-in date"
              type="date"
              value={clockInDate}
              onChange={(e) => setClockInDate(e.target.value)}
            />
            <TimeField
              label="Clock-in time"
              placeholder="9:00 AM"
              value={clockInTime}
              onChange={setClockInTime}
            />
          </div>
          <div className={styles.timeRow}>
            <Input
              label="Clock-out date"
              type="date"
              value={clockOutDate}
              onChange={(e) => setClockOutDate(e.target.value)}
            />
            <TimeField
              label="Clock-out time"
              placeholder="Leave blank if still open"
              value={clockOutTime}
              onChange={setClockOutTime}
            />
          </div>
          <div className={styles.dialogActions}>
            <Button variant="ghost" onClick={() => setEdit(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this punch?"
      >
        <div className={styles.dialogFields}>
          <p className={styles.subtitle}>This can&apos;t be undone.</p>
          <div className={styles.dialogActions}>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doDelete} disabled={busy}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function EmployeeBadges({ emp }: { emp: TimesheetEmployee }) {
  return (
    <span className={styles.badges}>
      {emp.lateCount > 0 && <Badge tone="danger">{emp.lateCount} late</Badge>}
      {emp.noShowCount > 0 && <Badge tone="warning">{emp.noShowCount} no-show</Badge>}
      {emp.overtime && <Badge tone="info">Overtime</Badge>}
    </span>
  );
}
