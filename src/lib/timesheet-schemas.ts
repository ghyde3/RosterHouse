import { z } from "zod";

// ISO-8601 datetimes, offset permitted ("...Z" or "+00:00"). new Date(...) parses both.
const isoDateTime = z.iso.datetime({ offset: true });

export const createEntrySchema = z
  .object({
    employeeProfileId: z.string().min(1),
    clockInAt: isoDateTime,
    clockOutAt: isoDateTime.nullable().optional(),
    shiftId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (v) =>
      v.clockOutAt == null ||
      new Date(v.clockOutAt).getTime() > new Date(v.clockInAt).getTime(),
    { message: "Clock-out must be after clock-in", path: ["clockOutAt"] },
  );

export const updateEntrySchema = z.object({
  clockInAt: isoDateTime.optional(),
  clockOutAt: isoDateTime.nullable().optional(),
});
