"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";

const DEFAULT_POSITIONS = ["Line cook", "Server", "Dishwasher", "Host"];
const STEP_TITLES = ["Your details", "Your business", "Your first location", "Positions"];

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "password" | "businessName" | "locationName" | "timezone" | "positions" | "form", string>
>;

export function SignupWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [positions, setPositions] = useState<string[]>(DEFAULT_POSITIONS);
  const [newPosition, setNewPosition] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const timezoneOptions = useMemo(
    () => Intl.supportedValuesOf("timeZone").map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") })),
    [],
  );

  function validateStep(current: number): FieldErrors {
    const next: FieldErrors = {};
    if (current === 0) {
      if (!name.trim()) next.name = "Enter your name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
      if (phone.trim() && phone.trim().replace(/\D/g, "").length < 10) {
        next.phone = "That phone number doesn't look right. Use 10 digits, like (555) 123-4567.";
      }
      if (password.length < 8) next.password = "Password needs at least 8 characters.";
    }
    if (current === 1 && !businessName.trim()) next.businessName = "Enter your business name.";
    if (current === 2) {
      if (!locationName.trim()) next.locationName = "Enter a location name.";
      if (!timezone) next.timezone = "Choose a timezone.";
    }
    if (current === 3 && positions.length === 0) next.positions = "Add at least one position.";
    return next;
  }

  function handleContinue() {
    const stepErrors = validateStep(step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep(step + 1);
  }

  function addPosition() {
    const value = newPosition.trim();
    if (!value) return;
    if (positions.some((p) => p.toLowerCase() === value.toLowerCase())) {
      setErrors({ positions: `"${value}" is already on the list.` });
      return;
    }
    setPositions([...positions, value]);
    setNewPosition("");
    setErrors({});
  }

  async function handleSubmit() {
    const stepErrors = validateStep(3);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          businessName: businessName.trim(),
          locationName: locationName.trim(),
          timezone,
          positions,
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setSubmitting(false);
        setErrors({ form: body.error.message });
        return;
      }
      const signInRes = await signIn("credentials", {
        identifier: email.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setSubmitting(false);
        setErrors({ form: "Your account was created, but logging in failed. Go to the login page and use your new details." });
        return;
      }
      // submitting intentionally stays true through the full-page navigation
      // so the button doesn't flash back to enabled before it completes.
      window.location.assign("/manager");
    } catch {
      setSubmitting(false);
      setErrors({ form: "Something went wrong — try again." });
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "72px 24px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-brand)" }}>RosterHouse</div>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 3) handleContinue();
              else void handleSubmit();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Step {step + 1} of 4
              </div>
              <h1 style={{ fontSize: "var(--text-h2-size)", fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                {STEP_TITLES[step]}
              </h1>
            </div>

            {step === 0 && (
              <>
                <Input label="Your name" placeholder="Jamie Park" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
                <Input label="Email" placeholder="jamie@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
                <Input label="Phone (optional)" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
                <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
              </>
            )}

            {step === 1 && (
              <Input label="Business name" placeholder="Harbor & Vine" value={businessName} onChange={(e) => setBusinessName(e.target.value)} error={errors.businessName} />
            )}

            {step === 2 && (
              <>
                <Input label="Location name" placeholder="Downtown" value={locationName} onChange={(e) => setLocationName(e.target.value)} error={errors.locationName} />
                <Select label="Timezone" value={timezone} onChange={setTimezone} options={timezoneOptions} placeholder="Choose a timezone" />
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  All shift times are shown in this location&apos;s timezone.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  These are the roles you schedule people into. You can add more later.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {positions.map((position) => (
                    <Tag key={position} onRemove={() => setPositions(positions.filter((p) => p !== position))}>
                      {position}
                    </Tag>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Input label="Add a position" placeholder="Bartender" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
                  </div>
                  <Button variant="secondary" type="button" onClick={addPosition}>
                    Add
                  </Button>
                </div>
                {errors.positions && (
                  <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{errors.positions}</p>
                )}
              </>
            )}

            {errors.form && (
              <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{errors.form}</p>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              {step > 0 ? (
                <Button variant="ghost" type="button" onClick={() => { setErrors({}); setStep(step - 1); }}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button variant="primary" type="submit" disabled={submitting}>
                {step < 3 ? "Continue" : submitting ? "Creating your account…" : "Create account"}
              </Button>
            </div>
          </form>
        </Card>
        <div style={{ textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--text-brand)", fontWeight: 600 }}>
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
