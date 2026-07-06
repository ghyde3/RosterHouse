// src/app/(employee)/availability/reducer.ts — pure state for the editor.
// Display times are 12-hour text ("9:00 AM"); "" for both start and end
// means "available all day" (stored as NULL/NULL).
import { hhmmTo12h, parse12hToHhmm } from "@/lib/time-format";
import type { AvailabilityRuleDto } from "@/lib/queries/employee";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type EditorDay = {
  dayOfWeek: number;
  isAvailable: boolean;
  start: string;
  end: string;
};

export type EditorState = {
  days: EditorDay[];
  saved: EditorDay[]; // last-saved snapshot; dirty = days differ from it
  dirty: boolean;
  errors: Record<number, string>; // dayOfWeek → message
};

export type EditorAction =
  | { type: "toggleDay"; dayOfWeek: number }
  | { type: "setTime"; dayOfWeek: number; field: "start" | "end"; value: string }
  | { type: "applyPreset"; preset: "everyday" | "weekdays" | "weekends" }
  | { type: "markSaved" }
  | { type: "setErrors"; errors: Record<number, string> };

export function initEditor(rules: AvailabilityRuleDto[]): EditorState {
  const byDay = new Map(rules.map((r) => [r.dayOfWeek, r]));
  const days: EditorDay[] = [];
  for (let d = 0; d < 7; d++) {
    const rule = byDay.get(d);
    days.push({
      dayOfWeek: d,
      isAvailable: rule ? rule.isAvailable : true,
      start: rule?.startTime ? hhmmTo12h(rule.startTime) : "",
      end: rule?.endTime ? hhmmTo12h(rule.endTime) : "",
    });
  }
  return { days, saved: days, dirty: false, errors: {} };
}

function sameDays(a: EditorDay[], b: EditorDay[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "toggleDay": {
      const days = state.days.map((d) =>
        d.dayOfWeek === action.dayOfWeek ? { ...d, isAvailable: !d.isAvailable } : d
      );
      return { ...state, days, dirty: !sameDays(days, state.saved), errors: {} };
    }
    case "setTime": {
      const days = state.days.map((d) =>
        d.dayOfWeek === action.dayOfWeek ? { ...d, [action.field]: action.value } : d
      );
      return { ...state, days, dirty: !sameDays(days, state.saved), errors: {} };
    }
    case "applyPreset": {
      const on =
        action.preset === "everyday"
          ? [0, 1, 2, 3, 4, 5, 6]
          : action.preset === "weekdays"
            ? [0, 1, 2, 3, 4]
            : [5, 6];
      const days = state.days.map((d) => ({ ...d, isAvailable: on.includes(d.dayOfWeek) }));
      return { ...state, days, dirty: !sameDays(days, state.saved), errors: {} };
    }
    case "markSaved":
      return { ...state, saved: state.days, dirty: false, errors: {} };
    case "setErrors":
      return { ...state, errors: action.errors };
  }
}

/** Validate + convert display state to storage DTOs. */
export function toDto(
  days: EditorDay[]
): { ok: true; rules: AvailabilityRuleDto[] } | { ok: false; errors: Record<number, string> } {
  const errors: Record<number, string> = {};
  const rules: AvailabilityRuleDto[] = [];
  for (const d of days) {
    const start = d.start.trim();
    const end = d.end.trim();
    if (!d.isAvailable || (start === "" && end === "")) {
      rules.push({ dayOfWeek: d.dayOfWeek, isAvailable: d.isAvailable, startTime: null, endTime: null });
      continue;
    }
    if (start === "" || end === "") {
      errors[d.dayOfWeek] = "Enter both a start and end time, or leave both blank for all day.";
      continue;
    }
    const startTime = parse12hToHhmm(start);
    const endTime = parse12hToHhmm(end);
    if (!startTime || !endTime) {
      errors[d.dayOfWeek] = "Enter times like 9:00 AM.";
      continue;
    }
    if (startTime >= endTime) {
      errors[d.dayOfWeek] = "End time must be after start time.";
      continue;
    }
    rules.push({ dayOfWeek: d.dayOfWeek, isAvailable: true, startTime, endTime });
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, rules };
}
