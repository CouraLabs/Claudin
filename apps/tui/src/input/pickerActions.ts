import { THEME_NAMES } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { requestAgent } from "./agentRequest.ts";
import { guardIdle } from "./localCommands.ts";

export function confirmPicker(store: AppStore): void {
  const { state } = store;
  const { picker } = state.ui;
  if (!picker) return;
  store.emit({ type: "ui.picker.closed" });
  if (picker.kind === "model") {
    const model = state.models[picker.selected];
    if (model) requestAgent(store, { type: "agent.model.set.requested", model: model.value });
    return;
  }
  if (picker.kind === "theme") {
    const theme = THEME_NAMES[picker.selected];
    if (theme) store.emit({ type: "ui.theme.selected", theme });
    return;
  }
  const target = state.sessionList[picker.selected];
  if (!target) return;
  if (target.id === state.sessionId) {
    return store.emit({ type: "ui.notice.posted", text: "Already in this session" });
  }
  if (guardIdle(store, "switching session")) {
    store.request({ type: "session.restore.requested", sessionId: target.id });
  }
}
