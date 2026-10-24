import type { TranscriptEntry } from "@kraude-kode/events";
import { type CliRenderer, fg, StyledText, TextRenderable } from "@opentui/core";
import { formatDuration } from "../format/formatMetrics.ts";
import { TOOL_GLYPH } from "../format/glyphs.ts";
import { Theme } from "../theme/colors.ts";
import type { EntryView } from "./viewTypes.ts";

type ThoughtEntry = Extract<TranscriptEntry, { kind: "thought" }>;

export class ThoughtView implements EntryView<ThoughtEntry> {
  readonly renderable: TextRenderable;
  entry?: ThoughtEntry;

  constructor(renderer: CliRenderer) {
    this.renderable = new TextRenderable(renderer, {
      content: "",
      marginTop: 1,
      flexShrink: 0,
    });
  }

  update(entry: ThoughtEntry): void {
    if (entry === this.entry) return;
    this.entry = entry;
    this.renderable.content = new StyledText([
      fg(Theme.accent.highlight)(`${TOOL_GLYPH} `),
      fg(Theme.fg.muted)(`Thought for ${formatDuration(entry.durationMs)}`),
    ]);
  }
}
