import React from "react";

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog(props: DialogProps): JSX.Element;
