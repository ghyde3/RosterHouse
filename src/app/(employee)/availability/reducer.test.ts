import { describe, expect, it } from "vitest";
import {
  DAY_NAMES,
  editorReducer,
  initEditor,
  toDto,
  type EditorState,
} from "./reducer";
import type { AvailabilityRuleDto } from "@/lib/queries/employee";

const storedRules: AvailabilityRuleDto[] = [
  { dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 1, isAvailable: false, startTime: null, endTime: null },
  { dayOfWeek: 2, isAvailable: true, startTime: null, endTime: null },
  { dayOfWeek: 3, isAvailable: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 4, isAvailable: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 5, isAvailable: false, startTime: null, endTime: null },
  { dayOfWeek: 6, isAvailable: false, startTime: null, endTime: null },
];

describe("initEditor", () => {
  it("maps stored 24-hour windows to 12-hour display and starts clean", () => {
    const s = initEditor(storedRules);
    expect(s.days).toHaveLength(7);
    expect(s.days[0]).toEqual({ dayOfWeek: 0, isAvailable: true, start: "9:00 AM", end: "5:00 PM" });
    expect(s.days[2]).toEqual({ dayOfWeek: 2, isAvailable: true, start: "", end: "" }); // all day
    expect(s.dirty).toBe(false);
  });

  it("defaults missing days to available all day", () => {
    const s = initEditor([]);
    expect(s.days).toHaveLength(7);
    expect(s.days.every((d) => d.isAvailable && d.start === "" && d.end === "")).toBe(true);
  });
});

describe("editorReducer dirty tracking", () => {
  it("toggling a day sets dirty; toggling it back clears dirty", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    expect(s.days[1].isAvailable).toBe(true);
    expect(s.dirty).toBe(true);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    expect(s.dirty).toBe(false);
  });

  it("editing a time sets dirty", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 0, field: "start", value: "10:00 AM" });
    expect(s.days[0].start).toBe("10:00 AM");
    expect(s.dirty).toBe(true);
  });

  it("markSaved rebaselines: state is clean against the new snapshot", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    s = editorReducer(s, { type: "markSaved" });
    expect(s.dirty).toBe(false);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 1 });
    expect(s.dirty).toBe(true);
  });
});

describe("applyPreset", () => {
  it("weekdays: Mon–Fri on, Sat/Sun off, hour windows untouched", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "applyPreset", preset: "weekdays" });
    expect(s.days.map((d) => d.isAvailable)).toEqual([true, true, true, true, true, false, false]);
    expect(s.days[0].start).toBe("9:00 AM"); // windows preserved
  });

  it("weekends and everyday presets", () => {
    let s = editorReducer(initEditor(storedRules), { type: "applyPreset", preset: "weekends" });
    expect(s.days.map((d) => d.isAvailable)).toEqual([false, false, false, false, false, true, true]);
    s = editorReducer(s, { type: "applyPreset", preset: "everyday" });
    expect(s.days.every((d) => d.isAvailable)).toBe(true);
  });
});

describe("toDto validation", () => {
  it("converts display times back to 24-hour storage", () => {
    const s = initEditor(storedRules);
    const r = toDto(s.days);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rules[0]).toEqual({ dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" });
      expect(r.rules[2]).toEqual({ dayOfWeek: 2, isAvailable: true, startTime: null, endTime: null });
    }
  });

  it("rejects a half-filled window", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 2, field: "start", value: "9:00 AM" });
    const r = toDto(s.days);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[2]).toBe("Enter both a start and end time, or leave both blank for all day.");
    }
  });

  it("rejects unparseable times", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 0, field: "start", value: "soonish" });
    const r = toDto(s.days);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toBe("Enter times like 9:00 AM.");
  });

  it("rejects end before start", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "setTime", dayOfWeek: 0, field: "end", value: "8:00 AM" });
    const r = toDto(s.days);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toBe("End time must be after start time.");
  });

  it("ignores stale window text on unavailable days", () => {
    let s: EditorState = initEditor(storedRules);
    s = editorReducer(s, { type: "toggleDay", dayOfWeek: 0 }); // Mon off; still has 9–5 text
    const r = toDto(s.days);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rules[0]).toEqual({ dayOfWeek: 0, isAvailable: false, startTime: null, endTime: null });
  });
});

describe("DAY_NAMES", () => {
  it("is Monday-first", () => {
    expect(DAY_NAMES).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});
