import { type CliRenderer, DiffRenderable, type SyntaxStyle } from "@opentui/core";
import { Theme } from "../theme/colors.ts";

export const createDiffView = (
  renderer: CliRenderer,
  syntaxStyle: SyntaxStyle,
  patch: string,
  filetype?: string,
): DiffRenderable =>
  new DiffRenderable(renderer, {
    diff: patch,
    filetype,
    syntaxStyle,
    view: "unified",
    showLineNumbers: true,
    fg: Theme.fg.primary,
    addedBg: Theme.diff.addedBg,
    removedBg: Theme.diff.removedBg,
    contextBg: Theme.diff.contextBg,
    lineNumberFg: Theme.diff.lineNumber,
    lineNumberBg: Theme.diff.contextBg,
    addedLineNumberBg: Theme.diff.addedLineNumberBg,
    removedLineNumberBg: Theme.diff.removedLineNumberBg,
    addedSignColor: Theme.diff.addedText,
    removedSignColor: Theme.diff.removedText,
    flexShrink: 0,
  });
