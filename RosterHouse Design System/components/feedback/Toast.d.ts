import React from "react";

export interface ToastProps {
  tone?: "success" | "warning" | "danger" | "info";
  title: string;
  description?: string;
  onClose?: () => void;
}

export function Toast(props: ToastProps): JSX.Element;
