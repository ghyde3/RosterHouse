"use client";

import { Button } from "@/components/ui/Button";
import styles from "@/components/employee/employee.module.css";

export default function EmployeeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.errorWrap}>
      <div className={styles.errorTitle}>Something went wrong</div>
      <div className={styles.muted}>
        We couldn&apos;t load this screen. Your data is safe.
      </div>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
