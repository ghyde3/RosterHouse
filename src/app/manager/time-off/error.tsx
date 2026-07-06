"use client";

import { Button } from "@/components/ui/Button";

export default function TimeOffError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "48px 0", textAlign: "center" }}>
      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 4px" }}>
        We couldn't load time-off requests.
      </p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
        Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
