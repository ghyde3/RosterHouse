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

/**
 * Trimmed overtime-hours input → a valid PATCH value, or `"invalid"` if it's
 * non-empty but not a finite number (e.g. Number(trimmed) is NaN/Infinity).
 * A real type="number" input can't produce such a string through typing, but
 * paste, autofill, and non-JS API callers all can — this guard is the last
 * line of defense against Number("junk") silently coercing to null and
 * turning off overtime conflicts for the location.
 */
export function parseOvertimeInput(trimmed: string): number | null | "invalid" {
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : "invalid";
}

export type LocationSettingsFormProps = {
  locationId: string;
  name: string;
  timezone: string;
  overtimeHoursPerWeek: number | null;
  minRestHours: number | null;
  maxConsecutiveDays: number | null;
  address: string | null;
};

export function LocationSettingsForm({
  locationId,
  name: initialName,
  timezone: initialTimezone,
  overtimeHoursPerWeek: initialOvertime,
  minRestHours: initialMinRest,
  maxConsecutiveDays: initialMaxDays,
  address: initialAddress,
}: LocationSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [overtime, setOvertime] = useState(initialOvertime === null ? "" : String(initialOvertime));
  const [overtimeError, setOvertimeError] = useState<string | undefined>(undefined);
  const [minRest, setMinRest] = useState(initialMinRest === null ? "" : String(initialMinRest));
  const [minRestError, setMinRestError] = useState<string | undefined>(undefined);
  const [maxDays, setMaxDays] = useState(initialMaxDays === null ? "" : String(initialMaxDays));
  const [maxDaysError, setMaxDaysError] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState(initialAddress ?? "");
  const [saving, setSaving] = useState(false);

  // If the manager picked a zone not in the common list, add it so the Select
  // shows their current value instead of collapsing to the placeholder.
  const tzOptions: SelectOption[] = COMMON_US_TIMEZONES.some((o) => o.value === timezone)
    ? COMMON_US_TIMEZONES
    : [...COMMON_US_TIMEZONES, { value: timezone, label: timezone }];

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Name your location");
      return;
    }
    setNameError(undefined);

    const parsedOvertime = parseOvertimeInput(overtime.trim());
    if (parsedOvertime === "invalid") {
      setOvertimeError("Enter a number, like 40");
      return;
    }
    setOvertimeError(undefined);

    const parsedMinRest = parseOvertimeInput(minRest.trim());
    if (parsedMinRest === "invalid") {
      setMinRestError("Enter a number, like 10");
      return;
    }
    setMinRestError(undefined);

    const parsedMaxDays = parseOvertimeInput(maxDays.trim());
    if (parsedMaxDays === "invalid") {
      setMaxDaysError("Enter a number, like 6");
      return;
    }
    setMaxDaysError(undefined);

    if (timezone !== initialTimezone) {
      const ok = window.confirm(
        "Changing the time zone changes how all existing times display. Save anyway?",
      );
      if (!ok) return;
    }
    const trimmedAddress = address.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          timezone,
          overtimeHoursPerWeek: parsedOvertime,
          minRestHours: parsedMinRest,
          maxConsecutiveDays: parsedMaxDays,
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
        error={nameError}
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
        error={overtimeError}
        onChange={(e) => setOvertime(e.target.value)}
      />
      <Input
        label="Minimum rest between shifts (hours)"
        type="number"
        min={1}
        max={24}
        placeholder="Leave blank to turn off rest conflicts"
        value={minRest}
        error={minRestError}
        onChange={(e) => setMinRest(e.target.value)}
      />
      <Input
        label="Max consecutive days"
        type="number"
        min={1}
        max={14}
        placeholder="Leave blank to turn off consecutive-day conflicts"
        value={maxDays}
        error={maxDaysError}
        onChange={(e) => setMaxDays(e.target.value)}
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
