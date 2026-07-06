import { describe, expect, it } from "vitest";
import { parseTime12h } from "@/components/ui/time-field-parse";

describe("parseTime12h", () => {
  it.each([
    ["7:00 AM", { hour: 7, minute: 0 }],
    ["7:30 pm", { hour: 19, minute: 30 }],
    ["12:00 AM", { hour: 0, minute: 0 }], // midnight
    ["12:15 PM", { hour: 12, minute: 15 }], // noon
    ["11:45 pm", { hour: 23, minute: 45 }],
    ["7 AM", { hour: 7, minute: 0 }], // minutes optional
    ["7am", { hour: 7, minute: 0 }], // no space
    ["  8:05 am  ", { hour: 8, minute: 5 }], // surrounding whitespace
    ["9:00 a.m.", { hour: 9, minute: 0 }], // dotted meridiem
  ])("parses %j", (input, expected) => {
    expect(parseTime12h(input)).toEqual(expected);
  });

  it.each([
    "",
    "7:00", // no meridiem — ambiguous
    "13:00 PM", // hour out of 1–12
    "0:30 AM",
    "24:00 AM",
    "7:60 AM", // bad minutes
    "7:0 AM", // minutes must be two digits
    "700 AM",
    "seven AM",
    "7:00 XM",
  ])("rejects %j", (input) => {
    expect(parseTime12h(input)).toBeNull();
  });
});
