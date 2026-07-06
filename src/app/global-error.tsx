// Branded fallback when the root layout itself fails to render. Next.js
// replaces the entire document with this component, so it must be a client
// component and render its own <html>/<body>.
"use client";

import "./globals.css";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "64px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            We couldn&apos;t load this page. Your data is safe.
          </div>
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
