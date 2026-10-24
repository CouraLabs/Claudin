import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { readTokens, type UsageFields } from "../models/readTokens.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendEntry } from "./appendEntry.ts";
import { pickToolStatus, upsertToolCall } from "./toolGroups.ts";

type AssistantMessage = Extract<SDKMessage, { type: "assistant" }>;
type Block = AssistantMessage["message"]["content"][number];

function settleText(state: SessionState, messageId: string, text: string): SessionState {
  const index = state.transcript.findIndex(
    (entry) => entry.kind === "assistant" && entry.streaming && entry.messageId === messageId,
  );
  if (index < 0) {
    return text.trim()
      ? appendEntry(state, { kind: "assistant", messageId, text, streaming: false })
      : state;
  }
  const transcript = state.transcript.map((entry, i) =>
    i === index && entry.kind === "assistant" ? { ...entry, text, streaming: false } : entry,
  );
  return { ...state, transcript };
}

function reduceBlock(state: SessionState, messageId: string, block: Block): SessionState {
  if (block.type === "text") return settleText(state, messageId, block.text);
  if (block.type !== "tool_use") return state;
  const input = (block.input ?? {}) as Record<string, unknown>;
  const withCall = upsertToolCall(state, { id: block.id, name: block.name, input });
  return { ...withCall, status: pickToolStatus(withCall) };
}

export function reduceAssistant(state: SessionState, message: AssistantMessage): SessionState {
  if (message.parent_tool_use_id) return state;
  const { id, content, usage } = message.message;
  const withTokens = { ...state, tokens: readTokens(usage as UsageFields, state.tokens) };
  return content.reduce((current, block) => reduceBlock(current, id, block), withTokens);
}
