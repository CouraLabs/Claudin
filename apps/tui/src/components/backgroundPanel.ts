import type { SessionState } from "@claudin/events";
import { BoxRenderable, type CliRenderer, StyledText, TextRenderable } from "@opentui/core";
import { buildBackgroundChunks } from "../format/backgroundChunks.ts";

export class BackgroundPanel {
  readonly renderable: BoxRenderable;
  readonly body: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      flexShrink: 0,
      paddingLeft: 2,
      paddingRight: 2,
      visible: false,
    });
    this.body = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.renderable.add(this.body);
  }

  update({ ui }: SessionState): void {
    const editor = ui.backgroundEditor;
    this.renderable.visible = editor !== null;
    if (editor) this.body.content = new StyledText(buildBackgroundChunks(editor));
  }
}
