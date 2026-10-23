import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { DEFAULT_PERMISSION_MODE } from "@claudin/events";
import { ADHD_SYSTEM_PROMPT } from "./adhdSystemPrompt.ts";

export const AGENT_TOOLS = [
  "Bash",
  "Read",
  "Grep",
  "Glob",
  "WebSearch",
  "WebFetch",
  "TaskStop",
  "Agent",
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskOutput",
  "TaskUpdate",
  "TodoWrite",
  "AskUserQuestion",
  "Write",
  "Edit",
  "NotebookEdit",
];

export const AGENT_PROFILE_OPTIONS: Pick<
  Options,
  | "tools"
  | "systemPrompt"
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
  systemPrompt: ADHD_SYSTEM_PROMPT,
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
