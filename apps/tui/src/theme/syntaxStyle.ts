import { type CliRenderer, SyntaxStyle } from "@opentui/core";
import { Theme } from "./colors.ts";

export const createSyntaxStyle = (renderer: CliRenderer): SyntaxStyle =>
  SyntaxStyle.fromStyles(
    {
      default: { fg: Theme.fg.primary },
      "markup.heading": { fg: Theme.accent.brand, bold: true },
      "markup.strong": { fg: Theme.fg.primary, bold: true },
      "markup.italic": { fg: Theme.fg.secondary, italic: true },
      "markup.raw": { fg: Theme.status.warning },
      "markup.link": { fg: Theme.status.info, underline: true },
      "markup.list": { fg: Theme.accent.highlight },
      keyword: { fg: Theme.accent.brand },
      string: { fg: Theme.status.success },
      comment: { fg: Theme.fg.muted, italic: true },
      function: { fg: Theme.accent.highlight },
      type: { fg: Theme.status.warning },
      number: { fg: Theme.status.info },
    },
    renderer.nativeScene,
  );
