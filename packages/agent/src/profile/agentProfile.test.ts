import { expect, test } from "vitest";
import { AGENT_PROFILE_OPTIONS, AGENT_TOOLS } from "./agentProfile.ts";

test("the profile exposes the full tool list", () => {
  expect(AGENT_PROFILE_OPTIONS.tools).toEqual(AGENT_TOOLS);
  expect(AGENT_TOOLS).toEqual(
    expect.arrayContaining(["Read", "Grep", "Glob", "Agent", "AskUserQuestion", "Write", "Edit"]),
  );
});

test("the profile replaces the system prompt with the ADHD rules", () => {
  const prompt = AGENT_PROFILE_OPTIONS.systemPrompt as string;
  expect(prompt.startsWith("For the rest of this session, shape every response")).toBe(true);
  expect(prompt).toContain("10. No preamble, no recap, no closing pleasantries.");
  expect(prompt.endsWith("(the harness wins; keep the shape).")).toBe(true);
});
