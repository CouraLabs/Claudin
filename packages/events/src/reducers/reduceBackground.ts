import {
  BACKGROUND_CHANNELS,
  type BackgroundColor,
  CHANNEL_MAX,
  TRANSPARENT_BACKGROUND,
} from "../models/backgroundColor.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";
import { wrapIndex } from "./wrapIndex.ts";

export const openBackgroundEditor = (state: SessionState): SessionState => ({
  ...state,
  ui: { ...state.ui, backgroundEditor: { color: state.background, channel: 0 } },
});

export const closeBackgroundEditor = (state: SessionState): SessionState => ({
  ...state,
  ui: { ...state.ui, backgroundEditor: null },
});

export function moveBackgroundChannel(state: SessionState, delta: 1 | -1): SessionState {
  const { backgroundEditor } = state.ui;
  if (!backgroundEditor) return state;
  const channel = wrapIndex(backgroundEditor.channel + delta, BACKGROUND_CHANNELS.length);
  return { ...state, ui: { ...state.ui, backgroundEditor: { ...backgroundEditor, channel } } };
}

export function adjustBackgroundValue(state: SessionState, delta: number): SessionState {
  const { backgroundEditor } = state.ui;
  const key = BACKGROUND_CHANNELS[backgroundEditor?.channel ?? -1];
  if (!backgroundEditor || !key) return state;
  const value = Math.min(Math.max(backgroundEditor.color[key] + delta, 0), CHANNEL_MAX);
  const color = { ...backgroundEditor.color, [key]: value };
  return { ...state, ui: { ...state.ui, backgroundEditor: { ...backgroundEditor, color } } };
}

export const applyLoadedBackground = (
  state: SessionState,
  background: BackgroundColor = TRANSPARENT_BACKGROUND,
): SessionState => ({ ...state, background });

export const applySavedBackground = (state: SessionState, color: BackgroundColor): SessionState =>
  appendNotice(closeBackgroundEditor({ ...state, background: color }), "Background color saved");
