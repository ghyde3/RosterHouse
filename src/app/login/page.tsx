import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in — RosterHouse" };

export default function LoginPage() {
  return <LoginForm />;
}
