import React from "react";

export interface CardProps {
  children?: React.ReactNode;
  padding?: string;
  hoverable?: boolean;
  style?: React.CSSProperties;
}

export function Card(props: CardProps): JSX.Element;
