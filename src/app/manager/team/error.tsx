"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TeamError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="Something went wrong loading your team"
      description="Give it another try. If it keeps happening, check your connection."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
