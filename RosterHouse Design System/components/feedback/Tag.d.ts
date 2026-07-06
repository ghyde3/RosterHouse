import React from "react";

export interface TagProps {
  children?: React.ReactNode;
  onRemove?: () => void;
  color?: "neutral" | "brand" | "accent";
}

export function Tag(props: TagProps): JSX.Element;
