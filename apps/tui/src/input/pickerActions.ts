import {
  effortLevelSchema,
  listCheckpoints,
  type Picker,
  type SessionState,
  THEME_NAMES,
} from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { guardIdle } from "./agentBusy.ts";
import { requestAgent } from "./agentRequest.ts";
import { saveTheme } from "./themeActions.ts";

type PickerConfirm = (store: AppStore, state: SessionState, selected: number) => void;

function switchSession(store: AppStore, state: SessionState, selected: number): void {
  const target = state.sessionList[selected];
  if (!target) return;
  if (target.id === state.sessionId) {
    return store.emit({ type: "ui.notice.posted", text: "Already in this session" });
  }
  if (guardIdle(store, "switching session")) {
    store.request({ type: "session.restore.requested", sessionId: target.id });
  }
}

const PICKER_CONFIRMS: Record<Picker["kind"], PickerConfirm> = {
  model(store, state, selected) {
    const model = state.models[selected];
    if (model) requestAgent(store, { type: "agent.model.set.requested", model: model.value });
  },
  theme(store, _state, selected) {
    const theme = THEME_NAMES[selected];
    if (theme) saveTheme(store, theme);
  },
  effort(store, _state, selected) {
    const effort = effortLevelSchema.options[selected];
    if (effort) requestAgent(store, { type: "agent.effort.set.requested", effort });
  },
  rewind(store, state, selected) {
    const userMessageId = listCheckpoints(state)[selected]?.checkpointId;
    if (userMessageId && guardIdle(store, "rewinding")) {
      requestAgent(store, { type: "agent.files.rewind.requested", userMessageId });
    }
  },
  session: switchSession,
  search: switchSession,
};

export function confirmPicker(store: AppStore): void {
  const { state } = store;
  const { picker } = state.ui;
  if (!picker) return;
  store.emit({ type: "ui.picker.closed" });
  PICKER_CONFIRMS[picker.kind](store, state, picker.selected);
}
