import { z } from "zod";
import { backgroundColorSchema } from "../models/backgroundColor.ts";
import { themeNameSchema } from "../models/themeNames.ts";

export const optionsRequestSchemas = [
  z.object({ type: z.literal("options.load.requested") }),
  z.object({
    type: z.literal("options.background.save.requested"),
    color: backgroundColorSchema,
  }),
  z.object({ type: z.literal("options.theme.save.requested"), theme: themeNameSchema }),
] as const;

export const optionsResponseSchemas = [
  z.object({
    type: z.literal("options.loaded"),
    background: backgroundColorSchema.optional(),
    theme: themeNameSchema.optional(),
  }),
  z.object({ type: z.literal("options.background.saved"), color: backgroundColorSchema }),
  z.object({ type: z.literal("options.theme.saved"), theme: themeNameSchema }),
] as const;

export const optionsFileSchema = z.looseObject({
  background: backgroundColorSchema.optional(),
  theme: themeNameSchema.optional(),
});

export type OptionsFile = z.infer<typeof optionsFileSchema>;
