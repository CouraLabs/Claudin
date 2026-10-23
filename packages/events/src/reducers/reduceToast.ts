import type { Toast } from "../requests/uiEvents.ts";
import type { SessionState } from "../session/sessionState.ts";

const withToast = (state: SessionState, toast: Toast | null): SessionState => ({
  ...state,
  ui: { ...state.ui, toast },
});

export const postToast = (state: SessionState, toast: Toast): SessionState =>
  withToast(state, { id: toast.id, text: toast.text });

export const dismissToast = (state: SessionState, id: string): SessionState =>
  state.ui.toast?.id === id ? withToast(state, null) : state;
