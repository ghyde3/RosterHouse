"use client";

import { useEffect, useState } from "react";
import { qualifiedEmployees } from "@/components/schedule/AssignShiftDialog";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TimeField } from "@/components/ui/TimeField";
import type { EmployeeOption } from "@/lib/schedule-data";
import { parseTime12h } from "@/lib/time";
import type { EditorRow } from "@/components/schedule/TemplateEditor";
import styles from "./AssignShiftDialog.module.css";

const DOW_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, value) => ({
  value: String(value),
  label,
}));

type TemplateShiftDialogProps = {
  open: boolean;
  positions: { id: string; name: string }[];
  employees: EmployeeOption[];
  initial: EditorRow | null;
  onSave: (row: EditorRow) => void;
  onDelete: (key: string) => void;
  onClose: () => void;
};

type FieldErrors = { start?: string; end?: string; position?: string };

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export default function TemplateShiftDialog({
  open,
  positions,
  employees,
  initial,
  onSave,
  onDelete,
  onClose,
}: TemplateShiftDialogProps) {
  const isEdit = Boolean(initial?.key);
  const [positionId, setPositionId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [employeeProfileId, setEmployeeProfileId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPositionId(initial?.positionId ?? "");
    setDayOfWeek(String(initial?.dayOfWeek ?? 0));
    setEmployeeProfileId(initial?.employeeProfileId ?? "");
    setStartTime(initial?.startTime ?? "");
    setEndTime(initial?.endTime ?? "");
    setNotes(initial?.notes ?? "");
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initial]);

  const eligible = positionId ? qualifiedEmployees(employees, positionId) : employees;

  function handleSave() {
    const next: FieldErrors = {};
    if (!positionId) next.position = "Choose a position";
    if (!parseTime12h(startTime)) next.start = "Enter a time like 7:00 AM";
    if (!parseTime12h(endTime)) next.end = "Enter a time like 3:00 PM";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave({
      key: initial?.key || newKey(),
      positionId,
      dayOfWeek: Number(dayOfWeek),
      employeeProfileId: employeeProfileId || null,
      startTime,
      endTime,
      notes: notes || null,
    });
    onClose();
  }

  function handleRemove() {
    if (initial?.key) onDelete(initial.key);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit template shift" : "Add template shift"}
      footer={
        <>
          {isEdit && (
            <Button variant="ghost" onClick={handleRemove}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Select
          label="Position"
          value={positionId}
          onChange={setPositionId}
          placeholder="Choose a position"
          options={positions.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select label="Day of week" value={dayOfWeek} onChange={setDayOfWeek} options={DOW_OPTIONS} />
        <Select
          label="Employee"
          value={employeeProfileId}
          onChange={setEmployeeProfileId}
          placeholder="Open shift (unassigned)"
          options={eligible.map((e) => ({ value: e.employeeProfileId, label: e.name }))}
        />
        <div className={styles.timeRow}>
          <TimeField label="Start" placeholder="7:00 AM" value={startTime} onChange={setStartTime} error={errors.start} />
          <TimeField label="End" placeholder="3:00 PM" value={endTime} onChange={setEndTime} error={errors.end} />
        </div>
        <Textarea
          label="Notes"
          placeholder="Anything the employee should know"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </Dialog>
  );
}
