"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import styles from "./settings.module.css";

/** Common US zones for the config Select. Server accepts any valid IANA zone. */
export const COMMON_US_TIMEZONES: SelectOption[] = [
  { value: "America/New_York", label: "Eastern — America/New_York" },
  { value: "America/Chicago", label: "Central — America/Chicago" },
  { value: "America/Denver", label: "Mountain — America/Denver" },
  { value: "America/Phoenix", label: "Mountain (no DST) — America/Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { value: "America/Anchorage", label: "Alaska — America/Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Pacific/Honolulu" },
];

export type LocationSettingsFormProps = {
  locationId: string;
  name: string;
  timezone: string;
  overtimeHoursPerWeek: number | null;
  address: string | null;
};

export function LocationSettingsForm({
  locationId,
  name: initialName,
  timezone: initialTimezone,
  overtimeHoursPerWeek: initialOvertime,
  address: initialAddress,
}: LocationSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [overtime, setOvertime] = useState(initialOvertime === null ? "" : String(initialOvertime));
  const [address, setAddress] = useState(initialAddress ?? "");
  const [saving, setSaving] = useState(false);

  // If the manager picked a zone not in the common list, add it so the Select
  // shows their current value instead of collapsing to the placeholder.
  const tzOptions: SelectOption[] = COMMON_US_TIMEZONES.some((o) => o.value === timezone)
    ? COMMON_US_TIMEZONES
    : [...COMMON_US_TIMEZONES, { value: timezone, label: timezone }];

  async function handleSave() {
    if (timezone !== initialTimezone) {
      const ok = window.confirm(
        "Changing the time zone changes how all existing times display. Save anyway?",
      );
      if (!ok) return;
    }
    const trimmedOvertime = overtime.trim();
    const trimmedAddress = address.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          timezone,
          overtimeHoursPerWeek: trimmedOvertime === "" ? null : Number(trimmedOvertime),
          address: trimmedAddress === "" ? null : trimmedAddress,
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Location saved" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save location",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <Input
        label="Location name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Select
        label="Time zone"
        value={timezone}
        options={tzOptions}
        onChange={(value) => setTimezone(value)}
      />
      <Input
        label="Overtime threshold (hours/week)"
        type="number"
        min={0}
        placeholder="Leave blank to turn off overtime conflicts"
        value={overtime}
        onChange={(e) => setOvertime(e.target.value)}
      />
      <Input
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
