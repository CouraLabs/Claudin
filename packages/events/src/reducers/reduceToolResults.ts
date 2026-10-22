import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { clipOutput, joinBlocks } from "../models/messageText.ts";
import type { SessionState } from "../session/sessionState.ts";
import { pickToolStatus, updateToolCall } from "./toolGroups.ts";

type UserMessage = Extract<SDKMessage, { type: "user" }>;

type ResultBlock = { type: string; tool_use_id?: string; content?: unknown; is_error?: boolean };

function applyResult(state: SessionState, block: ResultBlock): SessionState {
  if (block.type !== "tool_result" || !block.tool_use_id) return state;
  const text = clipOutput(joinBlocks(block.content));
  return updateToolCall(state, block.tool_use_id, (call) =>
    block.is_error
      ? { ...call, status: "failed", error: text }
      : { ...call, status: "completed", output: text },
  );
}

export function reduceToolResults(state: SessionState, message: UserMessage): SessionState {
  const { content } = message.message;
  if (typeof content === "string") return state;
  const updated = (content as ResultBlock[]).reduce(applyResult, state);
  return { ...updated, status: pickToolStatus(updated) };
}
