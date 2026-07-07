"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import styles from "./settings.module.css";

const LINKS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/manager/settings", label: "Location", exact: true },
  { href: "/manager/settings/locations", label: "Locations" },
  { href: "/manager/settings/positions", label: "Positions" },
  { href: "/manager/settings/templates", label: "Templates" },
  { href: "/manager/settings/activity", label: "Activity" },
];

export function SettingsSubnav() {
  const pathname = usePathname();
  return (
    <nav className={styles.subnav} aria-label="Settings">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(styles.subnavLink, active && styles.subnavLinkActive)}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
