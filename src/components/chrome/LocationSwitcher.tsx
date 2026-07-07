"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toaster";
import styles from "./LocationSwitcher.module.css";

export type LocationSwitcherProps = {
  locations: Array<{ id: string; name: string }>;
  activeLocationId: string;
};

/**
 * Sidebar location dropdown. Rendered only for multi-location orgs; picking
 * a location sets the active-location cookie server-side, then refreshes so
 * every server component re-renders against the new scope.
 */
export function LocationSwitcher({ locations, activeLocationId }: LocationSwitcherProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function switchTo(locationId: string) {
    if (locationId === activeLocationId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/active-location", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message);
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't switch locations", description: "Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={styles.switcher}>
      <Icon name="map-pin" size={14} />
      <span className={styles.srOnly}>Location</span>
      <select
        className={styles.select}
        value={activeLocationId}
        onChange={(e) => switchTo(e.target.value)}
        disabled={busy}
        aria-label="Location"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} />
    </label>
  );
}
