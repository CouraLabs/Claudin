import { ADHD_SYSTEM_PROMPT } from "./adhdSystemPrompt.ts";
import { SUBAGENT_GUIDANCE } from "./subagents.ts";
import { TOOL_GUIDANCE } from "./toolGuidance.ts";

export const AGENT_SYSTEM_PROMPT = [ADHD_SYSTEM_PROMPT, TOOL_GUIDANCE, SUBAGENT_GUIDANCE].join(
  "\n\n",
);
