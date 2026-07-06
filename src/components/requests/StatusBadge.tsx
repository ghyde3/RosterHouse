// src/components/requests/StatusBadge.tsx
// Maps request lifecycle status to the design system's Badge tones.
// Server-safe (no state, no handlers).
import { Badge } from "@/components/ui/Badge";

const TONE = { pending: "warning", approved: "success", denied: "danger", cancelled: "neutral" } as const;
const LABEL = { pending: "Pending", approved: "Approved", denied: "Denied", cancelled: "Cancelled" } as const;

export type RequestStatusValue = keyof typeof TONE;

export function StatusBadge({ status }: { status: RequestStatusValue }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
