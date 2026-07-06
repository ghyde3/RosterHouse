"use client";

import { useId } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./Checkbox.module.css";

export type CheckboxProps = {
  label?: string;
  checked?: boolean;
  /** Reports the next boolean state (export .d.ts API, kept). */
  onChange?: (checked: boolean) => void;
} & Omit<React.ComponentPropsWithRef<"input">, "onChange" | "checked" | "type">;

export function Checkbox({
  label,
  checked = false,
  onChange,
  disabled,
  className,
  id,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      className={cx(styles.root, disabled && styles.isDisabled, className)}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={12} strokeWidth={3} className={styles.mark} />
      </span>
      {label}
    </label>
  );
}
