import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline — RosterHouse" };

// Precached by public/sw.js and served as the fallback when a navigation
// fails offline. Keep it static and self-contained — no data, no client JS.
export default function OfflinePage() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "72px 24px 24px",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-brand)" }}>RosterHouse</div>
      <h1
        style={{
          fontSize: "var(--text-h2-size)",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginTop: 12,
        }}
      >
        You’re offline.
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        Your schedule will load when you’re back online.
      </p>
    </main>
  );
}
