import type { PromptContent } from "../models/sdkValue.ts";
import type { SessionState } from "../session/sessionState.ts";

export const queuePrompt = (state: SessionState, content: PromptContent): SessionState => ({
  ...state,
  queuedPrompts: [...state.queuedPrompts, content],
});

export const dequeuePrompt = (state: SessionState): SessionState => ({
  ...state,
  queuedPrompts: state.queuedPrompts.slice(1),
});
