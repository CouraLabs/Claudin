import type { AppStore } from "../store/appStore.ts";

const TOAST_DURATION_MS = 2500;

export function showToast(store: AppStore, text: string): void {
  const id = crypto.randomUUID();
  store.emit({ type: "ui.toast.posted", id, text });
  setTimeout(() => store.emit({ type: "ui.toast.dismissed", id }), TOAST_DURATION_MS).unref();
}
