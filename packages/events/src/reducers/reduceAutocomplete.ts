import type { Autocomplete } from "../requests/uiEvents.ts";
import type { SessionState } from "../session/sessionState.ts";
import { wrapIndex } from "./wrapIndex.ts";

export const changeAutocomplete = (
  state: SessionState,
  autocomplete: Autocomplete | null,
): SessionState => ({ ...state, ui: { ...state.ui, autocomplete } });

export function moveAutocomplete(state: SessionState, delta: 1 | -1): SessionState {
  const { autocomplete } = state.ui;
  if (!autocomplete || autocomplete.matches.length === 0) return state;
  const selected = wrapIndex(autocomplete.selected + delta, autocomplete.matches.length);
  return changeAutocomplete(state, { ...autocomplete, selected });
}

export function updateFileMatches(
  state: SessionState,
  query: string,
  matches: string[],
): SessionState {
  const { autocomplete } = state.ui;
  if (autocomplete?.kind !== "file" || autocomplete.query !== query) return state;
  return changeAutocomplete(state, { ...autocomplete, matches, selected: 0 });
}
