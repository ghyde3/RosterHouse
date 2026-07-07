"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toaster";
import type { ISODate } from "@/lib/time";

type SaveAsTemplateDialogProps = {
  open: boolean;
  week: ISODate;
  onClose: () => void;
};

export default function SaveAsTemplateDialog({ open, week, onClose }: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName("");
    setError(undefined);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name your template");
      return;
    }
    onClose();
    try {
      const res = await fetch("/api/schedule-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, fromWeek: week }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template saved", description: `"${trimmed}" is ready to apply.` });
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save template",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save week as template"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save template
          </Button>
        </>
      }
    >
      <Input
        label="Template name"
        placeholder="e.g. Standard week"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
      />
    </Dialog>
  );
}
