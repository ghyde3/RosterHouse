"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) {
      setError("Enter your phone or email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const body = await res.json();
      if (!body.ok) {
        setSubmitting(false);
        setError(body.error?.message ?? "Something went wrong — try again.");
        return;
      }
      setSent(true);
    } catch {
      setSubmitting(false);
      setError("Something went wrong — try again.");
    }
  }

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
      {sent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Check your messages.</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            If that matches an account, we sent a password reset link. Check your texts or email.
          </p>
          <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
            Back to log in
          </Link>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Enter the phone number or email on your account and we&apos;ll send you a link to reset it.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Input
              label="Phone or email"
              placeholder="maria@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            {error && (
              <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
                {error}
              </p>
            )}
            <Button variant="primary" size="lg" fullWidth type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <div style={{ textAlign: "center" }}>
            <Link href="/login" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Back to log in
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
