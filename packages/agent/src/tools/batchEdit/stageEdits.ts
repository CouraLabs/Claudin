import { isAbsolute, resolve } from "node:path";
import { applyTextEdit } from "./applyTextEdit.ts";
import type { TextEdit } from "./batchEditSchema.ts";

export type FileReader = (path: string) => Promise<string | undefined>;

export type StagedFiles = Map<string, { content: string; replacements: number }>;

export type StageResult = { ok: true; files: StagedFiles } | { ok: false; message: string };

const failStage = (index: number, edit: TextEdit, reason: string): StageResult => ({
  ok: false,
  message: `Edit ${index + 1} (${edit.file_path}): ${reason}`,
});

export async function stageEdits(edits: TextEdit[], readFile: FileReader): Promise<StageResult> {
  const files: StagedFiles = new Map();
  for (const [index, edit] of edits.entries()) {
    if (!isAbsolute(edit.file_path)) return failStage(index, edit, "file_path must be absolute");
    const path = resolve(edit.file_path);
    const current = files.get(path)?.content ?? (await readFile(path));
    if (current === undefined && edit.old_string !== "") {
      return failStage(index, edit, "the file does not exist");
    }
    const outcome = applyTextEdit(current ?? "", edit);
    if (!outcome.ok) return failStage(index, edit, outcome.reason);
    const replacements = (files.get(path)?.replacements ?? 0) + outcome.replacements;
    files.set(path, { content: outcome.content, replacements });
  }
  return { ok: true, files };
}
