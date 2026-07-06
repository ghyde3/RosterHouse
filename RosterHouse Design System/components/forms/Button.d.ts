import React from "react";

export interface ButtonProps {
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  /** Size. @default "md" */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Optional leading icon element (e.g. a Lucide <i> icon). */
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}

export function Button(props: ButtonProps): JSX.Element;
