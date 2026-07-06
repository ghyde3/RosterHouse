import React from "react";

export interface TooltipProps {
  label: string;
  children?: React.ReactNode;
  side?: "top" | "bottom";
}

export function Tooltip(props: TooltipProps): JSX.Element;
