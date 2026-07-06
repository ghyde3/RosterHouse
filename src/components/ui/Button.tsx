import { cx } from "./cx";
import styles from "./Button.module.css";

export type ButtonProps = {
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  /** Size. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Optional leading icon element (e.g. <Icon name="plus" size={16} />). */
  icon?: React.ReactNode;
  fullWidth?: boolean;
} & React.ComponentPropsWithRef<"button">;

export function Button({
  variant = "primary",
  size = "md",
  icon = null,
  fullWidth = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      className={cx(styles.button, fullWidth && styles.fullWidth, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
