import type { SessionState, ToolsEntry } from "@kraude-kode/events";
import { BoxRenderable, type CliRenderer } from "@opentui/core";
import { type ToolCallHooks, ToolCallView } from "./toolCallView.ts";
import type { EntryView } from "./viewTypes.ts";

export class ToolGroupView implements EntryView<ToolsEntry> {
  readonly renderable: BoxRenderable;
  readonly calls = new Map<string, ToolCallView>();

  constructor(
    private renderer: CliRenderer,
    private hooks: ToolCallHooks,
  ) {
    this.renderable = new BoxRenderable(renderer, {
      flexDirection: "column",
      paddingRight: 2,
      marginTop: 1,
      flexShrink: 0,
    });
  }

  update(entry: ToolsEntry, state: SessionState): void {
    for (const call of entry.calls)
      this.viewFor(call.id).update(call, state.now, state.ui.question);
  }

  viewFor(callId: string): ToolCallView {
    const existing = this.calls.get(callId);
    if (existing) return existing;
    const view = new ToolCallView(this.renderer, this.hooks);
    this.calls.set(callId, view);
    this.renderable.add(view.renderable);
    return view;
  }
}
