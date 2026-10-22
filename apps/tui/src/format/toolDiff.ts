import type { ToolCall } from "@claudin/events";
import { createPatch } from "diff";

export type ToolDiff = { patch: string; additions: number; deletions: number; filetype?: string };

const FILETYPES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  md: "markdown",
};

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

const countLines = (patch: string, sign: "+" | "-"): number =>
  patch.split("\n").filter((line) => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))
    .length;

export function buildToolDiff(call: ToolCall): ToolDiff | undefined {
  const texts = readTexts(call);
  const path = call.input.file_path;
  if (!texts || typeof path !== "string") return undefined;
  const patch = createPatch(path, texts.before, texts.after, "", "", { context: 2 });
  const extension = path.split(".").pop() ?? "";
  return {
    patch,
    additions: countLines(patch, "+"),
    deletions: countLines(patch, "-"),
    filetype: FILETYPES[extension],
  };
}
