"use client";

import { Fragment, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import {
  filterAndGroup,
  type PositionRef,
  type StatusFilter,
} from "@/lib/availability-view";
import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";
import { formatDayLabel, weekDatesOf } from "@/lib/time";
import { hhmmTo12h } from "@/lib/time-format";
import styles from "./availability.module.css";

export type AvailabilityViewProps = {
  weekStart: string;
  employees: OverviewEmployee[];
  positions: PositionRef[];
};

const DAY_OPTIONS = [
  { value: "-1", label: "All days" },
  { value: "0", label: "Mon" },
  { value: "1", label: "Tue" },
  { value: "2", label: "Wed" },
  { value: "3", label: "Thu" },
  { value: "4", label: "Fri" },
  { value: "5", label: "Sat" },
  { value: "6", label: "Sun" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "timeoff", label: "On time-off this week" },
];

export function AvailabilityView({ weekStart, employees, positions }: AvailabilityViewProps) {
  const [dayFilter, setDayFilter] = useState("-1");
  const [status, setStatus] = useState<StatusFilter>("all");

  const dayNum = Number(dayFilter);
  const dates = useMemo(() => weekDatesOf(weekStart), [weekStart]);
  // Columns shown: all 7, or the single selected day.
  const shownDates = dayNum < 0 ? dates : [dates[dayNum]];

  const groups = useMemo(
    () => filterAndGroup(employees, positions, status, dayNum),
    [employees, positions, status, dayNum]
  );

  return (
    <div className={styles.viewRoot}>
      <div className={styles.controls}>
        <Select
          label="Day"
          value={dayFilter}
          onChange={setDayFilter}
          options={DAY_OPTIONS}
          className={styles.control}
        />
        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={STATUS_OPTIONS}
          className={styles.control}
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No one matches these filters"
          description="Try a different day or status."
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className={styles.group}>
            <h2 className={styles.groupHeader}>{group.label}</h2>
            <div className={styles.gridWrap}>
              <div
                className={styles.grid}
                style={{
                  gridTemplateColumns: `200px repeat(${shownDates.length}, minmax(96px, 1fr))`,
                  minWidth: shownDates.length === 1 ? 320 : 900,
                }}
              >
                <div />
                {shownDates.map((d) => (
                  <div key={d} className={styles.dayHead}>
                    {formatDayLabel(d)}
                  </div>
                ))}
                {group.employees.map((e) => (
                  <Fragment key={e.profileId}>
                    <div className={styles.person}>
                      <Avatar name={e.name} size={28} />
                      <div>
                        <div className={styles.personName}>{e.name}</div>
                        {e.primaryPositionName && (
                          <div className={styles.personRole}>{e.primaryPositionName}</div>
                        )}
                      </div>
                    </div>
                    {shownDaysOf(e, dayNum).map((day) => (
                      <AvailabilityCell key={day.date} day={day} />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function shownDaysOf(emp: OverviewEmployee, dayNum: number): OverviewDay[] {
  if (dayNum < 0) return emp.days;
  return emp.days.filter((d) => d.dayOfWeek === dayNum);
}

function AvailabilityCell({ day }: { day: OverviewDay }) {
  if (day.timeOff) {
    return <div className={`${styles.cell} ${styles.cellTimeOff}`}>Time off</div>;
  }
  // Cells show effective availability (a one-off exception already applied
  // by the query); the tag marks days where an exception overrides the rule.
  const label = !day.isAvailable
    ? "Unavailable"
    : day.startTime && day.endTime
      ? `${hhmmTo12h(day.startTime)} – ${hhmmTo12h(day.endTime)}`
      : "All day";
  const tone = day.isAvailable ? styles.cellOn : styles.cellOff;
  return (
    <div className={`${styles.cell} ${tone}`}>
      <div>
        {label}
        {day.exception && <div className={styles.exceptionTag}>Exception</div>}
      </div>
    </div>
  );
}
