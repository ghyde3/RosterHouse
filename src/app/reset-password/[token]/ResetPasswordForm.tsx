"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  token: string;
  userName?: string;
};

type FieldErrors = { password?: string; confirm?: string; form?: string };

export function ResetPasswordForm({ token, userName }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (password.length < 8) next.password = "Password needs at least 8 characters.";
    if (!next.password && confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!body.ok) {
        setSubmitting(false);
        const { code, message } = body.error ?? {};
        if (code === "reset_used" || code === "reset_expired" || code === "reset_not_found") {
          setErrors({ form: message });
        } else {
          setErrors({ form: "Something went wrong — try again." });
        }
        return;
      }
      setDone(true);
    } catch {
      setSubmitting(false);
      setErrors({ form: "Something went wrong — try again." });
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
        Reset your password
      </h1>
      {done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Password updated. Log in with your new password.
          </p>
          <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
            Go to log in
          </Link>
        </div>
      ) : (
        <>
          {userName && (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Hi {userName} — choose a new password for your account.
            </p>
          )}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Input
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <Input
              label="Confirm new password"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
            />
            {errors.form && (
              <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>
                {errors.form}
              </p>
            )}
            <Button variant="primary" size="lg" fullWidth type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Set new password"}
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
