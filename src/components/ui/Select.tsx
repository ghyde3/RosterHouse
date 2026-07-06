"use client";

import { useId } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./Select.module.css";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  label?: string;
  value?: string;
  /** Reports the chosen option value (export .d.ts API, kept). */
  onChange?: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
} & Omit<React.ComponentPropsWithRef<"select">, "onChange" | "value" | "children">;

/**
 * Native <select> styled to the design system. The export's div-popup had no
 * keyboard support; the native control gets it for free. className lands on
 * the root wrapper; rest props and the ref go to the <select>.
 */
export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  className,
  id,
  disabled,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const isPlaceholder = value === undefined || value === "";
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className={styles.control}>
        <select
          id={selectId}
          className={cx(styles.select, isPlaceholder && styles.placeholder)}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={16} className={styles.chevron} />
      </div>
    </div>
  );
}
