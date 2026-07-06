import { cx } from "./cx";
import styles from "./Card.module.css";

export type CardProps = {
  /** CSS padding value. @default "var(--space-6)" */
  padding?: string;
  /** Elevate on hover (CSS :hover, not JS). @default false */
  hoverable?: boolean;
} & React.ComponentPropsWithRef<"div">;

export function Card({
  padding = "var(--space-6)",
  hoverable = false,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(styles.card, hoverable && styles.hoverable, className)}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
