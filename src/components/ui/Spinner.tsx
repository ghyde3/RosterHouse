import { cx } from "./cx";
import styles from "./Spinner.module.css";

export type SpinnerProps = {
  size?: number;
  /** Screen-reader text. @default "Loading…" */
  label?: string;
  className?: string;
};

export function Spinner({
  size = 20,
  label = "Loading…",
  className,
}: SpinnerProps) {
  return (
    <span role="status" className={cx(styles.root, className)}>
      <span
        className={styles.ring}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
