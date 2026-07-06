import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { ToasterProvider } from "@/components/ui/Toaster";
import styles from "./layout.module.css";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  // Middleware already redirects unauthenticated/wrong-role users away from
  // these routes; requireUser() here is defense-in-depth (matches the
  // manager layout's pattern) and is not a role check.
  await requireUser();

  return (
    <ToasterProvider>
      <div className={styles.shell}>
        <main className={styles.content}>{children}</main>
        <EmployeeTabBar />
      </div>
    </ToasterProvider>
  );
}
