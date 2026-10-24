import type { TranscriptEntry } from "@kraude-kode/events";
import { type CliRenderer, MarkdownRenderable, type SyntaxStyle } from "@opentui/core";
import type { EntryView } from "./viewTypes.ts";

type NoticeEntry = Extract<TranscriptEntry, { kind: "notice" }>;

export class MarkdownNoticeView implements EntryView<NoticeEntry> {
  readonly renderable: MarkdownRenderable;

  constructor(renderer: CliRenderer, mutedSyntaxStyle: SyntaxStyle) {
    this.renderable = new MarkdownRenderable(renderer, {
      content: "",
      syntaxStyle: mutedSyntaxStyle,
      marginTop: 1,
      flexShrink: 0,
    });
  }

  update(entry: NoticeEntry): void {
    if (this.renderable.content !== entry.text) this.renderable.content = entry.text;
  }
}
