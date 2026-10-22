import { readPromptText } from "../models/messageText.ts";
import type { PromptContent } from "../models/sdkValue.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendEntry } from "./appendEntry.ts";
import { queuePromptHistory } from "./reduceHistory.ts";

export function reducePrompt(
  state: SessionState,
  content: PromptContent,
  isFollowUp: boolean,
): SessionState {
  const withUser = appendEntry(state, { kind: "user", text: readPromptText(content) });
  return {
    ...withUser,
    prompts: [...state.prompts, content],
    promptHistory: queuePromptHistory(state.promptHistory, readPromptText(content)),
    status: "thinking",
    queuedTurns: isFollowUp ? state.queuedTurns + 1 : state.queuedTurns,
    turnStartedAt: isFollowUp ? (state.turnStartedAt ?? state.now) : state.now,
    ui: { ...state.ui, autocomplete: null, history: null },
  };
}
