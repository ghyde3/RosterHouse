import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Forgot password — RosterHouse" };

export default function ForgotPasswordPage() {
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
      <h1 style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", marginTop: 12 }}>
        Forgot your password?
      </h1>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 14, color: "var(--text-primary)" }}>
            Password reset by email isn&apos;t available yet.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Ask your manager for a reset link — they can send you a fresh invite that lets you set a
            new password. If you manage this account, hold tight: self-serve reset is coming soon.
          </p>
        </div>
      </Card>
      <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600, textAlign: "center" }}>
        Back to log in
      </Link>
    </main>
  );
}
