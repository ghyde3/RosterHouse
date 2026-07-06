import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./ShiftBlock.module.css";

export type ShiftBlockStatus = "confirmed" | "open" | "conflict" | "draft";

export type ShiftBlockProps = {
  /** Position name shown as the block heading, e.g. "Line cook" (export API — shadows the ARIA attribute on purpose, so no rest spread here). */
  role: string;
  /** Preformatted range, e.g. "7:00 AM – 3:00 PM" (en dash). */
  time: string;
  employeeName?: string;
  status?: ShiftBlockStatus;
  compact?: boolean;
  /** Shown only when status is "conflict". */
  conflictReason?: string;
  onClick?: () => void;
  className?: string;
};

export function ShiftBlock({
  role,
  time,
  employeeName,
  status = "confirmed",
  compact = false,
  conflictReason,
  onClick,
  className,
}: ShiftBlockProps) {
  const content = (
    <>
      <span className={styles.role}>{role}</span>
      <span className={styles.time}>{time}</span>
      {employeeName && <span className={styles.employee}>{employeeName}</span>}
      {status === "conflict" && conflictReason && (
        <span className={styles.conflict}>
          <Icon
            name="alert-triangle"
            size={compact ? 9 : 11}
            strokeWidth={2.5}
            className={styles.conflictIcon}
          />
          {conflictReason}
        </span>
      )}
    </>
  );

  const shared = {
    "data-status": status,
    "data-compact": compact ? "true" : undefined,
    className: cx(styles.block, className),
  };

  return onClick ? (
    <button type="button" onClick={onClick} {...shared}>
      {content}
    </button>
  ) : (
    <div {...shared}>{content}</div>
  );
}
