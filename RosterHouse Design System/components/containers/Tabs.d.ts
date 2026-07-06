import React from "react";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  tabs?: TabItem[];
  /** Controlled active value. Omit to let Tabs manage its own state via defaultValue. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export function Tabs(props: TabsProps): JSX.Element;
