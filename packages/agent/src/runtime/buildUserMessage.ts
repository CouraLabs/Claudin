import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { type PromptContent, readPromptText } from "@kraude-kode/events";

const isSlashCommand = (content: PromptContent): boolean =>
  readPromptText(content).trimStart().startsWith("/");

export const buildUserMessage = (content: PromptContent): SDKUserMessage => ({
  type: "user",
  message: { role: "user", content },
  parent_tool_use_id: null,
  client_composed: isSlashCommand(content) ? undefined : true,
});
