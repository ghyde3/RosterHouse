// SMS bodies per notification type: "RosterHouse: {title}. {body} {url}".
// Sentence case, no exclamation points, one deep link into the app.
import type { NotificationType } from "@/generated/prisma/client";

const DEEP_LINK_PATHS: Record<NotificationType, string> = {
  schedule_published: "/shifts",
  shift_reminder: "/shifts",
  swap_approved: "/swaps",
  swap_denied: "/swaps",
  timeoff_approved: "/availability",
  timeoff_denied: "/availability",
  claim_approved: "/swaps",
  claim_denied: "/swaps",
  open_shift_posted: "/swaps",
};

export function deepLinkFor(type: NotificationType): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${DEEP_LINK_PATHS[type]}`;
}

export function smsBodyFor(input: { type: NotificationType; title: string; body: string }): string {
  return `RosterHouse: ${input.title}. ${input.body} ${deepLinkFor(input.type)}`;
}
