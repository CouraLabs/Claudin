import type { TranscriptEntry } from "@kraude-kode/events";
import {
  BoxRenderable,
  type CliRenderer,
  fg,
  MarkdownRenderable,
  StyledText,
  type SyntaxStyle,
  TextRenderable,
} from "@opentui/core";
import { formatClock } from "../format/formatMetrics.ts";
import { Theme } from "../theme/colors.ts";
import { createCodeBlock } from "./codeBlock.ts";
import type { EntryView } from "./viewTypes.ts";

type AssistantEntry = Extract<TranscriptEntry, { kind: "assistant" }>;

export class AssistantMessageView implements EntryView<AssistantEntry> {
  readonly renderable: BoxRenderable;
  readonly markdown: MarkdownRenderable;
  readonly clock: TextRenderable;
  at?: number;

  constructor(renderer: CliRenderer, syntaxStyle: SyntaxStyle) {
    this.renderable = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingRight: 2,
      marginTop: 1,
      flexShrink: 0,
    });
    this.markdown = new MarkdownRenderable(renderer, {
      content: "",
      syntaxStyle,
      flexGrow: 1,
      flexShrink: 1,
      renderNode: (token, context) =>
        token.type === "code"
          ? createCodeBlock(renderer, syntaxStyle, token.text, token.lang)
          : context.defaultRender(),
    });
    this.clock = new TextRenderable(renderer, { content: "", flexShrink: 0, marginLeft: 2 });
    this.renderable.add(this.markdown);
    this.renderable.add(this.clock);
  }

  update(entry: AssistantEntry): void {
    if (this.markdown.content !== entry.text) this.markdown.content = entry.text;
    this.markdown.streaming = entry.streaming;
    if (entry.at === this.at) return;
    this.at = entry.at;
    this.clock.content = new StyledText([fg(Theme.fg.muted)(formatClock(entry.at))]);
  }
}
