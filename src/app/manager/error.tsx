"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ManagerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="Something went wrong loading this page"
      description="Check your connection and try again."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
