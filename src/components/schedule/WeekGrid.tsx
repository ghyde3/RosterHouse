"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import type { ScheduleShift } from "@/lib/schedule-data";
import { formatDayLabel, type ISODate } from "@/lib/time";
import styles from "./grids.module.css";

type WeekGridProps = {
  positions: { id: string; name: string }[];
  weekDates: ISODate[];
  shifts: ScheduleShift[];
  onCellClick: (positionId: string, date: ISODate) => void;
  onShiftClick: (shift: ScheduleShift) => void;
};

export default function WeekGrid({
  positions,
  weekDates,
  shifts,
  onCellClick,
  onShiftClick,
}: WeekGridProps) {
  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleShift[]>();
    for (const s of shifts) {
      const key = `${s.positionId}|${s.date}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  return (
    <div className={styles.weekGrid}>
      {shifts.length === 0 && (
        <div className={styles.emptyBanner}>
          <EmptyState
            title="No shifts scheduled this week yet"
            description="Use any add button below, or the add shift button above, to place the first shift."
          />
        </div>
      )}
      <div className={styles.headerRow}>
        <div />
        {weekDates.map((d) => (
          <div key={d} className={styles.dayLabel}>
            {formatDayLabel(d)}
          </div>
        ))}
      </div>
      {positions.map((position) => (
        <div key={position.id} className={styles.positionRow}>
          <div className={styles.positionLabel}>{position.name}</div>
          {weekDates.map((date) => {
            const cellShifts = byCell.get(`${position.id}|${date}`) ?? [];
            const hasConflict = cellShifts.some((s) => s.uiStatus === "conflict");
            if (cellShifts.length === 0) {
              // Phase 1's WeekGridCell renders its own <button aria-label={addLabel}>
              // when empty (children are ignored) — pass onClick + addLabel, no children.
              return (
                <WeekGridCell
                  key={`${position.id}|${date}`}
                  empty
                  hasConflict={hasConflict}
                  onClick={() => onCellClick(position.id, date)}
                  addLabel={`Add ${position.name} shift on ${formatDayLabel(date)}`}
                />
              );
            }
            return (
              <WeekGridCell key={`${position.id}|${date}`} hasConflict={hasConflict}>
                <div className={styles.cellStack}>
                  {cellShifts.map((s) => (
                    <ShiftBlock
                      key={s.id}
                      compact
                      // The row is already labeled with the position name
                      // (styles.positionLabel above), so the heading here is
                      // the employee instead of repeating the position — that
                      // repetition is what the design export does, but it
                      // produces duplicate on-screen text nodes for the same
                      // string, which is both a real accessibility smell and
                      // unresolvable against a same-string getByText query.
                      role={s.employeeName ?? "Open shift"}
                      time={s.timeRange}
                      status={s.uiStatus}
                      conflictReason={s.conflicts[0]?.message}
                      onClick={() => onShiftClick(s)}
                    />
                  ))}
                  <button
                    type="button"
                    className={styles.addButton}
                    aria-label={`Add ${position.name} shift on ${formatDayLabel(date)}`}
                    onClick={() => onCellClick(position.id, date)}
                  >
                    + Add
                  </button>
                </div>
              </WeekGridCell>
            );
          })}
        </div>
      ))}
    </div>
  );
}
