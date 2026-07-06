"use client";

import { useState } from "react";
import { cx } from "./cx";
import styles from "./Tabs.module.css";

export type TabItem = { value: string; label: string };

export type TabsProps = {
  tabs?: TabItem[];
  /** Controlled active value. Omit to let Tabs manage its own state. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
} & Omit<React.ComponentPropsWithRef<"div">, "onChange" | "defaultValue">;

export function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  className,
  ...rest
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value);
  const active = value !== undefined ? value : internal;

  function select(v: string) {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  }

  return (
    <div role="tablist" className={cx(styles.tablist, className)} {...rest}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={active === t.value}
          className={styles.tab}
          onClick={() => select(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
