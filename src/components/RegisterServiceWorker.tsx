"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js for every visitor so the offline cache and push handlers
 * are in place before any feature needs them. Registration is idempotent for
 * the same script URL, so PushDeviceSetup's own register call is unaffected.
 * Fire-and-forget: registration failing must never break the page.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Offline support is progressive enhancement — ignore failures.
      });
  }, []);
  return null;
}
