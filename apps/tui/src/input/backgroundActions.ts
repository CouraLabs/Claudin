import type { AppStore } from "../store/appStore.ts";

const FINE_STEP = 1;
const COARSE_STEP = 16;

export const adjustBackground = (store: AppStore, direction: 1 | -1, coarse: boolean): void =>
  store.emit({
    type: "ui.background.value.adjusted",
    delta: direction * (coarse ? COARSE_STEP : FINE_STEP),
  });

export function saveBackground(store: AppStore): void {
  const { backgroundEditor } = store.state.ui;
  if (!backgroundEditor) return;
  store.request({ type: "options.background.save.requested", color: backgroundEditor.color });
}

export const closeBackgroundEditor = (store: AppStore): void =>
  store.emit({ type: "ui.background.editor.closed" });
