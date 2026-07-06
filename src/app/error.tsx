"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Root safety net for uncaught errors anywhere in the app (e.g. an
 * unexpected ApiError bubbling out of a server component with no more
 * specific error boundary above it). Deliberately calm, generic copy —
 * this is a last resort, not a debugging surface.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>
      <EmptyState
        title="Something went wrong"
        description="Try again, or go back to the home page."
        action={
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <Button variant="secondary" onClick={reset}>
              Try again
            </Button>
            <Link href="/">
              <Button variant="ghost">Go home</Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
