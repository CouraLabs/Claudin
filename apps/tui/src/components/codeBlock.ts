import { BoxRenderable, type CliRenderer, CodeRenderable, type SyntaxStyle } from "@opentui/core";
import { Theme } from "../theme/colors.ts";

export function createCodeBlock(
  renderer: CliRenderer,
  syntaxStyle: SyntaxStyle,
  code: string,
  language?: string,
): BoxRenderable {
  const box = new BoxRenderable(renderer, {
    border: true,
    borderStyle: "rounded",
    borderColor: Theme.border.subtle,
    backgroundColor: Theme.bg.surface,
    title: language,
    titleColor: Theme.fg.muted,
    paddingLeft: 1,
    flexShrink: 0,
  });
  box.add(new CodeRenderable(renderer, { content: code, filetype: language, syntaxStyle }));
  return box;
}
