import { useId } from "react";
import { cx } from "./cx";
import styles from "./Input.module.css";

export type InputProps = {
  label?: string;
  error?: string;
  /** Optional leading icon element (e.g. <Icon name="clock" size={16} />). */
  icon?: React.ReactNode;
} & Omit<React.ComponentPropsWithRef<"input">, "size">;

/**
 * className lands on the root wrapper; all other rest props and the ref go
 * to the inner <input>. Composite-field exception to the "rest on root" rule.
 */
export function Input({
  label,
  error,
  icon = null,
  className,
  id,
  disabled,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div
        className={cx(
          styles.control,
          error && styles.hasError,
          disabled && styles.isDisabled
        )}
      >
        {icon}
        <input
          id={inputId}
          className={styles.input}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
      </div>
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
