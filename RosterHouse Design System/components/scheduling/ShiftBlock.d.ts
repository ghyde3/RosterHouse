import React from "react";

export interface ShiftBlockProps {
  role: string;
  time: string;
  employeeName?: string;
  status?: "confirmed" | "open" | "conflict" | "draft";
  compact?: boolean;
  /** Short explanation shown when status is "conflict" — e.g. "Overlaps Sam's 6–10 PM shift". */
  conflictReason?: string;
  onClick?: () => void;
}

export function ShiftBlock(props: ShiftBlockProps): JSX.Element;
