import { BATCH_EDIT_TOOL_NAME, CUSTOM_SERVER_NAME } from "@kraude-kode/events";
import { expect, test } from "vitest";
import { AGENT_PROFILE_OPTIONS } from "./agentProfile.ts";
import { AGENT_TOOLS } from "./agentTools.ts";

test("the profile exposes the full tool list", () => {
  expect(AGENT_PROFILE_OPTIONS.tools).toEqual(AGENT_TOOLS);
  expect(AGENT_TOOLS).toEqual(
    expect.arrayContaining(["Read", "Grep", "Glob", "Agent", "AskUserQuestion", "Write", "Edit"]),
  );
});

test("the profile keeps the ADHD rules and adds tool and subagent guidance", () => {
  const prompt = AGENT_PROFILE_OPTIONS.systemPrompt as string;
  expect(prompt.startsWith("For the rest of this session, shape every response")).toBe(true);
  expect(prompt).toContain("9. No preamble, no recap, no closing pleasantries.");
  expect(prompt).toContain("- Use *Write* to create new files with content");
  expect(prompt).toContain("- Use *Edit* to update files");
  expect(prompt).toContain("- Use *AskUserQuestion* to ask the user");
  expect(prompt).toContain("- Use *Glob* to scan files by name pattern");
  expect(prompt).toContain("Prefer subagents");
});

test("every tool has a usage line in the system prompt", () => {
  const prompt = AGENT_PROFILE_OPTIONS.systemPrompt as string;
  for (const tool of AGENT_TOOLS) expect(prompt).toMatch(new RegExp(`- Use \\*${tool}\\* to \\S`));
});

test("the profile defines Scout, CodeReview, QA and Coder subagents", () => {
  const { agents } = AGENT_PROFILE_OPTIONS;
  expect(agents?.Scout).toMatchObject({ model: "haiku", effort: "high" });
  expect(agents?.Scout?.prompt).toContain("<path>:<from>:<to>");
  expect(agents?.CodeReview).toMatchObject({ model: "haiku", effort: "xhigh" });
  expect(agents?.CodeReview?.prompt).not.toMatch(/skill|\/setup|sub-agent/i);
  expect(agents?.QA).toMatchObject({ model: "haiku", effort: "xhigh", skills: ["browser-use"] });
  expect(agents?.QA?.tools).toEqual(expect.arrayContaining(["Bash", "Read"]));
  expect(agents?.QA?.prompt).toContain("Target Path");
  expect(agents?.Coder).toMatchObject({ model: "sonnet", effort: "medium" });
  expect(agents?.Coder?.tools).toEqual(
    expect.arrayContaining(["Edit", "Write", "WebSearch", "WebFetch", "Skill"]),
  );
  expect(agents?.Coder?.prompt).toContain("### Steps to Test");
  expect(AGENT_PROFILE_OPTIONS.systemPrompt).toContain("Scout");
  expect(AGENT_PROFILE_OPTIONS.systemPrompt).toContain("CodeReview");
  expect(AGENT_PROFILE_OPTIONS.systemPrompt).toContain("Coder");
  expect(AGENT_PROFILE_OPTIONS.systemPrompt).toContain("QA:");
});

test("the profile checkpoints files and replays prompts for rewind ids", () => {
  expect(AGENT_PROFILE_OPTIONS.enableFileCheckpointing).toBe(true);
  expect(AGENT_PROFILE_OPTIONS.extraArgs).toEqual({ "replay-user-messages": null });
});

test("the profile bypasses permissions and caches prompts for an hour without attribution", () => {
  expect(AGENT_PROFILE_OPTIONS.permissionMode).toBe("bypassPermissions");
  expect(AGENT_PROFILE_OPTIONS.allowDangerouslySkipPermissions).toBe(true);
  expect(AGENT_PROFILE_OPTIONS.settings).toMatchObject({
    promptCacheTtl: "1h",
    subagentPromptCacheTtl: "1h",
    attribution: { commit: "", pr: "" },
  });
});

test("the profile loads project context and skills", () => {
  expect(AGENT_PROFILE_OPTIONS.settingSources).toEqual(["user", "project", "local"]);
  expect(AGENT_PROFILE_OPTIONS.skills).toBe("all");
});

test("the profile streams partial messages, hook events and subagent summaries", () => {
  expect(AGENT_PROFILE_OPTIONS.includePartialMessages).toBe(true);
  expect(AGENT_PROFILE_OPTIONS.includeHookEvents).toBe(true);
  expect(AGENT_PROFILE_OPTIONS.agentProgressSummaries).toBe(true);
});

test("the profile registers BatchEdit through the custom MCP server", () => {
  expect(Object.keys(AGENT_PROFILE_OPTIONS.mcpServers ?? {})).toEqual([CUSTOM_SERVER_NAME]);
  expect(AGENT_PROFILE_OPTIONS.systemPrompt).toContain(
    `- Use *${BATCH_EDIT_TOOL_NAME}* instead of`,
  );
});

test("the profile aliases the short BatchEdit name to the MCP tool", () => {
  expect(AGENT_PROFILE_OPTIONS.toolAliases).toEqual({ BatchEdit: BATCH_EDIT_TOOL_NAME });
});
