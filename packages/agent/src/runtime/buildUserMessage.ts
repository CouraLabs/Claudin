import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PromptContent } from "@claudin/events";

export type PromptPriority = NonNullable<SDKUserMessage["priority"]>;

export const buildUserMessage = (
  content: PromptContent,
  priority?: PromptPriority,
): SDKUserMessage => ({
  type: "user",
  message: { role: "user", content },
  parent_tool_use_id: null,
  priority,
});
