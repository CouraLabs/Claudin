import type { TextEdit } from "./batchEditSchema.ts";

export type EditOutcome =
  | { ok: true; content: string; replacements: number }
  | { ok: false; reason: string };

const failEdit = (reason: string): EditOutcome => ({ ok: false, reason });

export function applyTextEdit(content: string, edit: TextEdit): EditOutcome {
  const { old_string: oldText, new_string: newText, replace_all: replaceAll } = edit;
  if (oldText === newText) return failEdit("old_string and new_string are identical");
  if (oldText === "") {
    return content === ""
      ? { ok: true, content: newText, replacements: 1 }
      : failEdit("old_string is empty but the file already has content");
  }
  const parts = content.split(oldText);
  const matches = parts.length - 1;
  if (matches === 0) return failEdit("old_string was not found in the file");
  if (matches > 1 && !replaceAll) {
    return failEdit(`old_string matches ${matches} times; add context or set replace_all`);
  }
  return { ok: true, content: parts.join(newText), replacements: matches };
}
