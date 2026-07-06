// src/lib/notification-links.ts — where tapping a notification takes you.
// Mirrors the NotificationType enum in prisma/schema.prisma; kept as string
// literals so client components never import the Prisma client.
export type NotificationType =
  | "schedule_published"
  | "shift_reminder"
  | "swap_approved"
  | "swap_denied"
  | "timeoff_approved"
  | "timeoff_denied"
  | "claim_approved"
  | "claim_denied"
  | "open_shift_posted";

const HREFS: Record<NotificationType, string> = {
  schedule_published: "/shifts",
  shift_reminder: "/shifts",
  swap_approved: "/swaps",
  swap_denied: "/swaps",
  claim_approved: "/swaps",
  claim_denied: "/swaps",
  open_shift_posted: "/swaps",
  timeoff_approved: "/availability",
  timeoff_denied: "/availability",
};

export function notificationHref(type: string): string {
  return HREFS[type as NotificationType] ?? "/shifts";
}
