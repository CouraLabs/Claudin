import { expect, test } from "vitest";
import { AGENT_PROFILE_OPTIONS, AGENT_TOOLS } from "./agentProfile.ts";

test("the profile exposes the full tool list", () => {
  expect(AGENT_PROFILE_OPTIONS.tools).toEqual(AGENT_TOOLS);
  expect(AGENT_TOOLS).toEqual(
    expect.arrayContaining([
      "Read",
      "Grep",
      "Glob",
      "Agent",
      "AskUserQuestion",
      "Write",
      "Edit",
      "NotebookEdit",
    ]),
  );
});

test("the profile replaces the system prompt with the ADHD rules", () => {
  const prompt = AGENT_PROFILE_OPTIONS.systemPrompt as string;
  expect(prompt.startsWith("For the rest of this session, shape every response")).toBe(true);
  expect(prompt).toContain("10. No preamble, no recap, no closing pleasantries.");
  expect(prompt.endsWith("(the harness wins; keep the shape).")).toBe(true);
});

test("the profile checkpoints files and replays prompts for rewind ids", () => {
  expect(AGENT_PROFILE_OPTIONS.enableFileCheckpointing).toBe(true);
  expect(AGENT_PROFILE_OPTIONS.extraArgs).toEqual({ "replay-user-messages": null });
});

test("the profile bypasses permissions and caches prompts for an hour without attribution", () => {
  expect(AGENT_PROFILE_OPTIONS.permissionMode).toBe("bypassPermissions");
  expect(AGENT_PROFILE_OPTIONS.allowDangerouslySkipPermissions).toBe(true);
  expect(AGENT_PROFILE_OPTIONS.settings).toEqual({
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
