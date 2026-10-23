import type { SessionState } from "@claudin/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  dim,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import {
  buildQueueHeader,
  buildQueueRows,
  countHiddenQueued,
  MAX_QUEUE_ROWS,
} from "../format/promptQueueRows.ts";
import { Theme } from "../theme/colors.ts";

export class PromptQueueView {
  readonly renderable: BoxRenderable;
  readonly header: TextRenderable;
  readonly rows: TextRenderable[];
  readonly overflow: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      flexShrink: 0,
      paddingLeft: 2,
      paddingRight: 2,
      visible: false,
    });
    this.header = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.overflow = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.rows = Array.from(
      { length: MAX_QUEUE_ROWS },
      () => new TextRenderable(renderer, { content: "", wrapMode: "none" }),
    );
    this.renderable.add(this.header);
    for (const row of this.rows) this.renderable.add(row);
    this.renderable.add(this.overflow);
  }

  update({ queuedPrompts }: SessionState): void {
    this.renderable.visible = queuedPrompts.length > 0;
    if (queuedPrompts.length === 0) return;
    this.header.content = new StyledText([
      bold(fg(Theme.fg.secondary)(buildQueueHeader(queuedPrompts))),
    ]);
    const lines = buildQueueRows(queuedPrompts);
    this.rows.forEach((row, index) => {
      row.content = new StyledText([fg(Theme.fg.primary)(lines[index] ?? "")]);
    });
    const hidden = countHiddenQueued(queuedPrompts);
    this.overflow.content = hidden
      ? new StyledText([dim(fg(Theme.fg.muted)(`  +${hidden} more`))])
      : "";
  }
}
