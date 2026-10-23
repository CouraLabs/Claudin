import { z } from "zod";

export const textEditSchema = z.object({
  file_path: z.string().describe("Absolute path of the file to modify"),
  old_string: z
    .string()
    .describe("Exact text to replace; empty only to create a new file with new_string"),
  new_string: z.string().describe("Replacement text; must differ from old_string"),
  replace_all: z.boolean().optional().describe("Replace every occurrence of old_string"),
});

export const batchEditShape = {
  edits: z
    .array(textEditSchema)
    .min(1)
    .describe("Edits applied in order; edits to one file see the result of earlier ones"),
};

export type TextEdit = z.infer<typeof textEditSchema>;
