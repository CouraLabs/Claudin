import { appendNotice } from "./appendEntry.ts";
import { changeAutocomplete, moveAutocomplete } from "./reduceAutocomplete.ts";
import {
  adjustBackgroundValue,
  closeBackgroundEditor,
  moveBackgroundChannel,
  openBackgroundEditor,
} from "./reduceBackground.ts";
import {
  changeQuestionCustom,
  moveQuestionCursor,
  recordQuestionAnswer,
  toggleQuestionPick,
} from "./reduceQuestion.ts";
import type { SessionState } from "../session/sessionState.ts";
import { THEME_NAMES } from "../models/themeNames.ts";
import { isToolsEntry } from "./toolGroups.ts";
import type { FocusTarget, PickerKind, UiEvent } from "../requests/uiEvents.ts";
import { wrapIndex } from "./wrapIndex.ts";

const FOCUS_ORDER: FocusTarget[] = ["input", "scrollback"];

function cycleFocus(state: SessionState, direction: 1 | -1): SessionState {
  const current = FOCUS_ORDER.indexOf(state.ui.focus);
  const next = FOCUS_ORDER[wrapIndex(current + direction, FOCUS_ORDER.length)] ?? "input";
  return { ...state, ui: { ...state.ui, focus: next } };
}

const toggleTool = (state: SessionState, callId: string): SessionState => ({
  ...state,
  transcript: state.transcript.map((entry) =>
    isToolsEntry(entry)
      ? {
          ...entry,
          calls: entry.calls.map((call) =>
            call.id === callId ? { ...call, expanded: !call.expanded } : call,
          ),
        }
      : entry,
  ),
});

const pickerSize = (state: SessionState, kind: PickerKind): number => {
  if (kind === "model") return state.models.length;
  if (kind === "theme") return THEME_NAMES.length;
  return state.sessionList.length;
};

function movePicker(state: SessionState, delta: 1 | -1): SessionState {
  const { picker } = state.ui;
  if (!picker) return state;
  const size = pickerSize(state, picker.kind);
  if (size === 0) return state;
  const selected = wrapIndex(picker.selected + delta, size);
  return { ...state, ui: { ...state.ui, picker: { ...picker, selected } } };
}

const openThemePicker = (state: SessionState): SessionState => {
  const selected = Math.max(THEME_NAMES.indexOf(state.theme), 0);
  return { ...state, ui: { ...state.ui, picker: { kind: "theme", selected } } };
};

export function reduceUi(state: SessionState, event: UiEvent): SessionState {
  switch (event.type) {
    case "ui.focus.changed":
      return { ...state, ui: { ...state.ui, focus: event.focus } };
    case "ui.focus.cycled":
      return cycleFocus(state, event.direction);
    case "ui.tool.toggled":
      return toggleTool(state, event.callId);
    case "ui.autocomplete.changed":
      return changeAutocomplete(state, event.autocomplete);
    case "ui.autocomplete.moved":
      return moveAutocomplete(state, event.delta);
    case "ui.picker.moved":
      return movePicker(state, event.delta);
    case "ui.picker.closed":
      return { ...state, ui: { ...state.ui, picker: null } };
    case "ui.theme.picker.opened":
      return openThemePicker(state);
    case "ui.theme.selected":
      return appendNotice({ ...state, theme: event.theme }, `Theme set to ${event.theme}`);
    case "ui.background.editor.opened":
      return openBackgroundEditor(state);
    case "ui.background.editor.closed":
      return closeBackgroundEditor(state);
    case "ui.background.channel.moved":
      return moveBackgroundChannel(state, event.delta);
    case "ui.background.value.adjusted":
      return adjustBackgroundValue(state, event.delta);
    case "ui.question.moved":
      return moveQuestionCursor(state, event.delta);
    case "ui.question.toggled":
      return toggleQuestionPick(state);
    case "ui.question.custom.changed":
      return changeQuestionCustom(state, event.text);
    case "ui.question.recorded":
      return recordQuestionAnswer(state, event);
    case "ui.exit.requested":
      return state;
    case "ui.notice.posted":
      return appendNotice(state, event.text);
    case "ui.clock.ticked":
      return { ...state, now: event.now };
  }
}
