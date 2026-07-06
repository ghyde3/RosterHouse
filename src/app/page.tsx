export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-5, 16px)",
        padding: "var(--space-8, 32px)",
      }}
    >
      <h1
        style={{
          fontWeight: 800,
          color: "var(--text-brand)",
          fontSize: "2.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        RosterHouse
      </h1>
      <p
        style={{
          color: "var(--text-secondary)",
          maxWidth: "36ch",
          textAlign: "center",
        }}
      >
        Shift management for hourly teams. The app shell is set up — screens
        get wired in next.
      </p>
    </main>
  );
}
