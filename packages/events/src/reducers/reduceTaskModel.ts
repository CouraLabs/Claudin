import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../session/sessionState.ts";
import { listToolCalls } from "./toolGroups.ts";

type StreamEvent = { type: string; message?: { model?: string } };

const readMessageModel = (message: SDKMessage): string | undefined => {
  if (message.type === "assistant") return message.message.model;
  if (message.type !== "stream_event") return undefined;
  const event = message.event as StreamEvent;
  return event.type === "message_start" ? event.message?.model : undefined;
};

export const readRequestedModel = (state: SessionState, toolUseId?: string): string | undefined => {
  const model = listToolCalls(state).find((call) => call.id === toolUseId)?.input.model;
  return typeof model === "string" ? model : undefined;
};

export function reduceTaskModel(state: SessionState, message: SDKMessage): SessionState {
  if (message.type !== "assistant" && message.type !== "stream_event") return state;
  const model = readMessageModel(message);
  const parentId = message.parent_tool_use_id;
  const stale = (task: SessionState["tasks"][number]) =>
    task.toolUseId === parentId && task.model !== model;
  if (!model || !parentId || !state.tasks.some(stale)) return state;
  const tasks = state.tasks.map((task) => (stale(task) ? { ...task, model } : task));
  return { ...state, tasks };
}
