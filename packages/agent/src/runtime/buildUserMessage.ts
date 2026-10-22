import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { type PromptContent, readPromptText } from "@claudin/events";

export type PromptPriority = NonNullable<SDKUserMessage["priority"]>;

const isSlashCommand = (content: PromptContent): boolean =>
  readPromptText(content).trimStart().startsWith("/");

export const buildUserMessage = (
  content: PromptContent,
  priority?: PromptPriority,
): SDKUserMessage => ({
  type: "user",
  message: { role: "user", content },
  parent_tool_use_id: null,
  priority,
  client_composed: isSlashCommand(content) ? undefined : true,
});
