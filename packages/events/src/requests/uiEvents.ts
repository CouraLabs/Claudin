import type { BackgroundColor } from "../models/backgroundColor.ts";
import type { FileDiff } from "../models/fileDiff.ts";
import type { ThemeName } from "../models/themeNames.ts";

export type FocusTarget = "input" | "scrollback";

export type AutocompleteKind = "slash" | "file";

export type Autocomplete = {
  kind: AutocompleteKind;
  query: string;
  matches: string[];
  selected: number;
};

export type BackgroundEditor = { color: BackgroundColor; channel: number };

export type PickerKind = "model" | "session" | "search" | "theme" | "rewind";

export type Picker = { kind: PickerKind; selected: number };

export type PromptHistory = { index: number; draft: string };

export type DiffViewer = { files: FileDiff[]; selected: number };

export type Toast = { id: string; text: string };

export type UiEvent =
  | { type: "ui.focus.changed"; focus: FocusTarget }
  | { type: "ui.focus.cycled"; direction: 1 | -1 }
  | { type: "ui.tool.toggled"; callId: string }
  | { type: "ui.autocomplete.changed"; autocomplete: Autocomplete | null }
  | { type: "ui.autocomplete.moved"; delta: 1 | -1 }
  | { type: "ui.picker.moved"; delta: 1 | -1 }
  | { type: "ui.picker.closed" }
  | { type: "ui.theme.picker.opened" }
  | { type: "ui.rewind.picker.opened" }
  | { type: "ui.history.moved"; delta: 1 | -1; draft: string }
  | { type: "ui.history.searched"; draft: string }
  | { type: "ui.history.loaded"; entries: string[] }
  | { type: "ui.history.reset" }
  | { type: "ui.diff.viewer.moved"; delta: 1 | -1 }
  | { type: "ui.diff.viewer.closed" }
  | { type: "ui.theme.selected"; theme: ThemeName }
  | { type: "ui.background.editor.opened" }
  | { type: "ui.background.editor.closed" }
  | { type: "ui.background.channel.moved"; delta: 1 | -1 }
  | { type: "ui.background.value.adjusted"; delta: number }
  | { type: "ui.question.moved"; delta: 1 | -1 }
  | { type: "ui.question.cursor.set"; cursor: number }
  | { type: "ui.question.toggled" }
  | { type: "ui.question.custom.changed"; text: string }
  | { type: "ui.question.recorded"; question: string; answer: string }
  | { type: "ui.exit.requested" }
  | { type: "ui.notice.posted"; text: string }
  | { type: "ui.toast.posted"; id: string; text: string }
  | { type: "ui.toast.dismissed"; id: string }
  | { type: "ui.clock.ticked"; now: number };
