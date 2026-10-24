import type { TranscriptEntry } from "@kraude-kode/events";
import { type CliRenderer, fg, StyledText, TextRenderable } from "@opentui/core";
import { Theme } from "../theme/colors.ts";
import type { EntryView } from "./viewTypes.ts";

type NoticeEntry = Extract<TranscriptEntry, { kind: "notice" }>;

export class NoticeView implements EntryView<NoticeEntry> {
  readonly renderable: TextRenderable;
  text?: string;

  constructor(renderer: CliRenderer) {
    this.renderable = new TextRenderable(renderer, {
      content: "",
      marginTop: 1,
      flexShrink: 0,
    });
  }

  update(entry: NoticeEntry): void {
    if (entry.text === this.text) return;
    this.text = entry.text;
    this.renderable.content = new StyledText([fg(Theme.fg.muted)(`• ${entry.text}`)]);
  }
}
