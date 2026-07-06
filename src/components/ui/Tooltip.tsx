import { cx } from "./cx";
import styles from "./Tooltip.module.css";

export type TooltipProps = {
  label: string;
  side?: "top" | "bottom";
} & React.ComponentPropsWithRef<"span">;

/**
 * CSS-only tooltip: shows on hover AND keyboard focus of the wrapped
 * control (the export's JS-hover version never showed for keyboard users).
 */
export function Tooltip({
  label,
  side = "top",
  className,
  children,
  ...rest
}: TooltipProps) {
  return (
    <span data-side={side} className={cx(styles.root, className)} {...rest}>
      {children}
      <span role="tooltip" className={styles.bubble}>
        {label}
      </span>
    </span>
  );
}
