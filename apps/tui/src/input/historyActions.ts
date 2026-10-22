import { readHistoryText } from "@claudin/events";
import type { KeyEvent } from "@opentui/core";
import type { AppStore } from "../store/appStore.ts";

export type InputEditor = { read: () => string; replace: (text: string) => void };

const showHistoryText = (store: AppStore, editor: InputEditor): void => {
  const text = readHistoryText(store.state);
  if (text !== undefined) editor.replace(text);
};

export function routeHistoryKey(key: KeyEvent, store: AppStore, editor: InputEditor): boolean {
  const { ui, prompts } = store.state;
  if (ui.focus !== "input" || (key.name !== "up" && key.name !== "down")) return false;
  const starting = key.name === "up" && editor.read() === "" && prompts.length > 0;
  if (!ui.history && !starting) return false;
  const delta = key.name === "up" ? -1 : 1;
  store.emit({ type: "ui.history.moved", delta, draft: editor.read() });
  showHistoryText(store, editor);
  return true;
}

export function routeHistorySearchKey(
  key: KeyEvent,
  store: AppStore,
  editor: InputEditor,
): boolean {
  if (!key.ctrl || key.name !== "r" || store.state.ui.focus !== "input") return false;
  store.emit({ type: "ui.history.searched", draft: editor.read() });
  showHistoryText(store, editor);
  return true;
}
