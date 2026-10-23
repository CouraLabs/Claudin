import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export function readBackgroundTaskCount(message: SDKMessage, current: number): number {
  if (message.type !== "system" || message.subtype !== "background_tasks_changed") return current;
  return message.tasks.length;
}
