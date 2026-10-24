import { BATCH_EDIT_TOOL_NAME } from "@kraude-kode/events";
import { AGENT_TOOLS } from "./agentTools.ts";

export const TOOL_USAGE: Record<string, string> = {
  Bash: "run shell commands; never to read, search, or edit files",
  Read: "read files",
  Grep: "search file contents",
  Glob: "scan files by name pattern",
  WebSearch: "search the web",
  WebFetch: "fetch a URL",
  TaskStop: "stop a running background task",
  Agent: "delegate work to a subagent",
  AskUserQuestion: "ask the user",
  Write: "create new files with content",
  Edit: "update files",
  mcp__kraude__BatchEdit: "update files mutiples files or multiple replaces in same file",
};

export const TOOL_GUIDANCE = `Always use the dedicated tool, never a workaround:
${AGENT_TOOLS.map((tool) => `- Use *${tool}* to ${TOOL_USAGE[tool]}`).join("\n")}
- Use *${BATCH_EDIT_TOOL_NAME}* instead of repeated *Edit* calls to make several edits, across one or many files, in one call`;
