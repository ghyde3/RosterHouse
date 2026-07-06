"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import styles from "./EmployeeTabBar.module.css";

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/shifts", label: "Shifts", icon: "calendar" },
  { href: "/availability", label: "Availability", icon: "calendar-check" },
  { href: "/clock", label: "Clock", icon: "timer" },
  { href: "/swaps", label: "Open shifts", icon: "repeat" },
  { href: "/profile", label: "Profile", icon: "user" },
];

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type EmployeeTabBarProps = { className?: string };

export function EmployeeTabBar({ className }: EmployeeTabBarProps) {
  const pathname = usePathname();
  return (
    <nav className={cx(styles.bar, className)} aria-label="Employee">
      {TABS.map((t) => {
        const active = isActive(t.href, pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(styles.tab, active && styles.tabActive)}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={t.icon} size={19} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
