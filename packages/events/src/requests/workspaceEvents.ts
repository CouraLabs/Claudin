import { z } from "zod";
import { fileDiffSchema } from "../models/fileDiff.ts";

export const gitStatsSchema = z.object({ additions: z.number(), deletions: z.number() });

export type GitStats = z.infer<typeof gitStatsSchema>;

export const workspaceRequestSchemas = [
  z.object({ type: z.literal("workspace.info.requested") }),
  z.object({ type: z.literal("workspace.files.requested"), query: z.string() }),
  z.object({ type: z.literal("workspace.cwd.set.requested"), path: z.string() }),
  z.object({ type: z.literal("workspace.diff.requested"), paths: z.array(z.string()) }),
] as const;

export const workspaceResponseSchemas = [
  z.object({
    type: z.literal("workspace.info.received"),
    cwd: z.string(),
    gitBranch: z.string(),
    gitStats: gitStatsSchema,
  }),
  z.object({
    type: z.literal("workspace.cwd.changed"),
    cwd: z.string(),
    gitBranch: z.string(),
    gitStats: gitStatsSchema,
  }),
  z.object({
    type: z.literal("workspace.files.received"),
    query: z.string(),
    matches: z.array(z.string()),
  }),
  z.object({ type: z.literal("workspace.diff.received"), files: z.array(fileDiffSchema) }),
] as const;
