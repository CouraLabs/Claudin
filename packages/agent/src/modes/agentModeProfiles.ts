import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentMode } from "@claudin/events";

type ModeProfile = {
  tools: string[];
  deniedTools: string[];
  instructions: string;
};

const WRITE_TOOLS = ["Write", "Edit"];

const READ_ONLY_TOOLS = ["Read", "Grep", "Glob", "WebSearch", "WebFetch"];

const SHARED_TOOLS = [...READ_ONLY_TOOLS, "TaskStop", "Agent", "AskUserQuestion"];

const PLAN_TOOLS = [...SHARED_TOOLS];

const BUILD_TOOLS = [...SHARED_TOOLS, ...WRITE_TOOLS];

export const AGENT_MODE_PROFILES: Record<AgentMode, ModeProfile> = {
  ask: {
    tools: READ_ONLY_TOOLS,
    deniedTools: WRITE_TOOLS,
    instructions:
      "You are in Ask mode. Answer anything the user asks about the codebase or any other topic. You cannot modify files or run commands. End every answer by suggesting the most useful next step for the user.",
  },
  plan: {
    tools: PLAN_TOOLS,
    deniedTools: WRITE_TOOLS,
    instructions:
      "You are in Plan mode. Never write or edit files, and only run read-only shell commands. Grill the user: ask focused clarifying questions, in plain text in your reply, until you have the context to plan their request. Use the Explore subagent through the Agent tool whenever you need to investigate the codebase. When the context is sufficient, answer with a complete step-by-step implementation plan. The user will switch to Build mode to implement it.",
  },
  build: {
    tools: BUILD_TOOLS,
    deniedTools: [],
    instructions:
      "You are in Build mode. Implement what the user asks using every available tool. When a plan was agreed earlier in the conversation, implement that plan.",
  },
};

export const buildModeOptions = (mode: AgentMode): Pick<Options, "tools" | "systemPrompt"> => ({
  tools: AGENT_MODE_PROFILES[mode].tools,
  systemPrompt: AGENT_MODE_PROFILES[mode].instructions,
});
