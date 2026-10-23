import type { ThemeName } from "../models/themeNames.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";

export const applyLoadedTheme = (
  state: SessionState,
  theme: ThemeName = state.theme,
): SessionState => ({
  ...state,
  theme,
});

export const applySavedTheme = (state: SessionState, theme: ThemeName): SessionState =>
  appendNotice({ ...state, theme }, `Theme set to ${theme}`);
