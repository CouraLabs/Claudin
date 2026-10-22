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
    addedBg: Theme.diff.addedBg,
    removedBg: Theme.diff.removedBg,
    addedSignColor: Theme.status.success,
    removedSignColor: Theme.status.danger,
    flexShrink: 0,
  });
