"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RequestSwapButton({
  shiftId,
  size = "md",
  fullWidth = true,
}: {
  shiftId: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}) {
  const router = useRouter();
  return (
    <Button variant="ghost" size={size} fullWidth={fullWidth} onClick={() => router.push(`/shifts/${shiftId}/swap`)}>
      Request swap
    </Button>
  );
}
