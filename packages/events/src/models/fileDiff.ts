import { z } from "zod";

export const fileDiffSchema = z.object({
  path: z.string(),
  patch: z.string(),
  additions: z.number(),
  deletions: z.number(),
});

export type FileDiff = z.infer<typeof fileDiffSchema>;

export const countPatchLines = (patch: string, sign: "+" | "-"): number =>
  patch.split("\n").filter((line) => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))
    .length;
