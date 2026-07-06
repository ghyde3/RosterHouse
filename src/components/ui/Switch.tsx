"use client";

import { useId } from "react";
import { cx } from "./cx";
import styles from "./Switch.module.css";

export type SwitchProps = {
  label?: string;
  checked?: boolean;
  /** Reports the next boolean state (export .d.ts API, kept). */
  onChange?: (checked: boolean) => void;
} & Omit<React.ComponentPropsWithRef<"input">, "onChange" | "checked" | "type">;

export function Switch({
  label,
  checked = false,
  onChange,
  disabled,
  className,
  id,
  ...rest
}: SwitchProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      className={cx(styles.root, disabled && styles.isDisabled, className)}
      htmlFor={inputId}
    >
      {label && <span>{label}</span>}
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        {...rest}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
