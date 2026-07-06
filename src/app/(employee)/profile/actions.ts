"use server";

import { signOut } from "@/lib/auth";

export async function logOut(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
