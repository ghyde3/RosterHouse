import { z } from "zod";
import { parseTime12h } from "@/lib/time";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use a date like 2026-07-06" });

export const time12hSchema = z
  .string()
  .refine((value) => parseTime12h(value) !== null, { message: "Enter a time like 7:00 AM" });

export const createShiftSchema = z.object({
  locationId: z.string().min(1),
  positionId: z.string().min(1),
  employeeProfileId: z.string().min(1).nullable(),
  date: isoDateSchema,
  startTime: time12hSchema,
  endTime: time12hSchema,
  notes: z.string().max(500).optional(),
});

export const updateShiftSchema = z.object({
  positionId: z.string().min(1).optional(),
  employeeProfileId: z.string().min(1).nullable().optional(),
  date: isoDateSchema.optional(),
  startTime: time12hSchema.optional(),
  endTime: time12hSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const validateShiftSchema = createShiftSchema.extend({
  shiftId: z.string().min(1).optional(),
});
