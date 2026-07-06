import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./WeekGridCell.module.css";

export type WeekGridCellProps = {
  children?: React.ReactNode;
  empty?: boolean;
  hasConflict?: boolean;
  /** Fired by the add button in empty cells. */
  onClick?: () => void;
  /** Accessible name for the add button. @default "Add shift" */
  addLabel?: string;
  className?: string;
};

/**
 * Empty cells are a real add <button>; occupied cells are a plain <div>
 * (children are usually ShiftBlock buttons — nesting buttons is invalid).
 */
export function WeekGridCell({
  children,
  empty = false,
  hasConflict = false,
  onClick,
  addLabel = "Add shift",
  className,
}: WeekGridCellProps) {
  if (empty) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={addLabel}
        data-conflict={hasConflict ? "true" : undefined}
        className={cx(styles.cell, styles.empty, className)}
      >
        <Icon name="plus" size={16} />
      </button>
    );
  }
  return (
    <div
      data-conflict={hasConflict ? "true" : undefined}
      className={cx(styles.cell, className)}
    >
      {children}
    </div>
  );
}
