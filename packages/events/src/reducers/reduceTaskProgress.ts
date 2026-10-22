import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../session/sessionState.ts";
import { updateToolCall } from "./toolGroups.ts";

type TaskProgress = Extract<SDKMessage, { subtype: "task_progress" }>;

export function reduceTaskProgress(state: SessionState, message: TaskProgress): SessionState {
  const { tool_use_id: toolUseId, summary } = message;
  if (!toolUseId || !summary) return state;
  return updateToolCall(state, toolUseId, (call) => ({ ...call, progress: summary }));
}
