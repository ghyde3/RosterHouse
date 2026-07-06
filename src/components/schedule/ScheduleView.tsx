"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePager } from "@/components/chrome/DatePager";
import AssignShiftDialog, {
  type AssignShiftDialogInitial,
} from "@/components/schedule/AssignShiftDialog";
import DayList from "@/components/schedule/DayList";
import MonthGrid from "@/components/schedule/MonthGrid";
import WeekGrid from "@/components/schedule/WeekGrid";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Tabs } from "@/components/ui/Tabs";
import type { EmployeeOption, ScheduleShift, ScheduleWeekData } from "@/lib/schedule-data";
import {
  addDaysISO,
  formatDateShort,
  formatFullDate,
  weekDatesOf,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";
import styles from "./schedule.module.css";

type ScheduleViewProps = {
  locationId: string;
  currentWeek: ISODate;
  view: "week" | "day" | "month";
  week: ISODate;
  day: ISODate;
  month: string; // "2026-07"
  monthCounts: Record<ISODate, number> | null;
  data: ScheduleWeekData;
  employees: EmployeeOption[];
};

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function ScheduleView({
  locationId,
  currentWeek,
  view,
  week,
  day,
  month,
  monthCounts,
  data,
  employees,
}: ScheduleViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<AssignShiftDialogInitial | null>(null);

  function buildUrl(next: Partial<{ view: string; week: ISODate; day: ISODate; month: string }>): string {
    const nextView = next.view ?? view;
    const params = new URLSearchParams();
    params.set("view", nextView);
    params.set("week", next.week ?? week);
    if (nextView === "day") params.set("day", next.day ?? day);
    if (nextView === "month") params.set("month", next.month ?? month);
    return `/manager/schedule?${params.toString()}`;
  }

  function go(next: Partial<{ view: string; week: ISODate; day: ISODate; month: string }>) {
    router.push(buildUrl(next));
  }

  function openAdd(positionId: string | null, date: ISODate | null) {
    setDialogInitial({
      positionId,
      date,
      employeeProfileId: null,
      startTime: "",
      endTime: "",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(shift: ScheduleShift) {
    const [startTime, endTime] = shift.timeRange.split(" – ");
    setDialogInitial({
      shiftId: shift.id,
      positionId: shift.positionId,
      date: shift.date,
      employeeProfileId: shift.employeeProfileId,
      startTime,
      endTime,
      notes: shift.notes ?? "",
    });
    setDialogOpen(true);
  }

  const isRepublish = data.schedule.status === "published" && data.schedule.hasUnpublishedChanges;

  // Pager wiring per view — DatePager is link-based (next/link anchors), so
  // compute prev/next/today HREFS with the same URL logic as go(). "Today"
  // always returns to the real current week/day/month in the location's
  // timezone (no demo anchor date).
  let pagerLabel: string;
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;
  let prevLabel: string;
  let nextLabel: string;
  if (view === "day") {
    pagerLabel = formatFullDate(day);
    const prevDay = addDaysISO(day, -1);
    const nextDay = addDaysISO(day, 1);
    prevHref = buildUrl({ day: prevDay, week: weekStartOfISO(prevDay) });
    nextHref = buildUrl({ day: nextDay, week: weekStartOfISO(nextDay) });
    todayHref = buildUrl({ day: currentWeek, week: currentWeek });
    prevLabel = "Previous day";
    nextLabel = "Next day";
  } else if (view === "month") {
    pagerLabel = monthLabel(month);
    prevHref = buildUrl({ month: addMonths(month, -1) });
    nextHref = buildUrl({ month: addMonths(month, 1) });
    todayHref = buildUrl({ month: currentWeek.slice(0, 7), week: currentWeek });
    prevLabel = "Previous month";
    nextLabel = "Next month";
  } else {
    pagerLabel = `${formatDateShort(week)} – ${formatDateShort(addDaysISO(week, 6))}`;
    prevHref = buildUrl({ week: addDaysISO(week, -7) });
    nextHref = buildUrl({ week: addDaysISO(week, 7) });
    todayHref = buildUrl({ week: currentWeek });
    prevLabel = "Previous week";
    nextLabel = "Next week";
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Schedule</h1>
          <div className={styles.badgeRow}>
            {data.schedule.status === "draft" && <Badge tone="warning">Draft</Badge>}
            {data.schedule.status === "published" && !isRepublish && (
              <Badge tone="success">Published</Badge>
            )}
            {isRepublish && <Badge tone="warning">Unpublished changes</Badge>}
            {data.conflictCount > 0 && (
              <ConflictChip>
                {data.conflictCount === 1
                  ? "1 conflict to resolve"
                  : `${data.conflictCount} conflicts to resolve`}
              </ConflictChip>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => openAdd(null, null)}>
            Add shift
          </Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <DatePager
          label={pagerLabel}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        />
        <Tabs
          value={view}
          tabs={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          onChange={(v) => go({ view: v })}
        />
      </div>

      {view === "week" && (
        <WeekGrid
          positions={data.positions}
          weekDates={weekDatesOf(week)}
          shifts={data.shifts}
          onCellClick={(positionId, date) => openAdd(positionId, date)}
          onShiftClick={openEdit}
        />
      )}
      {view === "day" && (
        <DayList
          positions={data.positions}
          date={day}
          shifts={data.shifts.filter((s) => s.date === day)}
          onAddClick={(positionId) => openAdd(positionId, day)}
          onShiftClick={openEdit}
        />
      )}
      {view === "month" && (
        <MonthGrid
          month={month}
          counts={monthCounts ?? {}}
          onSelectDay={(date) => go({ view: "day", day: date, week: weekStartOfISO(date) })}
        />
      )}

      <AssignShiftDialog
        open={dialogOpen}
        locationId={locationId}
        positions={data.positions}
        weekDates={weekDatesOf(week)}
        employees={employees}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
