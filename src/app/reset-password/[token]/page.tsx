import type { Metadata } from "next";
import Link from "next/link";
import { getPasswordResetByToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password — RosterHouse" };

function ResetProblem({ title }: { title: string }) {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "72px 24px 24px",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Request a new one and try again.</p>
      <Link href="/forgot-password" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
        Request a new link
      </Link>
      <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
        Go to log in
      </Link>
    </main>
  );
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await getPasswordResetByToken(token);

  if (!reset) {
    return <ResetProblem title="That reset link isn't valid." />;
  }
  if (reset.status === "used") {
    return <ResetProblem title="That reset link was already used." />;
  }
  if (reset.status === "expired") {
    return <ResetProblem title="That reset link has expired." />;
  }

  return <ResetPasswordForm token={token} userName={reset.userName} />;
}
