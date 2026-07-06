import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import styles from "./DatePager.module.css";

export type DatePagerProps = {
  /** Preformatted period label, e.g. "Jul 6 – Jul 12" (en dash). */
  label: string;
  prevHref: string;
  nextHref: string;
  todayHref?: string;
  /** @default "Previous" — pass e.g. "Previous week" per view. */
  prevLabel?: string;
  /** @default "Next" */
  nextLabel?: string;
  className?: string;
};

/** URL-state pager: all three controls are links, so paging survives reloads. */
export function DatePager({
  label,
  prevHref,
  nextHref,
  todayHref,
  prevLabel = "Previous",
  nextLabel = "Next",
  className,
}: DatePagerProps) {
  return (
    <div className={cx(styles.pager, className)}>
      <Link href={prevHref} className={styles.arrow} aria-label={prevLabel}>
        <Icon name="chevron-left" size={16} />
      </Link>
      <span className={styles.label}>{label}</span>
      <Link href={nextHref} className={styles.arrow} aria-label={nextLabel}>
        <Icon name="chevron-right" size={16} />
      </Link>
      {todayHref && (
        <Link href={todayHref} className={styles.today}>
          Today
        </Link>
      )}
    </div>
  );
}
