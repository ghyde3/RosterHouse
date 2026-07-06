"use client";

import { useState } from "react";
import { Input } from "./Input";
import { parseTime12h } from "./time-field-parse";

export type TimeFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** External error (e.g. a conflict message) — overrides internal validation. */
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * 12-hour time field. Validates on blur (then live) with parseTime12h; an
 * empty value is not an error — leave required-ness to the form.
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder = "7:00 AM",
  disabled = false,
  className,
}: TimeFieldProps) {
  const [touched, setTouched] = useState(false);
  const invalid =
    touched && value.trim() !== "" && parseTime12h(value) === null;
  const shownError = error ?? (invalid ? "Enter a time like 7:00 AM" : undefined);

  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setTouched(true)}
      error={shownError}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
    />
  );
}
