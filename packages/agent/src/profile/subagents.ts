import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { CODE_REVIEW_DESCRIPTION, CODE_REVIEW_PROMPT } from "./codeReviewPrompt.ts";
import { CODER_DESCRIPTION, CODER_PROMPT } from "./coderPrompt.ts";
import { QA_DESCRIPTION, QA_PROMPT } from "./qaPrompt.ts";
import { SCOUT_DESCRIPTION, SCOUT_PROMPT } from "./scoutPrompt.ts";

export const AGENT_SUBAGENTS: Record<string, AgentDefinition> = {
  Scout: {
    description: SCOUT_DESCRIPTION,
    prompt: SCOUT_PROMPT,
    tools: ["Glob", "Grep", "Read"],
    model: "haiku",
    effort: "high",
  },
  CodeReview: {
    description: CODE_REVIEW_DESCRIPTION,
    prompt: CODE_REVIEW_PROMPT,
    tools: ["Bash", "Glob", "Grep", "Read", "Skill"],
    model: "haiku",
    effort: "xhigh",
  },
  QA: {
    description: QA_DESCRIPTION,
    prompt: QA_PROMPT,
    skills: ["browser-use"],
    tools: ["Bash", "Read", "Skill"],
    model: "haiku",
    effort: "xhigh",
  },
  Coder: {
    description: CODER_DESCRIPTION,
    prompt: CODER_PROMPT,
    tools: ["Bash", "Edit", "Glob", "Grep", "Read", "Write", "WebSearch", "WebFetch", "Skill"],
    model: "sonnet",
    effort: "medium",
  },
};

export const SUBAGENT_GUIDANCE = `Prefer subagents over doing the work yourself. Use *Agent* with:
- Scout: to scan/explore/find/search/analyse the codebase for specific information. It returns file paths and line ranges (<path>:<from>:<to>). Use it before you search or read many files.
- CodeReview: to review code changes against the repo's standards and spec.
- Coder: to write, modify, or refactor code and get back a working implementation plus test steps.
- QA: to test app flows in a real browser via the browser-use skill and report bugs/regressions.
Run independent subagents in parallel. We prefer parallel work: whenever tasks are independent, delegate them all at once instead of one at a time.`;
