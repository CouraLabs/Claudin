import type { SessionState } from "@kraude-kode/events";
import type { Renderable } from "@opentui/core";

export interface EntryView<Entry> {
  readonly renderable: Renderable;
  update(entry: Entry, state: SessionState): void;
}
