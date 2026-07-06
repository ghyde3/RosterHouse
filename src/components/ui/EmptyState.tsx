import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";
import styles from "./EmptyState.module.css";

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.root, className)}>
      <span className={styles.iconWrap}>
        <Icon name={icon} size={22} />
      </span>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.description}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
