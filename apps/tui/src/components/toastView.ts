import type { SessionState } from "@kraude-kode/events";
import { BoxRenderable, type CliRenderer, fg, StyledText, TextRenderable } from "@opentui/core";
import { Theme } from "../theme/colors.ts";

const TOAST_ICON = "●";

export class ToastView {
  readonly renderable: BoxRenderable;
  readonly text: TextRenderable;
  toastId?: string;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      position: "absolute",
      top: 1,
      right: 2,
      zIndex: 100,
      paddingLeft: 1,
      paddingRight: 1,
      border: true,
      borderStyle: "rounded",
      visible: false,
    });
    this.text = new TextRenderable(renderer, { content: "", wrapMode: "none", selectable: false });
    this.renderable.add(this.text);
  }

  update({ ui }: SessionState): void {
    const { toast } = ui;
    this.renderable.visible = toast !== null;
    if (!toast || toast.id === this.toastId) return;
    this.toastId = toast.id;
    this.renderable.borderColor = Theme.border.focus;
    this.renderable.backgroundColor = Theme.bg.surface;
    this.text.content = new StyledText([
      fg(Theme.status.success)(`${TOAST_ICON} `),
      fg(Theme.fg.primary)(toast.text),
    ]);
  }
}
