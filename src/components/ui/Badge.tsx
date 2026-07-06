import { cx } from "./cx";
import styles from "./Badge.module.css";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export type BadgeProps = {
  tone?: BadgeTone;
} & React.ComponentPropsWithRef<"span">;

export function Badge({
  tone = "success",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span data-tone={tone} className={cx(styles.badge, className)} {...rest}>
      {children}
    </span>
  );
}
