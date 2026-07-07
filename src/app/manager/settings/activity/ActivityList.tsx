"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDayFull, formatWeekOf, timeAgo } from "@/lib/time-format";
import type { AuditLogDto } from "@/lib/audit";
import styles from "./activity.module.css";

type Page = { entries: AuditLogDto[]; nextCursor: string | null };

const ACTION_LABELS: Record<string, string> = {
  "schedule.published": "published the schedule",
  "shift.created": "added a shift",
  "shift.updated": "updated a shift",
  "shift.deleted": "deleted a shift",
  "timeclock.edited": "edited a time clock entry",
  "team.member_updated": "updated a team member",
  "team.invited": "invited a team member",
  "position.created": "created a position",
  "position.updated": "updated a position",
  "position.reordered": "reordered positions",
  "position.archived": "archived a position",
  "timeoff.approved": "approved a time off request",
  "timeoff.denied": "denied a time off request",
  "swap.approved": "approved a shift swap",
  "swap.denied": "denied a shift swap",
  "claim.approved": "approved an open shift claim",
  "claim.denied": "denied an open shift claim",
  "drop.approved": "approved a drop request",
  "drop.denied": "denied a drop request",
  "template.applied": "applied a schedule template",
  "location.settings_updated": "updated location settings",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(".", " ").replace(/_/g, " ");
}

type Detail = Record<string, unknown>;

function asDetail(value: unknown): Detail {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Detail) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function money(v: unknown): string {
  return typeof v === "number" ? `$${v.toFixed(2)}` : "not set";
}

function hours(v: unknown): string {
  return typeof v === "number" ? `${v} hrs` : "off";
}

function punch(v: unknown, timezone: string): string {
  if (v === null) return "not clocked out";
  if (typeof v !== "string") return "—";
  // Location timezone, not the viewer's — punches must match TimesheetsView.
  return new Date(v).toLocaleString(undefined, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isoToDay(v: unknown): string | null {
  const s = str(v);
  return s ? formatDayFull(s) : null;
}

/** One short context line under the action, e.g. "$18.00 → $19.50". */
function detailLine(entry: AuditLogDto, timezone: string): string | null {
  const d = asDetail(entry.detail);
  const parts: string[] = [];

  switch (entry.action) {
    case "schedule.published":
    case "template.applied": {
      const week = str(d.weekStartDate);
      if (week) parts.push(formatWeekOf(week));
      if (typeof d.shiftCount === "number") {
        parts.push(`${d.shiftCount} ${d.shiftCount === 1 ? "shift" : "shifts"}`);
      }
      break;
    }
    case "shift.created":
    case "shift.deleted": {
      const day = isoToDay(d.date);
      if (day) parts.push(day);
      const range = str(d.timeRange);
      if (range) parts.push(range);
      const position = str(d.position);
      if (position) parts.push(position);
      parts.push(str(d.assignee) ?? (entry.action === "shift.created" ? "open shift" : ""));
      break;
    }
    case "shift.updated": {
      const day = isoToDay(d.date);
      if (day) parts.push(day);
      const before = asDetail(d.before);
      const after = asDetail(d.after);
      for (const key of Object.keys(after)) {
        const from = key === "assignee" ? (str(before[key]) ?? "open") : str(before[key]);
        const to = key === "assignee" ? (str(after[key]) ?? "open") : str(after[key]);
        if (from !== null || to !== null) parts.push(`${from ?? "—"} → ${to ?? "—"}`);
      }
      break;
    }
    case "timeclock.edited": {
      const before = asDetail(d.before);
      const after = asDetail(d.after);
      if ("clockInAt" in after) parts.push(`clock-in ${punch(before.clockInAt, timezone)} → ${punch(after.clockInAt, timezone)}`);
      if ("clockOutAt" in after) parts.push(`clock-out ${punch(before.clockOutAt, timezone)} → ${punch(after.clockOutAt, timezone)}`);
      break;
    }
    case "team.member_updated": {
      const name = str(d.memberName);
      if (name) parts.push(name);
      const rate = asDetail(d.hourlyRate);
      if ("after" in rate) parts.push(`${money(rate.before)} → ${money(rate.after)}`);
      const vacation = asDetail(d.vacationBalanceHours);
      if ("after" in vacation) parts.push(`vacation ${hours(vacation.before)} → ${hours(vacation.after)}`);
      const sick = asDetail(d.sickBalanceHours);
      if ("after" in sick) parts.push(`sick ${hours(sick.before)} → ${hours(sick.after)}`);
      if (parts.length <= 1 && Array.isArray(d.fields)) parts.push(d.fields.join(", "));
      break;
    }
    case "team.invited": {
      parts.push(str(d.name) ?? "", str(d.position) ?? "");
      break;
    }
    case "position.created":
    case "position.archived":
    case "position.updated": {
      const before = asDetail(d.before);
      const after = asDetail(d.after);
      if (str(before.name) && str(after.name)) {
        parts.push(`${str(before.name)} → ${str(after.name)}`);
      } else {
        parts.push(str(d.name) ?? "");
        if (d.restored === true) parts.push("restored");
      }
      break;
    }
    case "timeoff.approved":
    case "timeoff.denied": {
      parts.push(str(d.employee) ?? "");
      const start = isoToDay(d.startDate);
      const end = isoToDay(d.endDate);
      if (start && end) parts.push(start === end ? start : `${start} – ${end}`);
      parts.push(str(d.reason) ?? "");
      break;
    }
    case "swap.approved":
    case "swap.denied": {
      const requester = str(d.requester);
      const coverer = str(d.coverer);
      parts.push(coverer && requester ? `${requester} → ${coverer}` : (requester ?? ""));
      parts.push(isoToDay(d.date) ?? "");
      break;
    }
    case "claim.approved":
    case "claim.denied":
    case "drop.approved":
    case "drop.denied": {
      parts.push(str(d.employee) ?? "", isoToDay(d.date) ?? "", str(d.position) ?? "");
      break;
    }
    default:
      break;
  }

  const line = parts.filter((p) => p.length > 0).join(" · ");
  return line.length > 0 ? line : null;
}

export function ActivityList({
  locationId,
  timezone,
  initial,
}: {
  locationId: string;
  timezone: string;
  initial: Page;
}) {
  const [items, setItems] = useState(initial.entries);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const res = await fetch(
        `/api/locations/${locationId}/audit-logs?cursor=${encodeURIComponent(nextCursor)}&limit=30`,
      );
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      setItems((prev) => [...prev, ...body.data.entries]);
      setNextCursor(body.data.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Changes managers make — publishing schedules, editing shifts, approving requests — will show up here."
      />
    );
  }

  return (
    <div className={styles.list}>
      {items.map((entry) => {
        const detail = detailLine(entry, timezone);
        return (
          <Card key={entry.id} padding="var(--space-4)">
            <div className={styles.row}>
              <div>
                <div className={styles.line}>
                  <span className={styles.actor}>{entry.actorName}</span> {actionLabel(entry.action)}
                </div>
                {detail && <div className={styles.detail}>{detail}</div>}
              </div>
              <span className={styles.time}>{timeAgo(new Date(entry.createdAt))}</span>
            </div>
          </Card>
        );
      })}
      {loadError && <div className={styles.loadError}>Couldn&apos;t load more activity. Try again.</div>}
      {nextCursor && (
        <Button variant="secondary" fullWidth onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
