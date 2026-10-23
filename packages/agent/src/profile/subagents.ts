import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { CODE_REVIEW_DESCRIPTION, CODE_REVIEW_PROMPT } from "./codeReviewPrompt.ts";
import { SCOUT_DESCRIPTION, SCOUT_PROMPT } from "./scoutPrompt.ts";

export const AGENT_SUBAGENTS: Record<string, AgentDefinition> = {
  Scout: {
    description: SCOUT_DESCRIPTION,
    prompt: SCOUT_PROMPT,
    tools: ["Glob", "Grep", "Read"],
    model: "haiku",
    effort: "medium",
  },
  CodeReview: {
    description: CODE_REVIEW_DESCRIPTION,
    prompt: CODE_REVIEW_PROMPT,
    tools: ["Bash", "Glob", "Grep", "Read"],
    model: "sonnet",
    effort: "medium",
  },
};

export const SUBAGENT_GUIDANCE = `Prefer subagents over doing the work yourself. Use *Agent* with:
- Scout: to scan the codebase for specific information. It returns file paths and line ranges (<path>:<from>:<to>). Use it before you search or read many files.
- CodeReview: to review code changes against the repo's standards and spec.
Run independent subagents in parallel.`;
