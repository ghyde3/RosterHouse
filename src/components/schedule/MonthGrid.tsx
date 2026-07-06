"use client";

import { Badge } from "@/components/ui/Badge";
import { addDaysISO, formatFullDate, weekStartOfISO, type ISODate } from "@/lib/time";
import styles from "./grids.module.css";

type MonthGridProps = {
  month: string; // "2026-07"
  counts: Record<ISODate, number>;
  onSelectDay: (date: ISODate) => void;
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MonthGrid({ month, counts, onSelectDay }: MonthGridProps) {
  // 42 cells starting the Monday of the week containing the 1st.
  const gridStart = weekStartOfISO(`${month}-01`);
  const cells: ISODate[] = Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));

  return (
    <div className={styles.monthGrid}>
      <div className={styles.monthHeaderRow}>
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className={styles.monthHeaderCell}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.monthCells}>
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === month;
          const count = counts[date] ?? 0;
          return (
            <button
              key={date}
              type="button"
              className={`${styles.monthCell}${inMonth ? "" : ` ${styles.monthCellOutside}`}`}
              aria-label={`View ${formatFullDate(date)}`}
              onClick={() => onSelectDay(date)}
            >
              <span className={styles.monthDayNumber}>{Number(date.slice(8, 10))}</span>
              {count > 0 && <Badge tone="success">{count === 1 ? "1 shift" : `${count} shifts`}</Badge>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
