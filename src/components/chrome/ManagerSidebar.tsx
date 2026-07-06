"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { initialsOf } from "@/components/ui/initials";
import styles from "./ManagerSidebar.module.css";

const NAV: Array<{
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}> = [
  { href: "/manager", label: "Dashboard", icon: "layout-dashboard", exact: true },
  { href: "/manager/schedule", label: "Schedule", icon: "calendar" },
  { href: "/manager/team", label: "Team", icon: "users" },
  { href: "/manager/availability", label: "Availability", icon: "calendar-check" },
  { href: "/manager/time-off", label: "Time off", icon: "clock" },
  { href: "/manager/swaps", label: "Swaps & open shifts", icon: "repeat" },
];

export type ManagerSidebarProps = {
  locationName: string;
  userName: string;
};

export function ManagerSidebar({ locationName, userName }: ManagerSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>RosterHouse</div>
      <div className={styles.location}>
        <Icon name="map-pin" size={14} />
        <span>{locationName}</span>
      </div>
      <nav className={styles.nav} aria-label="Manager">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(styles.navItem, active && styles.navItemActive)}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.user}>
        <span className={styles.userAvatar} aria-hidden="true">
          {initialsOf(userName)}
        </span>
        <span>{userName}</span>
      </div>
    </aside>
  );
}
