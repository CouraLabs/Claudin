import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";

const NO_MATCH_NOTICE = "No earlier prompt matches";

export const MAX_PROMPT_HISTORY = 10;

export const queuePromptHistory = (entries: string[], text: string): string[] =>
  text === "" || entries.at(-1) === text ? entries : [...entries, text].slice(-MAX_PROMPT_HISTORY);

export const listPromptTexts = (state: SessionState): string[] => state.promptHistory;

export const loadHistory = (state: SessionState, entries: string[]): SessionState => ({
  ...state,
  promptHistory: [...entries, ...state.promptHistory].slice(-MAX_PROMPT_HISTORY),
});

export function readHistoryText(state: SessionState): string | undefined {
  const { history } = state.ui;
  if (!history) return undefined;
  return listPromptTexts(state)[history.index] ?? history.draft;
}

function browsingPosition(state: SessionState, draft: string) {
  const size = state.promptHistory.length;
  const { history } = state.ui;
  const browsing = history !== null && history.index < size;
  return { size, index: browsing ? history.index : size, draft: browsing ? history.draft : draft };
}

export function moveHistory(state: SessionState, delta: 1 | -1, draft: string): SessionState {
  const position = browsingPosition(state, draft);
  if (position.size === 0) return state;
  const index = Math.min(Math.max(position.index + delta, 0), position.size);
  return { ...state, ui: { ...state.ui, history: { index, draft: position.draft } } };
}

export function searchHistory(state: SessionState, draft: string): SessionState {
  const position = browsingPosition(state, draft);
  const query = position.draft.toLowerCase();
  const texts = listPromptTexts(state);
  const index = texts.findLastIndex(
    (text, at) => at < position.index && text.toLowerCase().includes(query),
  );
  if (index < 0) return appendNotice(state, NO_MATCH_NOTICE);
  return { ...state, ui: { ...state.ui, history: { index, draft: position.draft } } };
}

export const resetHistory = (state: SessionState): SessionState => ({
  ...state,
  ui: { ...state.ui, history: null },
});
