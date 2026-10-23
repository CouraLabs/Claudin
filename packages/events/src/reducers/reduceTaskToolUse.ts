import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../session/sessionState.ts";

export function reduceTaskToolUse(state: SessionState, message: SDKMessage): SessionState {
  if (message.type !== "assistant" || !message.parent_tool_use_id) return state;
  const call = message.message.content.findLast((block) => block.type === "tool_use");
  if (call?.type !== "tool_use") return state;
  const lastToolCall = { name: call.name, input: (call.input ?? {}) as Record<string, unknown> };
  const tasks = state.tasks.map((task) =>
    task.toolUseId === message.parent_tool_use_id ? { ...task, lastToolCall } : task,
  );
  return { ...state, tasks };
}
