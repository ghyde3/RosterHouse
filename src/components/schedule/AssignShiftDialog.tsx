"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TimeField } from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toaster";
import type { Conflict } from "@/lib/conflicts";
import type { EmployeeOption } from "@/lib/schedule-data";
import { dayOfWeekMon0, formatDayLabel, parseTime12h, type ISODate } from "@/lib/time";
import styles from "./AssignShiftDialog.module.css";

export type AssignShiftDialogInitial = {
  shiftId?: string;
  positionId: string | null;
  date: ISODate | null;
  employeeProfileId: string | null;
  startTime: string;
  endTime: string;
  notes: string;
};

type AssignShiftDialogProps = {
  open: boolean;
  locationId: string;
  positions: { id: string; name: string }[];
  weekDates: ISODate[];
  employees: EmployeeOption[];
  initial: AssignShiftDialogInitial | null;
  onClose: () => void;
};

export function qualifiedEmployees(
  employees: EmployeeOption[],
  positionId: string,
): EmployeeOption[] {
  return employees.filter((e) => e.positionIds.includes(positionId));
}

export function employeeOptionLabel(employee: EmployeeOption, date: ISODate | null): string {
  if (!date) return employee.name;
  const window = employee.availabilityByDay[dayOfWeekMon0(date)];
  if (window === "Off") return `${employee.name} · off`;
  if (window === "All day") return `${employee.name} · available all day`;
  return `${employee.name} · ${window}`;
}

type FieldErrors = { start?: string; end?: string; position?: string; date?: string };

export default function AssignShiftDialog({
  open,
  locationId,
  positions,
  weekDates,
  employees,
  initial,
  onClose,
}: AssignShiftDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(initial?.shiftId);

  const [positionId, setPositionId] = useState("");
  const [date, setDate] = useState("");
  const [employeeProfileId, setEmployeeProfileId] = useState(""); // "" = open shift
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // Re-seed local state each time the dialog opens with a (possibly new)
  // `initial` record. This synchronizes editable form state to an external
  // "open this record" event (a new shiftId/cell/header click) rather than
  // reacting to our own state, so it has no setState-free equivalent.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPositionId(initial?.positionId ?? "");
    setDate(initial?.date ?? "");
    setEmployeeProfileId(initial?.employeeProfileId ?? "");
    setStartTime(initial?.startTime ?? "");
    setEndTime(initial?.endTime ?? "");
    setNotes(initial?.notes ?? "");
    setErrors({});
    setConflicts([]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initial]);

  // Live conflict check: debounce 350 ms, only when the form is complete and
  // valid. Advisory only — the server re-checks on save.
  useEffect(() => {
    if (!open) return;
    if (
      !employeeProfileId ||
      !positionId ||
      !date ||
      !parseTime12h(startTime) ||
      !parseTime12h(endTime)
    ) {
      // Clearing stale conflict warnings in sync with the fields that
      // produced them (an external "form is now incomplete" condition).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConflicts([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/shifts/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shiftId: initial?.shiftId,
            locationId,
            positionId,
            employeeProfileId,
            date,
            startTime,
            endTime,
          }),
        });
        const body = await res.json();
        if (body.ok) setConflicts(body.data.conflicts);
      } catch {
        // Network hiccup: skip the live warning; save still re-validates.
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [open, locationId, positionId, employeeProfileId, date, startTime, endTime, initial?.shiftId]);

  const eligible = positionId ? qualifiedEmployees(employees, positionId) : employees;

  async function handleSave() {
    const nextErrors: FieldErrors = {};
    if (!positionId) nextErrors.position = "Choose a position";
    if (!date) nextErrors.date = "Choose a day";
    if (!parseTime12h(startTime)) nextErrors.start = "Enter a time like 7:00 AM";
    if (!parseTime12h(endTime)) nextErrors.end = "Enter a time like 3:00 PM";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onClose(); // optimistic close; a toast reports the outcome
    try {
      const res = await fetch(isEdit ? `/api/shifts/${initial!.shiftId}` : "/api/shifts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? {} : { locationId }),
          positionId,
          employeeProfileId: employeeProfileId || null,
          date,
          startTime,
          endTime,
          notes: notes || (isEdit ? null : undefined),
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: isEdit ? "Shift updated" : "Shift added" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't save shift",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  async function handleRemove() {
    if (!initial?.shiftId) return;
    onClose();
    try {
      const res = await fetch(`/api/shifts/${initial.shiftId}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Shift removed" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: "Couldn't remove shift",
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit shift" : "Assign shift"}
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
        <Select
          label="Day"
          value={date}
          onChange={setDate}
          placeholder="Choose a day"
          options={weekDates.map((d) => ({ value: d, label: formatDayLabel(d) }))}
        />
        <Select
          label="Employee"
          value={employeeProfileId}
          onChange={setEmployeeProfileId}
          placeholder="Open shift (unassigned)"
          options={eligible.map((e) => ({
            value: e.employeeProfileId,
            label: employeeOptionLabel(e, date || null),
          }))}
        />
        <div className={styles.timeRow}>
          <TimeField
            label="Start"
            placeholder="7:00 AM"
            value={startTime}
            onChange={setStartTime}
            error={errors.start}
          />
          <TimeField
            label="End"
            placeholder="3:00 PM"
            value={endTime}
            onChange={setEndTime}
            error={errors.end}
          />
        </div>
        <Textarea
          label="Notes"
          placeholder="Anything the employee should know, like &quot;Bring your own knife kit.&quot;"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        {conflicts.length > 0 && (
          <div className={styles.conflicts}>
            {conflicts.map((c) => (
              <ConflictChip key={c.message}>{c.message}</ConflictChip>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
