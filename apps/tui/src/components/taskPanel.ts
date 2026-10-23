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
  buildTaskHeader,
  buildTaskRows,
  countHiddenTasks,
  MAX_TASK_ROWS,
} from "../format/taskRows.ts";
import { Theme } from "../theme/colors.ts";
import { TaskRowView } from "./taskRowView.ts";

export class TaskPanel {
  readonly renderable: BoxRenderable;
  readonly header: TextRenderable;
  readonly rows: TaskRowView[];
  readonly overflow: TextRenderable;

  constructor(renderer: CliRenderer, onStop: (taskId: string) => void) {
    this.renderable = new BoxRenderable(renderer, {
      flexShrink: 0,
      paddingLeft: 2,
      paddingRight: 2,
      border: ["top"],
      borderColor: Theme.border.subtle,
      visible: false,
    });
    this.header = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.overflow = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.rows = Array.from({ length: MAX_TASK_ROWS }, () => new TaskRowView(renderer, onStop));
    this.renderable.add(this.header);
    for (const row of this.rows) this.renderable.add(row.renderable);
    this.renderable.add(this.overflow);
  }

  update({ tasks, now }: SessionState): void {
    this.renderable.visible = tasks.length > 0;
    if (tasks.length === 0) return;
    const rows = buildTaskRows(tasks, now);
    this.header.content = new StyledText([bold(fg(Theme.fg.primary)(buildTaskHeader(tasks)))]);
    this.rows.forEach((view, index) => view.update(rows[index], now));
    const hidden = countHiddenTasks(tasks);
    this.overflow.content = hidden
      ? new StyledText([dim(fg(Theme.fg.muted)(`  +${hidden} more`))])
      : "";
  }
}
