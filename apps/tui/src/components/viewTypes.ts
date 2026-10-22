import type { SessionState } from "@claudin/events";
import type { Renderable } from "@opentui/core";

export interface EntryView<Entry> {
  readonly renderable: Renderable;
  update(entry: Entry, state: SessionState): void;
}
