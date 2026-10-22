import type { Options } from "@anthropic-ai/claude-agent-sdk";
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
];

export const AGENT_PROFILE_OPTIONS: Pick<
  Options,
  "tools" | "systemPrompt" | "enableFileCheckpointing" | "extraArgs"
> = {
  tools: AGENT_TOOLS,
  systemPrompt: ADHD_SYSTEM_PROMPT,
  enableFileCheckpointing: true,
  extraArgs: { "replay-user-messages": null },
};
