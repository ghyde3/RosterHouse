// src/lib/availability-view.ts — pure, DB-free grouping + filtering for the
// manager availability overview. Unit-tested; the client view is a thin
// renderer over these functions.
import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";

export type StatusFilter = "all" | "available" | "unavailable" | "timeoff";

export type PositionRef = { id: string; name: string };

export type AvailabilityGroup = {
  key: string;
  label: string;
  employees: OverviewEmployee[];
};

export const UNASSIGNED_KEY = "__unassigned__";

/** dayFilter: -1 = all 7 days; 0..6 = that single day (Mon0). */
export function inScopeDays(emp: OverviewEmployee, dayFilter: number): OverviewDay[] {
  if (dayFilter < 0) return emp.days;
  return emp.days.filter((d) => d.dayOfWeek === dayFilter);
}

export function matchesStatus(
  emp: OverviewEmployee,
  status: StatusFilter,
  dayFilter: number
): boolean {
  if (status === "all") return true;
  const days = inScopeDays(emp, dayFilter);
  if (status === "available") {
    return days.some((d) => d.isAvailable && !d.timeOff);
  }
  if (status === "unavailable") {
    return days.some((d) => !d.isAvailable);
  }
  // status === "timeoff"
  return days.some((d) => d.timeOff);
}

/**
 * Group employees under primary-position headers in the given position
 * order. Employees with a null primary — or a primary not present in
 * `positions` (e.g. archived) — fall into a single "Unassigned" group
 * rendered last. Groups with no employees are omitted.
 */
export function groupByPrimary(
  employees: OverviewEmployee[],
  positions: PositionRef[]
): AvailabilityGroup[] {
  const known = new Set(positions.map((p) => p.id));
  const byPosition = new Map<string, OverviewEmployee[]>();
  const unassigned: OverviewEmployee[] = [];
  for (const emp of employees) {
    if (emp.primaryPositionId && known.has(emp.primaryPositionId)) {
      const bucket = byPosition.get(emp.primaryPositionId) ?? [];
      bucket.push(emp);
      byPosition.set(emp.primaryPositionId, bucket);
    } else {
      unassigned.push(emp);
    }
  }
  const groups: AvailabilityGroup[] = [];
  for (const p of positions) {
    const bucket = byPosition.get(p.id);
    if (bucket && bucket.length > 0) {
      groups.push({ key: p.id, label: p.name, employees: bucket });
    }
  }
  if (unassigned.length > 0) {
    groups.push({ key: UNASSIGNED_KEY, label: "Unassigned", employees: unassigned });
  }
  return groups;
}

export function filterAndGroup(
  employees: OverviewEmployee[],
  positions: PositionRef[],
  status: StatusFilter,
  dayFilter: number
): AvailabilityGroup[] {
  const filtered = employees.filter((e) => matchesStatus(e, status, dayFilter));
  return groupByPrimary(filtered, positions);
}
