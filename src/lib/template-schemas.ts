import { z } from "zod";
import { isoDateSchema, time12hSchema } from "@/lib/shift-schemas";

export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const templateRowInputSchema = z.object({
  positionId: z.string().min(1),
  employeeProfileId: z.string().min(1).nullable(),
  dayOfWeek: dayOfWeekSchema,
  startTime: time12hSchema,
  endTime: time12hSchema,
  notes: z.string().max(500).nullable().optional(),
});

export type TemplateRowInput = z.infer<typeof templateRowInputSchema>;

const nameSchema = z.string().min(1, { message: "Name your template" }).max(80);

// Create either by snapshotting a week (fromWeek) or from explicit rows
// (the editor, including a blank template with rows: []). Exactly one source.
export const createTemplateSchema = z
  .object({
    name: nameSchema,
    fromWeek: isoDateSchema.optional(),
    rows: z.array(templateRowInputSchema).optional(),
  })
  .refine((v) => (v.fromWeek === undefined) !== (v.rows === undefined), {
    message: "Provide either a week to snapshot or a set of rows",
  });

export const updateTemplateSchema = z.object({
  name: nameSchema.optional(),
  rows: z.array(templateRowInputSchema).optional(),
});

export const previewTemplateSchema = z.object({
  targetWeek: isoDateSchema,
});

export const applyTemplateSchema = z.object({
  targetWeek: isoDateSchema,
  mode: z.enum(["replace", "add"]),
  // rowId -> employeeProfileId (or null for an open slot)
  assignments: z.record(z.string(), z.string().min(1).nullable()),
});
