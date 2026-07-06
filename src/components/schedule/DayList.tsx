"use client";

import { ShiftBlock } from "@/components/ui/ShiftBlock";
import type { ScheduleShift } from "@/lib/schedule-data";
import type { ISODate } from "@/lib/time";
import styles from "./grids.module.css";

type DayListProps = {
  positions: { id: string; name: string }[];
  date: ISODate;
  shifts: ScheduleShift[]; // pre-filtered to `date`
  onAddClick: (positionId: string) => void;
  onShiftClick: (shift: ScheduleShift) => void;
};

export default function DayList({
  positions,
  shifts,
  onAddClick,
  onShiftClick,
}: DayListProps) {
  return (
    <div className={styles.dayList}>
      {shifts.length === 0 && (
        <div className={styles.dayEmpty}>No shifts scheduled for this day yet.</div>
      )}
      {positions.map((position) => {
        const positionShifts = shifts.filter((s) => s.positionId === position.id);
        return (
          <div key={position.id}>
            <div className={styles.dayGroupTitle}>
              {position.name}
              {positionShifts.length > 0 && ` · ${positionShifts.length}`}
            </div>
            <div className={styles.dayGroupStack}>
              {positionShifts.map((s) => (
                <ShiftBlock
                  key={s.id}
                  role={s.positionName}
                  time={s.timeRange}
                  employeeName={s.employeeName ?? undefined}
                  status={s.uiStatus}
                  conflictReason={s.conflicts[0]?.message}
                  onClick={() => onShiftClick(s)}
                />
              ))}
              <button
                type="button"
                className={styles.dayAddButton}
                aria-label={`Add ${position.name} shift`}
                onClick={() => onAddClick(position.id)}
              >
                + Add {position.name} shift
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
