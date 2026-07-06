import React from "react";

export interface AvatarStatusProps {
  name: string;
  status?: "available" | "unavailable" | "pending" | "off";
  size?: number;
}

export function AvatarStatus(props: AvatarStatusProps): JSX.Element;
