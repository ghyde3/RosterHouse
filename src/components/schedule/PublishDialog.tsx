"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toaster";

type PublishDialogProps = {
  open: boolean;
  scheduleId: string;
  employeeCount: number;
  isRepublish: boolean;
  onClose: () => void;
};

function employeesPhrase(n: number): string {
  if (n === 0) return "No employees are assigned yet, so no one will be notified.";
  if (n === 1) return "1 employee will be notified.";
  return `${n} employees will be notified.`;
}

export default function PublishDialog({
  open,
  scheduleId,
  employeeCount,
  isRepublish,
  onClose,
}: PublishDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/publish`, { method: "POST" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      onClose();
      const n: number = body.data.count; // the REAL count from the server
      toast({
        tone: "success",
        title: isRepublish ? "Changes published" : "Schedule published",
        description: n === 1 ? "1 employee notified." : `${n} employees notified.`,
      });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't publish schedule",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isRepublish ? "Publish changes?" : "Publish this week's schedule?"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={publishing} onClick={handlePublish}>
            Publish
          </Button>
        </>
      }
    >
      {employeesPhrase(employeeCount)}
    </Dialog>
  );
}
