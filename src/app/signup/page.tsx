import type { Metadata } from "next";
import { SignupWizard } from "./SignupWizard";

export const metadata: Metadata = { title: "Create your account — RosterHouse" };

export default function SignupPage() {
  return <SignupWizard />;
}
