"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TemplateShiftDialog from "@/components/schedule/TemplateShiftDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import { useToast } from "@/components/ui/Toaster";
import type { EmployeeOption } from "@/lib/schedule-data";
import type { TemplateDetail, TemplateRow } from "@/lib/template-data";
import type { TemplateRowInput } from "@/lib/template-schemas";
import gridStyles from "./grids.module.css";
import styles from "./schedule.module.css";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type EditorRow = {
  key: string;
  positionId: string;
  employeeProfileId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};

export function detailRowsToEditor(rows: TemplateRow[]): EditorRow[] {
  return rows.map((r) => ({
    key: r.id,
    positionId: r.positionId,
    employeeProfileId: r.employeeProfileId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes,
  }));
}

export function editorRowsToInput(rows: EditorRow[]): TemplateRowInput[] {
  return rows.map((r) => ({
    positionId: r.positionId,
    employeeProfileId: r.employeeProfileId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes,
  }));
}

type TemplateEditorProps = {
  template: TemplateDetail;
  positions: { id: string; name: string }[];
  employees: EmployeeOption[];
};

export default function TemplateEditor({ template, positions, employees }: TemplateEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(template.name);
  const [rows, setRows] = useState<EditorRow[]>(detailRowsToEditor(template.rows));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<EditorRow | null>(null);
  const [saving, setSaving] = useState(false);

  function employeeName(id: string | null): string | null {
    if (!id) return null;
    return employees.find((e) => e.employeeProfileId === id)?.name ?? "Assigned";
  }

  function openAdd(positionId: string, dayOfWeek: number) {
    setDialogInitial({ key: "", positionId, employeeProfileId: null, dayOfWeek, startTime: "", endTime: "", notes: null });
    setDialogOpen(true);
  }

  function upsertRow(row: EditorRow) {
    setRows((prev) => (prev.some((r) => r.key === row.key) ? prev.map((r) => (r.key === row.key ? row : r)) : [...prev, row]));
  }

  function deleteRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rows: editorRowsToInput(rows) }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template saved" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save template", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSaving(false);
    }
  }

  const byCell = new Map<string, EditorRow[]>();
  for (const r of rows) {
    const key = `${r.positionId}|${r.dayOfWeek}`;
    byCell.set(key, [...(byCell.get(key) ?? []), r]);
  }

  return (
    <div>
      <div className={styles.header}>
        <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className={styles.actions}>
          <Button variant="primary" onClick={save} disabled={saving || !name.trim()}>
            Save template
          </Button>
        </div>
      </div>

      <div className={gridStyles.weekGrid}>
        <div className={gridStyles.headerRow}>
          <div />
          {DOW_LABELS.map((d) => (
            <div key={d} className={gridStyles.dayLabel}>
              {d}
            </div>
          ))}
        </div>
        {positions.map((position) => (
          <div key={position.id} className={gridStyles.positionRow}>
            <div className={gridStyles.positionLabel}>{position.name}</div>
            {DOW_LABELS.map((label, dow) => {
              const cellRows = byCell.get(`${position.id}|${dow}`) ?? [];
              if (cellRows.length === 0) {
                return (
                  <WeekGridCell
                    key={dow}
                    empty
                    onClick={() => openAdd(position.id, dow)}
                    addLabel={`Add ${position.name} on ${label}`}
                  />
                );
              }
              return (
                <WeekGridCell key={dow}>
                  <div className={gridStyles.cellStack}>
                    {cellRows.map((r) => (
                      <ShiftBlock
                        key={r.key}
                        compact
                        role={employeeName(r.employeeProfileId) ?? "Open shift"}
                        time={`${r.startTime} – ${r.endTime}`}
                        status={r.employeeProfileId ? "confirmed" : "open"}
                        onClick={() => {
                          setDialogInitial(r);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      className={gridStyles.addButton}
                      aria-label={`Add ${position.name} on ${label}`}
                      onClick={() => openAdd(position.id, dow)}
                    >
                      + Add
                    </button>
                  </div>
                </WeekGridCell>
              );
            })}
          </div>
        ))}
      </div>

      <TemplateShiftDialog
        open={dialogOpen}
        positions={positions}
        employees={employees}
        initial={dialogInitial}
        onSave={upsertRow}
        onDelete={deleteRow}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
