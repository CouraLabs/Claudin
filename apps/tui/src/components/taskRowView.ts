import {
  BoxRenderable,
  bold,
  type CliRenderer,
  dim,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import { SPINNER_FRAMES } from "../format/glyphs.ts";
import type { TaskRow } from "../format/taskRows.ts";
import { Theme } from "../theme/colors.ts";

const SPINNER_STEP_MS = 100;

export class TaskRowView {
  readonly renderable: BoxRenderable;
  readonly title: TextRenderable;
  readonly stop: TextRenderable;
  readonly detail: TextRenderable;
  private taskId = "";

  constructor(renderer: CliRenderer, onStop: (taskId: string) => void) {
    this.renderable = new BoxRenderable(renderer, { flexShrink: 0, visible: false });
    const line = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "space-between",
    });
    this.title = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.stop = new TextRenderable(renderer, {
      content: "",
      wrapMode: "none",
      flexShrink: 0,
      selectable: false,
      onMouseDown: () => onStop(this.taskId),
    });
    this.detail = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    line.add(this.title);
    line.add(this.stop);
    this.renderable.add(line);
    this.renderable.add(this.detail);
  }

  update(row: TaskRow | undefined, now: number): void {
    this.renderable.visible = row !== undefined;
    if (!row) return;
    this.taskId = row.taskId;
    const frame = SPINNER_FRAMES[Math.floor(now / SPINNER_STEP_MS) % SPINNER_FRAMES.length];
    this.title.content = new StyledText([
      fg(Theme.status.success)(`${frame} `),
      bold(fg(Theme.fg.primary)(row.kind)),
      fg(Theme.fg.secondary)(` ${row.title}`),
    ]);
    this.stop.content = new StyledText([
      fg(Theme.fg.muted)(`${row.stats} `),
      bold(fg(Theme.fg.secondary)("[stop]")),
    ]);
    this.detail.content = new StyledText([dim(fg(Theme.fg.muted)(`  └ ${row.detail}`))]);
  }
}
