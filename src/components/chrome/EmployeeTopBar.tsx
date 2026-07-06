import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import styles from "./EmployeeTopBar.module.css";

export type EmployeeTopBarProps = {
  title: string;
  backHref?: string;
  /** Right-side slot; Phase 4 places the notification bell here. */
  action?: React.ReactNode;
  className?: string;
};

export function EmployeeTopBar({
  title,
  backHref,
  action,
  className,
}: EmployeeTopBarProps) {
  return (
    <header className={cx(styles.bar, className)}>
      <div className={styles.left}>
        {backHref && (
          <Link href={backHref} className={styles.back} aria-label="Back">
            <Icon name="chevron-left" size={22} />
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  );
}
