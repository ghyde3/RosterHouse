"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplatesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.errorWrap}>
      <EmptyState
        title="Something went wrong loading templates"
        description="Check your connection and try again."
        action={
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
