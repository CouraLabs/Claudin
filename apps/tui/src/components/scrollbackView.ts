import type { SessionState, TranscriptEntry } from "@claudin/events";
import {
  type CliRenderer,
  type Renderable,
  ScrollBoxRenderable,
  type SyntaxStyle,
} from "@opentui/core";
import { Theme } from "../theme/colors.ts";
import { AssistantMessageView } from "./assistantMessageView.ts";
import { NoticeView } from "./noticeView.ts";
import { ThoughtView } from "./thoughtView.ts";
import type { ToolCallHooks } from "./toolCallView.ts";
import { ToolGroupView } from "./toolGroupView.ts";
import { UserMessageView } from "./userMessageView.ts";
import type { EntryView } from "./viewTypes.ts";

type AnyEntryView = EntryView<never> & { renderable: Renderable };

type ScrollbackOptions = { syntaxStyle: SyntaxStyle; hooks: ToolCallHooks };

export class ScrollbackView {
  readonly renderable: ScrollBoxRenderable;
  readonly views = new Map<string, AnyEntryView>();

  constructor(
    private renderer: CliRenderer,
    private options: ScrollbackOptions,
  ) {
    this.renderable = new ScrollBoxRenderable(renderer, {
      flexGrow: 1,
      stickyScroll: true,
      stickyStart: "bottom",
      paddingX: 1,
      border: ["left"],
      borderStyle: "heavy",
    });
    this.setFocused(false);
  }

  setFocused(focused: boolean): void {
    this.renderable.borderColor = focused ? Theme.accent.brand : Theme.bg.default;
  }

  update(state: SessionState): void {
    this.dropRemovedViews(state);
    for (const entry of state.transcript) {
      const view = this.views.get(entry.id) ?? this.addView(entry);
      (view as EntryView<TranscriptEntry>).update(entry, state);
    }
  }

  scrollByLines(delta: number): void {
    this.renderable.scrollBy(delta);
  }

  scrollByPage(direction: 1 | -1): void {
    this.renderable.scrollBy(direction * Math.max(this.renderable.viewport.height - 1, 1));
  }

  revealEntry(entryId: string): void {
    const target = this.views.get(entryId)?.renderable;
    if (!target) return;
    const { viewport } = this.renderable;
    const above = target.y - viewport.y;
    const below = target.y + target.height - (viewport.y + viewport.height);
    if (above < 0) this.renderable.scrollBy(above);
    else if (below > 0) this.renderable.scrollBy(Math.min(below, above));
  }

  reset(syntaxStyle: SyntaxStyle): void {
    this.dropViews(() => true);
    this.options = { syntaxStyle, hooks: { ...this.options.hooks, syntaxStyle } };
  }

  dropRemovedViews(state: SessionState): void {
    const live = new Set(state.transcript.map((entry) => entry.id));
    this.dropViews((id) => !live.has(id));
  }

  dropViews(shouldDrop: (id: string) => boolean): void {
    for (const [id, view] of this.views) {
      if (!shouldDrop(id)) continue;
      this.renderable.remove(view.renderable);
      view.renderable.destroyRecursively();
      this.views.delete(id);
    }
  }

  addView(entry: TranscriptEntry): AnyEntryView {
    const view = this.createView(entry);
    this.views.set(entry.id, view);
    this.renderable.add(view.renderable);
    return view;
  }

  createView(entry: TranscriptEntry): AnyEntryView {
    const { syntaxStyle, hooks } = this.options;
    switch (entry.kind) {
      case "user":
        return new UserMessageView(this.renderer) as AnyEntryView;
      case "assistant":
        return new AssistantMessageView(this.renderer, syntaxStyle) as AnyEntryView;
      case "notice":
        return new NoticeView(this.renderer) as AnyEntryView;
      case "thought":
        return new ThoughtView(this.renderer) as AnyEntryView;
      case "tools":
        return new ToolGroupView(this.renderer, hooks) as AnyEntryView;
    }
  }
}
