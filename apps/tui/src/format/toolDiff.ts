import { countPatchLines, type ToolCall } from "@claudin/events";
import { createPatch } from "diff";
import { detectFiletype } from "./detectFiletype.ts";

export type ToolDiff = { patch: string; additions: number; deletions: number; filetype?: string };

type Edit = { old_string?: string; new_string?: string };

const readText = (value: unknown): string => (typeof value === "string" ? value : "");

function readTexts({ name, input }: ToolCall): { before: string; after: string } | undefined {
  if (name === "Edit")
    return { before: readText(input.old_string), after: readText(input.new_string) };
  if (name === "Write") return { before: "", after: readText(input.content) };
  if (name !== "MultiEdit" || !Array.isArray(input.edits)) return undefined;
  const edits = input.edits as Edit[];
  return {
    before: edits.map((edit) => readText(edit.old_string)).join("\n"),
    after: edits.map((edit) => readText(edit.new_string)).join("\n"),
  };
}

export function buildToolDiff(call: ToolCall): ToolDiff | undefined {
  const texts = readTexts(call);
  const path = call.input.file_path;
  if (!texts || typeof path !== "string") return undefined;
  const patch = createPatch(path, texts.before, texts.after, "", "", { context: 2 });
  return {
    patch,
    additions: countPatchLines(patch, "+"),
    deletions: countPatchLines(patch, "-"),
    filetype: detectFiletype(path),
  };
}
