import {
  BoxRenderable,
  bg,
  bold,
  type CliRenderer,
  dim,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import type { ListView } from "../format/listViews.ts";
import { Theme } from "../theme/colors.ts";

const MAX_VISIBLE_ROWS = 8;
const POPOVER_HINT = "↑/↓ select · Enter confirm · Esc close";

function pickWindow(view: ListView) {
  const start = Math.max(view.selected - MAX_VISIBLE_ROWS + 1, 0);
  return view.rows
    .slice(start, start + MAX_VISIBLE_ROWS)
    .map((row, offset) => ({ ...row, selected: start + offset === view.selected }));
}

export class ListPopover {
  readonly renderable: BoxRenderable;
  readonly list: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      flexShrink: 0,
      paddingLeft: 2,
      paddingRight: 2,
      visible: false,
    });
    this.list = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.renderable.add(this.list);
  }

  update(view: ListView | null): void {
    this.renderable.visible = view !== null;
    if (!view) return;
    const shown = pickWindow(view);
    const width = Math.max(...shown.map(({ name }) => name.length)) + 3;
    const title = view.title
      ? [
          bold(fg(Theme.accent.brand)(view.title)),
          dim(fg(Theme.fg.muted)(`  ${POPOVER_HINT}`)),
          fg(Theme.fg.muted)("\n"),
        ]
      : [];
    const rows = shown.flatMap(({ name, description, selected }, index) => {
      const row = selected
        ? [
            bg(Theme.bg.highlight)(bold(fg(Theme.fg.primary)(`❯ ${name.padEnd(width)}`))),
            bg(Theme.bg.highlight)(fg(Theme.fg.secondary)(description)),
          ]
        : [fg(Theme.fg.secondary)(`  ${name.padEnd(width)}`), fg(Theme.fg.muted)(description)];
      return index === 0 ? row : [fg(Theme.fg.muted)("\n"), ...row];
    });
    this.list.content = new StyledText([...title, ...rows]);
  }
}
