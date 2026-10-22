import type { DiffViewer, SessionState } from "@claudin/events";
import {
  BoxRenderable,
  type CliRenderer,
  type DiffRenderable,
  ScrollBoxRenderable,
  StyledText,
  type SyntaxStyle,
  TextRenderable,
} from "@opentui/core";
import { detectFiletype } from "../format/detectFiletype.ts";
import { buildDiffViewerChunks } from "../format/diffViewerChunks.ts";
import { createDiffView } from "./createDiffView.ts";

export class DiffViewerPanel {
  readonly renderable: BoxRenderable;
  readonly header: TextRenderable;
  readonly scroll: ScrollBoxRenderable;
  diff?: DiffRenderable;
  shown: DiffViewer | null = null;

  constructor(
    private renderer: CliRenderer,
    private syntaxStyle: SyntaxStyle,
  ) {
    this.renderable = new BoxRenderable(renderer, {
      flexGrow: 1,
      flexDirection: "column",
      paddingX: 1,
      visible: false,
    });
    this.header = new TextRenderable(renderer, { content: "", wrapMode: "none", flexShrink: 0 });
    this.scroll = new ScrollBoxRenderable(renderer, { flexGrow: 1, marginTop: 1 });
    this.renderable.add(this.header);
    this.renderable.add(this.scroll);
  }

  update({ ui }: SessionState): void {
    const viewer = ui.diffViewer;
    this.renderable.visible = viewer !== null;
    if (viewer === this.shown) return;
    this.shown = viewer;
    if (viewer) this.showFile(viewer);
  }

  showFile(viewer: DiffViewer): void {
    const file = viewer.files[viewer.selected];
    if (!file) return;
    this.header.content = new StyledText(buildDiffViewerChunks(viewer));
    this.diff?.destroy();
    this.diff = createDiffView(
      this.renderer,
      this.syntaxStyle,
      file.patch,
      detectFiletype(file.path),
    );
    this.scroll.add(this.diff);
    this.scroll.scrollTo(0);
  }

  reset(syntaxStyle: SyntaxStyle): void {
    this.syntaxStyle = syntaxStyle;
    const viewer = this.shown;
    if (viewer) this.showFile(viewer);
  }

  scrollByLines(delta: number): void {
    this.scroll.scrollBy(delta);
  }

  scrollByPage(direction: 1 | -1): void {
    this.scroll.scrollBy(direction * Math.max(this.scroll.viewport.height - 1, 1));
  }
}
