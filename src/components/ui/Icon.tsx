import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Play,
  Plus,
  Repeat,
  Settings,
  Square,
  Sun,
  Timer,
  User,
  Users,
  X,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

/**
 * Pinned icon set. The export loaded lucide from an unpinned CDN and called
 * createIcons() on <i data-lucide="..."> tags; this replaces that pattern
 * with tree-shakeable, versioned imports. Add names here only when a screen
 * actually uses them.
 */
const ICONS = {
  "alert-triangle": AlertTriangle,
  "arrow-left": ArrowLeft,
  bell: Bell,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  clock: Clock,
  inbox: Inbox,
  "layout-dashboard": LayoutDashboard,
  "log-out": LogOut,
  "map-pin": MapPin,
  play: Play,
  plus: Plus,
  repeat: Repeat,
  settings: Settings,
  square: Square,
  sun: Sun,
  timer: Timer,
  user: User,
  users: Users,
  x: X,
} as const;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
} & Omit<LucideProps, "size" | "ref">;

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  ...rest
}: IconProps) {
  const LucideIcon = ICONS[name];
  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}
