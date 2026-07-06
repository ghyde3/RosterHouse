import React from "react";

export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function Input(props: InputProps): JSX.Element;
