import { z } from "zod";
import { backgroundColorSchema } from "../models/backgroundColor.ts";

export const optionsRequestSchemas = [
  z.object({ type: z.literal("options.load.requested") }),
  z.object({
    type: z.literal("options.background.save.requested"),
    color: backgroundColorSchema,
  }),
] as const;

export const optionsResponseSchemas = [
  z.object({ type: z.literal("options.loaded"), background: backgroundColorSchema.optional() }),
  z.object({ type: z.literal("options.background.saved"), color: backgroundColorSchema }),
] as const;

export const optionsFileSchema = z.looseObject({ background: backgroundColorSchema.optional() });

export type OptionsFile = z.infer<typeof optionsFileSchema>;
