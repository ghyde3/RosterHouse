import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./ConflictChip.module.css";

export type ConflictChipProps = React.ComponentPropsWithRef<"span">;

export function ConflictChip({
  className,
  children,
  ...rest
}: ConflictChipProps) {
  return (
    <span className={cx(styles.chip, className)} {...rest}>
      <Icon name="alert-triangle" size={14} strokeWidth={2.2} />
      {children}
    </span>
  );
}
