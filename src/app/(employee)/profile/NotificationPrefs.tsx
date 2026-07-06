"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toaster";
import styles from "@/components/employee/employee.module.css";

type Prefs = { notifyPush: boolean; notifySms: boolean; notifyEmail: boolean };

const LABELS: Record<keyof Prefs, string> = {
  notifyPush: "Push notifications",
  notifySms: "Text messages (SMS)",
  notifyEmail: "Email",
};

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const { toast } = useToast();

  async function setPref(key: keyof Prefs, value: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value }); // optimistic
    try {
      const res = await fetch("/api/me/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
    } catch {
      setPrefs(previous); // revert on error
      toast({
        tone: "danger",
        title: "Couldn't save your notification preferences",
        description: "Check your connection and try again.",
      });
    }
  }

  return (
    <Card>
      <div className={styles.cardStack}>
        {(Object.keys(LABELS) as (keyof Prefs)[]).map((key) => (
          <Switch
            key={key}
            label={LABELS[key]}
            checked={prefs[key]}
            onChange={(v) => setPref(key, v)}
          />
        ))}
      </div>
    </Card>
  );
}
