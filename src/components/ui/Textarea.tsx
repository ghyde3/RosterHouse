import { useId } from "react";
import { cx } from "./cx";
import styles from "./Textarea.module.css";

export type TextareaProps = {
  label?: string;
  error?: string;
} & React.ComponentPropsWithRef<"textarea">;

/** className on the wrapper; rest props + ref on the <textarea> (same split as Input). */
export function Textarea({
  label,
  error,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const errorId = `${areaId}-error`;
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={areaId}>
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cx(styles.textarea, error && styles.hasError)}
        {...rest}
      />
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
