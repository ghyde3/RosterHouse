"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  token: string;
  inviterName: string;
  locationName: string;
  positionName: string | null;
  defaultName: string;
};

type FieldErrors = { name?: string; phone?: string; password?: string; form?: string };

export function AcceptInviteForm({ token, inviterName, locationName, positionName, defaultName }: Props) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!phone.trim()) next.phone = "Enter your phone number.";
    if (password.length < 8) next.password = "Password needs at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password }),
      });
      const body = await res.json();
      if (!body.ok) {
        setSubmitting(false);
        const { code, message } = body.error;
        if (code === "invalid_phone" || code === "phone_taken") setErrors({ phone: message });
        else setErrors({ form: message });
        return;
      }

      const signInRes = await signIn("credentials", {
        identifier: phone.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setSubmitting(false);
        setErrors({
          form: "Your account was created, but logging in failed. Go to the login page and use your phone number and password.",
        });
        return;
      }
      window.location.assign("/shifts");
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
        gap: 16,
        padding: "48px 24px 24px",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        Accept invite
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        {inviterName} invited you to join <strong style={{ color: "var(--text-primary)" }}>{locationName}</strong> on
        RosterHouse{positionName ? ` as a ${positionName.toLowerCase()}` : ""}.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Full name" placeholder="Maria Garcia" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Phone number" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        <Input label="Create password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        {errors.form && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{errors.form}</p>
        )}
        <Button variant="primary" fullWidth size="lg" type="submit" disabled={submitting}>
          {submitting ? "Joining…" : "Join team"}
        </Button>
      </form>
    </main>
  );
}
