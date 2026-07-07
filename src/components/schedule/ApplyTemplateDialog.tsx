"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { qualifiedEmployees } from "@/components/schedule/AssignShiftDialog";
import { Button } from "@/components/ui/Button";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import type { EmployeeOption } from "@/lib/schedule-data";
import type { TemplatePreview, TemplateSummary } from "@/lib/template-data";
import { addDaysISO, formatDateShort, type ISODate } from "@/lib/time";
import styles from "./ApplyTemplateDialog.module.css";

export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function nextMondays(week: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(week, i * 7));
}

export function assignmentsFromPreview(preview: TemplatePreview): Record<string, string> {
  return Object.fromEntries(preview.rows.map((r) => [r.rowId, r.defaultEmployeeProfileId ?? ""]));
}

export function defaultMode(occupancy: { draftCount: number; publishedCount: number }): "replace" | "add" {
  return occupancy.draftCount > 0 ? "replace" : "add";
}

type ApplyTemplateDialogProps = {
  open: boolean;
  week: ISODate;
  employees: EmployeeOption[];
  onClose: () => void;
};

export default function ApplyTemplateDialog({ open, week, employees, onClose }: ApplyTemplateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<"pick" | "review">("pick");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [targetWeek, setTargetWeek] = useState<ISODate>(week);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [mode, setMode] = useState<"replace" | "add">("add");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStep("pick");
    setTemplateId("");
    setTargetWeek(week);
    setPreview(null);
    setAssignments({});
    /* eslint-enable react-hooks/set-state-in-effect */
    void (async () => {
      try {
        const res = await fetch("/api/schedule-templates");
        const body = await res.json();
        if (body.ok) setTemplates(body.data.templates);
      } catch {
        // leave the list empty; the pick step shows the empty message
      }
    })();
  }, [open, week]);

  async function handleNext() {
    if (!templateId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/schedule-templates/${templateId}/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetWeek }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      const p: TemplatePreview = body.data.preview;
      setPreview(p);
      setAssignments(assignmentsFromPreview(p));
      setMode(defaultMode(p.occupancy));
      setStep("review");
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't preview template", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setBusy(true);
    onClose();
    try {
      const res = await fetch(`/api/schedule-templates/${preview.templateId}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetWeek: preview.targetWeek,
          mode,
          assignments: Object.fromEntries(
            Object.entries(assignments).map(([rowId, ep]) => [rowId, ep === "" ? null : ep]),
          ),
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      const { created, openCount } = body.data.result;
      toast({
        tone: "success",
        title: "Template applied",
        description: `${created} shift${created === 1 ? "" : "s"} added${openCount ? `, ${openCount} left open` : ""}.`,
      });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't apply template", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  }

  const weekOptions = nextMondays(week, 6).map((w) => ({ value: w, label: `Week of ${formatDateShort(w)}` }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === "pick" ? "Apply a template" : `Apply "${preview?.templateName ?? ""}"`}
      footer={
        step === "pick" ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleNext} disabled={!templateId || busy}>Next</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep("pick")}>Back</Button>
            <Button variant="primary" onClick={handleApply} disabled={busy}>Apply template</Button>
          </>
        )
      }
    >
      {step === "pick" && (
        <div className={styles.stack}>
          {templates.length === 0 ? (
            <p className={styles.empty}>No templates yet. Build a week and use “Save as template” first.</p>
          ) : (
            <>
              <Select
                label="Template"
                value={templateId}
                onChange={setTemplateId}
                placeholder="Choose a template"
                options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.rowCount} shifts)` }))}
              />
              <Select
                label="Apply to"
                value={targetWeek}
                onChange={(v) => setTargetWeek(v as ISODate)}
                options={weekOptions}
              />
            </>
          )}
        </div>
      )}

      {step === "review" && preview && (
        <div className={styles.stack}>
          {preview.occupancy.draftCount > 0 && (
            <Select
              label="This week already has draft shifts"
              value={mode}
              onChange={(v) => setMode(v as "replace" | "add")}
              options={[
                { value: "replace", label: "Replace existing draft shifts" },
                { value: "add", label: "Add on top of them" },
              ]}
            />
          )}
          {preview.occupancy.publishedCount > 0 && (
            <p className={styles.warning}>
              This week has {preview.occupancy.publishedCount} published shift
              {preview.occupancy.publishedCount === 1 ? "" : "s"} — those are left untouched; new shifts come in as drafts.
            </p>
          )}
          <div className={styles.rows}>
            {preview.rows.map((r) => (
              <div key={r.rowId} className={styles.row}>
                <div className={styles.rowMeta}>
                  <div className={styles.rowMetaTitle}>
                    {DOW_LABELS[r.dayOfWeek]} · {r.positionName}
                  </div>
                  <div>{r.timeRange}</div>
                </div>
                <div>
                  <Select
                    value={assignments[r.rowId] ?? ""}
                    onChange={(v) => setAssignments((a) => ({ ...a, [r.rowId]: v }))}
                    placeholder="Open shift (unassigned)"
                    options={qualifiedEmployees(employees, r.positionId).map((e) => ({
                      value: e.employeeProfileId,
                      label: e.name,
                    }))}
                  />
                  {r.conflicts.length > 0 && (
                    <div className={styles.conflicts}>
                      {r.conflicts.map((c) => (
                        <ConflictChip key={c.message}>{c.message}</ConflictChip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
