import type { UserEntry } from "@kraude-kode/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import { truncateText } from "../format/truncateText.ts";
import { Theme } from "../theme/colors.ts";

const HORIZONTAL_PADDING = 2;

export class PinnedPromptView {
  readonly renderable: BoxRenderable;
  readonly text: TextRenderable;
  shown?: UserEntry;
  shownWidth = 0;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      paddingLeft: HORIZONTAL_PADDING,
      paddingRight: HORIZONTAL_PADDING,
      zIndex: 10,
      visible: false,
    });
    this.text = new TextRenderable(renderer, { content: "", flexGrow: 1 });
    this.renderable.add(this.text);
  }

  show(entry: UserEntry | undefined, width: number): void {
    this.renderable.visible = entry !== undefined;
    if (!entry || (entry === this.shown && width === this.shownWidth)) return;
    this.shown = entry;
    this.shownWidth = width;
    this.renderable.backgroundColor = Theme.bg.surface;
    const label = truncateText(entry.text, width - HORIZONTAL_PADDING * 2);
    this.text.content = new StyledText([bold(fg(Theme.fg.primary)(label))]);
  }
}
