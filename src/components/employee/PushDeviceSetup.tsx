"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toaster";
import styles from "@/components/employee/employee.module.css";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = "checking" | "unsupported" | "subscribed" | "unsubscribed";

export function PushDeviceSetup() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const { toast } = useToast();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) {
        setState("unsupported");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = registration
          ? await registration.pushManager.getSubscription()
          : null;
        if (!cancelled) setState(subscription ? "subscribed" : "unsubscribed");
      } catch {
        if (!cancelled) setState("unsubscribed");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enablePush() {
    if (!publicKey) return;
    setBusy(true);
    setBlocked(false);
    // Roll back the browser subscription whenever the server never recorded
    // it — otherwise the next mount finds the orphan and shows "push is on"
    // while no notification can ever be delivered.
    let subscription: PushSubscription | null = null;
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setBlocked(true);
        return;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const res = await fetch("/api/me/push-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          },
        }),
      });
      if (!res.ok) {
        await subscription.unsubscribe();
        toast({ tone: "danger", title: "Couldn't enable push notifications." });
        return;
      }
      subscription = null;
      setState("subscribed");
    } catch {
      if (subscription) await subscription.unsubscribe().catch(() => {});
      toast({ tone: "danger", title: "Couldn't enable push notifications." });
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/me/push-devices", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("unsubscribed");
    } catch {
      toast({ tone: "danger", title: "Couldn't turn off push notifications." });
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;

  if (state === "unsupported") {
    return (
      <Card>
        <div className={styles.muted}>Push isn&apos;t available on this device.</div>
      </Card>
    );
  }

  return (
    <Card>
      <div className={styles.cardStack}>
        <div className={styles.cardRow}>
          <div className={styles.muted}>
            {state === "subscribed"
              ? "Push is on for this device."
              : "Get shift alerts on this device."}
          </div>
          {state === "subscribed" ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={disablePush}>
              Turn off
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={enablePush}>
              {busy ? "Enabling…" : "Enable push"}
            </Button>
          )}
        </div>
        {blocked && (
          <div className={styles.dangerNote}>
            Notifications are blocked in your browser settings.
          </div>
        )}
      </div>
    </Card>
  );
}
