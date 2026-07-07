import { z } from "zod";

export const createPositionSchema = z.object({
  name: z.string().trim().min(1, { message: "Name your position" }).max(60, { message: "Keep it under 60 characters" }),
});

export const updatePositionSchema = z
  .object({
    name: z.string().trim().min(1, { message: "Name your position" }).max(60, { message: "Keep it under 60 characters" }).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.archived !== undefined, {
    message: "Nothing to update",
  });

export const reorderPositionsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1, { message: "orderedIds must not be empty" }),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
export type ReorderPositionsInput = z.infer<typeof reorderPositionsSchema>;
