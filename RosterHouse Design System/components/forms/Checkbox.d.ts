import React from "react";

export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox(props: CheckboxProps): JSX.Element;
