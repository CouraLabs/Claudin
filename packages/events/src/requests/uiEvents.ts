import type { BackgroundColor } from "../models/backgroundColor.ts";
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

export type PickerKind = "model" | "session" | "theme";

export type Picker = { kind: PickerKind; selected: number };

export type UiEvent =
  | { type: "ui.focus.changed"; focus: FocusTarget }
  | { type: "ui.focus.cycled"; direction: 1 | -1 }
  | { type: "ui.tool.toggled"; callId: string }
  | { type: "ui.autocomplete.changed"; autocomplete: Autocomplete | null }
  | { type: "ui.autocomplete.moved"; delta: 1 | -1 }
  | { type: "ui.picker.moved"; delta: 1 | -1 }
  | { type: "ui.picker.closed" }
  | { type: "ui.theme.picker.opened" }
  | { type: "ui.theme.selected"; theme: ThemeName }
  | { type: "ui.background.editor.opened" }
  | { type: "ui.background.editor.closed" }
  | { type: "ui.background.channel.moved"; delta: 1 | -1 }
  | { type: "ui.background.value.adjusted"; delta: number }
  | { type: "ui.question.moved"; delta: 1 | -1 }
  | { type: "ui.question.toggled" }
  | { type: "ui.question.custom.changed"; text: string }
  | { type: "ui.question.recorded"; question: string; answer: string }
  | { type: "ui.exit.requested" }
  | { type: "ui.notice.posted"; text: string }
  | { type: "ui.clock.ticked"; now: number };
