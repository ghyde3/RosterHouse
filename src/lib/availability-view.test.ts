import { describe, expect, it } from "vitest";
import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";
import {
  filterAndGroup,
  groupByPrimary,
  inScopeDays,
  matchesStatus,
  type PositionRef,
} from "./availability-view";

const POSITIONS: PositionRef[] = [
  { id: "cook", name: "Line cook" },
  { id: "server", name: "Server" },
];

function day(over: Partial<OverviewDay> & { dayOfWeek: number }): OverviewDay {
  return {
    date: `2026-07-${String(6 + over.dayOfWeek).padStart(2, "0")}`,
    isAvailable: true,
    startTime: null,
    endTime: null,
    timeOff: false,
    exception: false,
    ...over,
  };
}

function emp(
  over: Partial<OverviewEmployee> & { profileId: string; name: string }
): OverviewEmployee {
  return {
    primaryPositionId: null,
    primaryPositionName: null,
    days: Array.from({ length: 7 }, (_, dayOfWeek) => day({ dayOfWeek })),
    ...over,
  };
}

describe("inScopeDays", () => {
  it("returns all 7 days when dayFilter is -1", () => {
    const e = emp({ profileId: "1", name: "A" });
    expect(inScopeDays(e, -1)).toHaveLength(7);
  });
  it("returns only the matching day when dayFilter is 0..6", () => {
    const e = emp({ profileId: "1", name: "A" });
    const scoped = inScopeDays(e, 2);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].dayOfWeek).toBe(2);
  });
});

describe("matchesStatus", () => {
  const cook = emp({
    profileId: "c",
    name: "Cook",
    days: [
      day({ dayOfWeek: 0, isAvailable: true }), // available Mon
      day({ dayOfWeek: 1, isAvailable: false }), // unavailable Tue
      day({ dayOfWeek: 2, timeOff: true }), // time off Wed
      ...Array.from({ length: 4 }, (_, i) => day({ dayOfWeek: 3 + i })),
    ],
  });

  it("all → always matches", () => {
    expect(matchesStatus(cook, "all", -1)).toBe(true);
  });
  it("available → true when any in-scope day is available and not time off", () => {
    expect(matchesStatus(cook, "available", -1)).toBe(true);
    // Scope to Wed (time off) → no available day in scope.
    expect(matchesStatus(cook, "available", 2)).toBe(false);
  });
  it("unavailable → true only when an in-scope day is isAvailable false", () => {
    expect(matchesStatus(cook, "unavailable", -1)).toBe(true);
    expect(matchesStatus(cook, "unavailable", 1)).toBe(true); // Tue
    expect(matchesStatus(cook, "unavailable", 0)).toBe(false); // Mon available
  });
  it("timeoff → true only when an in-scope day has timeOff", () => {
    expect(matchesStatus(cook, "timeoff", -1)).toBe(true);
    expect(matchesStatus(cook, "timeoff", 2)).toBe(true); // Wed
    expect(matchesStatus(cook, "timeoff", 0)).toBe(false); // Mon
  });
  it("time off day does not count as unavailable", () => {
    const timeOffOnly = emp({
      profileId: "t",
      name: "T",
      days: [day({ dayOfWeek: 0, isAvailable: true, timeOff: true })],
    });
    expect(matchesStatus(timeOffOnly, "unavailable", 0)).toBe(false);
  });
});

describe("groupByPrimary", () => {
  it("groups by primary position in sortOrder, unassigned last, empty groups dropped", () => {
    const a = emp({ profileId: "a", name: "Ana", primaryPositionId: "server", primaryPositionName: "Server" });
    const b = emp({ profileId: "b", name: "Ben", primaryPositionId: "cook", primaryPositionName: "Line cook" });
    const c = emp({ profileId: "c", name: "Cal", primaryPositionId: null, primaryPositionName: null });
    const groups = groupByPrimary([a, b, c], POSITIONS);
    expect(groups.map((g) => g.label)).toEqual(["Line cook", "Server", "Unassigned"]);
    expect(groups.map((g) => g.key)).toEqual(["cook", "server", "__unassigned__"]);
    expect(groups[0].employees.map((e) => e.name)).toEqual(["Ben"]);
    expect(groups[2].employees.map((e) => e.name)).toEqual(["Cal"]);
  });
  it("puts an employee whose primary position is not in the active list into Unassigned", () => {
    const archived = emp({
      profileId: "x",
      name: "Xander",
      primaryPositionId: "archived-role",
      primaryPositionName: "Barback",
    });
    const groups = groupByPrimary([archived], POSITIONS);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("__unassigned__");
  });
});

describe("filterAndGroup", () => {
  it("applies status + day filter, then groups, dropping now-empty groups", () => {
    const cook = emp({
      profileId: "cook1",
      name: "Cook One",
      primaryPositionId: "cook",
      primaryPositionName: "Line cook",
      days: [day({ dayOfWeek: 0, isAvailable: false })].concat(
        Array.from({ length: 6 }, (_, i) => day({ dayOfWeek: 1 + i }))
      ),
    });
    const server = emp({
      profileId: "srv1",
      name: "Server One",
      primaryPositionId: "server",
      primaryPositionName: "Server",
    });
    // Status = unavailable, all days → only the cook qualifies; server group dropped.
    const groups = filterAndGroup([cook, server], POSITIONS, "unavailable", -1);
    expect(groups.map((g) => g.label)).toEqual(["Line cook"]);
    expect(groups[0].employees.map((e) => e.name)).toEqual(["Cook One"]);
  });
});
