import type { Options } from "@anthropic-ai/claude-agent-sdk";
import {
  BATCH_EDIT_BASE_NAME,
  BATCH_EDIT_TOOL_NAME,
  DEFAULT_PERMISSION_MODE,
} from "@claudin/events";
import { CUSTOM_MCP_SERVERS } from "../tools/customToolsServer.ts";
import { AGENT_SYSTEM_PROMPT } from "./agentSystemPrompt.ts";
import { AGENT_DISALLOWED_TOOLS, AGENT_TOOLS } from "./agentTools.ts";
import { AGENT_SUBAGENTS } from "./subagents.ts";

export const AGENT_PROFILE_OPTIONS: Pick<
  Options,
  | "tools"
  | "mcpServers"
  | "toolAliases"
  | "systemPrompt"
  | "disallowedTools"
  | "agents"
  | "enableFileCheckpointing"
  | "extraArgs"
  | "permissionMode"
  | "allowDangerouslySkipPermissions"
  | "settings"
  | "settingSources"
  | "skills"
  | "agentProgressSummaries"
  | "includePartialMessages"
  | "includeHookEvents"
> = {
  tools: AGENT_TOOLS,
  mcpServers: CUSTOM_MCP_SERVERS,
  toolAliases: { [BATCH_EDIT_BASE_NAME]: BATCH_EDIT_TOOL_NAME },
  disallowedTools: AGENT_DISALLOWED_TOOLS,
  systemPrompt: AGENT_SYSTEM_PROMPT,
  agents: AGENT_SUBAGENTS,
  enableFileCheckpointing: true,
  extraArgs: { "replay-user-messages": null },
  permissionMode: DEFAULT_PERMISSION_MODE,
  allowDangerouslySkipPermissions: true,
  settings: {
    agentPushNotifEnabled: true,
    showMessageTimestamps: true,
    idleCompaction: false,
    autoCompactEnabled: true,
    showThinkingSummaries: true,
    autoMemoryEnabled: false,
    emojiCompletionEnabled: false,
    spinnerTipsEnabled: false,
    disableAgentView: true,
    allowAllClaudeAiMcps: false,
    includeGitInstructions: false,
    syncClaudeAiPlugins: false,
    syncClaudeAiSkills: false,
    enableAllProjectMcpServers: true,
    promptCacheTtl: "1h",
    subagentPromptCacheTtl: "5m",
    viewMode: "verbose",
    attribution: { commit: "", pr: "" },
  },
  settingSources: ["user", "project", "local"],
  skills: "all",
  agentProgressSummaries: true,
  includePartialMessages: true,
  includeHookEvents: true,
};
