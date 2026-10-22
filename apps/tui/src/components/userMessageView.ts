import type { TranscriptEntry } from "@claudin/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import { formatClock } from "../format/formatMetrics.ts";
import { clipLines } from "../format/truncateText.ts";
import { Theme } from "../theme/colors.ts";
import type { EntryView } from "./viewTypes.ts";

const USER_LINES = 10;

type UserEntry = Extract<TranscriptEntry, { kind: "user" }>;

export class UserMessageView implements EntryView<UserEntry> {
  readonly renderable: BoxRenderable;
  readonly text: TextRenderable;
  readonly clock: TextRenderable;
  entry?: UserEntry;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: Theme.bg.surface,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      marginTop: 1,
      flexShrink: 0,
    });
    this.text = new TextRenderable(renderer, { content: "", flexGrow: 1, flexShrink: 1 });
    this.clock = new TextRenderable(renderer, { content: "", flexShrink: 0, marginLeft: 2 });
    this.renderable.add(this.text);
    this.renderable.add(this.clock);
  }

  update(entry: UserEntry): void {
    if (entry === this.entry) return;
    this.entry = entry;
    this.text.content = new StyledText([
      bold(fg(Theme.accent.brand)("❯ ")),
      bold(fg(Theme.fg.primary)(clipLines(entry.text, USER_LINES))),
    ]);
    this.clock.content = new StyledText([fg(Theme.fg.muted)(formatClock(entry.at))]);
  }
}
