"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import { COMMON_US_TIMEZONES } from "@/app/manager/settings/LocationSettingsForm";
import styles from "./locations.module.css";

export type LocationRow = {
  id: string;
  name: string;
  timezone: string;
  address: string | null;
  employeeCount: number;
};

export type LocationsViewProps = {
  activeLocationId: string;
  locations: LocationRow[];
};

export function LocationsView({ activeLocationId, locations }: LocationsViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string>(COMMON_US_TIMEZONES[0].value);
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const tzOptions: SelectOption[] = COMMON_US_TIMEZONES;

  async function switchTo(locationId: string) {
    setSwitchingTo(locationId);
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
      setSwitchingTo(null);
    }
  }

  async function addLocation() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a location name");
      return;
    }
    setNameError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          timezone,
          address: address.trim() === "" ? null : address.trim(),
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        toast({ tone: "danger", title: "Couldn't add the location", description: body.error?.message });
        return;
      }
      setName("");
      setAddress("");
      toast({
        tone: "success",
        title: `${body.data.location.name} added`,
        description: "You're now managing it — set up positions and invite the team.",
      });
      // The API switched the active-location cookie to the new location.
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't add the location", description: "Try again." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.stack}>
      <Card>
        <div className={styles.list}>
          {locations.map((location) => {
            const active = location.id === activeLocationId;
            return (
              <div key={location.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowName}>
                    {location.name}
                    {active && <Badge tone="info">Current</Badge>}
                  </div>
                  <div className={styles.rowMeta}>
                    {location.timezone}
                    {location.address ? ` · ${location.address}` : ""}
                    {` · ${location.employeeCount} ${location.employeeCount === 1 ? "team member" : "team members"}`}
                  </div>
                </div>
                {!active && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => switchTo(location.id)}
                    disabled={switchingTo !== null}
                  >
                    {switchingTo === location.id ? "Switching…" : "Switch to"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Add a location</h2>
        <p className={styles.sectionHint}>
          New locations start empty — after adding one, set up its positions and invite the team.
        </p>
        <div className={styles.form}>
          <Input
            label="Location name"
            placeholder="Downtown"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError ?? undefined}
          />
          <Select label="Time zone" value={timezone} onChange={setTimezone} options={tzOptions} />
          <Input
            label="Address (optional)"
            placeholder="123 Main St"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div>
            <Button onClick={addLocation} disabled={adding}>
              {adding ? "Adding…" : "Add location"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
