import React from "react";

export interface WeekGridCellProps {
  children?: React.ReactNode;
  empty?: boolean;
  hasConflict?: boolean;
  onClick?: () => void;
}

export function WeekGridCell(props: WeekGridCellProps): JSX.Element;
