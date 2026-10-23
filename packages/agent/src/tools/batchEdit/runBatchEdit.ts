import type { TextEdit } from "./batchEditSchema.ts";
import { type FileReader, type StagedFiles, stageEdits } from "./stageEdits.ts";

export type BatchEditReport = { isError: boolean; text: string };

export const readFileText: FileReader = async (path) => {
  const file = Bun.file(path);
  return (await file.exists()) ? file.text() : undefined;
};

const describeFiles = (files: StagedFiles): string =>
  [...files]
    .map(([path, { replacements }]) => `- ${path}: ${replacements} replacement(s)`)
    .join("\n");

export async function runBatchEdit(
  edits: TextEdit[],
  readFile: FileReader = readFileText,
): Promise<BatchEditReport> {
  const staged = await stageEdits(edits, readFile);
  if (!staged.ok) {
    return { isError: true, text: `${staged.message}\nNo files were changed.` };
  }
  try {
    await Promise.all([...staged.files].map(([path, { content }]) => Bun.write(path, content)));
  } catch (error) {
    return { isError: true, text: `Writing failed, files may be partly changed: ${error}` };
  }
  return {
    isError: false,
    text: `Applied ${edits.length} edit(s) to ${staged.files.size} file(s):\n${describeFiles(staged.files)}`,
  };
}
