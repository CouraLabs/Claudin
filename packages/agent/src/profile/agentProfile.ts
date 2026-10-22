import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { ADHD_SYSTEM_PROMPT } from "./adhdSystemPrompt.ts";

export const AGENT_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "WebSearch",
  "WebFetch",
  "TaskStop",
  "Agent",
  "AskUserQuestion",
  "Write",
  "Edit",
];

export const AGENT_PROFILE_OPTIONS: Pick<Options, "tools" | "systemPrompt"> = {
  tools: AGENT_TOOLS,
  systemPrompt: ADHD_SYSTEM_PROMPT,
};
