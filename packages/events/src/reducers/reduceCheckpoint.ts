import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { joinBlocks } from "../models/messageText.ts";
import type { SessionState } from "../session/sessionState.ts";
import type { TranscriptEntry, UserEntry } from "../session/transcriptTypes.ts";

type UserMessage = Extract<SDKMessage, { type: "user" }>;

const isUserEntry = (entry: TranscriptEntry): entry is UserEntry => entry.kind === "user";

const hasToolResults = (content: unknown): boolean =>
  Array.isArray(content) && content.some((block) => block?.type === "tool_result");

export const isPromptEcho = (message: UserMessage): boolean =>
  Boolean(message.uuid) &&
  !message.parent_tool_use_id &&
  !message.isSynthetic &&
  !hasToolResults(message.message.content);

export const listCheckpoints = (state: SessionState): UserEntry[] =>
  state.transcript.filter(isUserEntry).filter((entry) => entry.checkpointId);

export function reduceCheckpoint(state: SessionState, message: UserMessage): SessionState {
  const text = joinBlocks(message.message.content);
  const lastMarked = state.transcript.findLastIndex(
    (entry) => isUserEntry(entry) && entry.checkpointId,
  );
  const target = state.transcript.findIndex(
    (entry, index) =>
      index > lastMarked && isUserEntry(entry) && !entry.checkpointId && entry.text === text,
  );
  if (target < 0) return state;
  return {
    ...state,
    transcript: state.transcript.map((entry, index) =>
      index === target ? { ...entry, checkpointId: message.uuid } : entry,
    ),
  };
}
