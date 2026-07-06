"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Enter your phone or email and your password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setSubmitting(false);
        setError("That phone/email or password doesn't match.");
        return;
      }
      // Middleware redirects signed-in users from "/" to their home (manager
      // → "/manager", employee → "/shifts"); a full navigation makes sure the
      // new session cookie is picked up. Submitting stays true so the button
      // doesn't flash back to enabled before the navigation happens.
      window.location.assign("/");
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
        Log in
      </h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Input
          label="Phone or email"
          placeholder="maria@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
        />
        <Button variant="primary" size="lg" fullWidth type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <div style={{ textAlign: "center" }}>
        <Link href="/forgot-password" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Forgot password?
        </Link>
      </div>
      <div style={{ marginTop: "auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          New here? Use the invite link your manager sent you.
        </span>
        <Link href="/signup" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
          Setting up a business? Create an account
        </Link>
      </div>
    </main>
  );
}
