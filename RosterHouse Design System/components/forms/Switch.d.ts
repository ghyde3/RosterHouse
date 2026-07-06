import React from "react";

export interface SwitchProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch(props: SwitchProps): JSX.Element;
