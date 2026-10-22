import { expect, test } from "vitest";
import { AGENT_MODE_PROFILES, buildModeOptions } from "./agentModeProfiles.ts";

test("each agent mode exposes exactly its tool list", () => {
  expect(AGENT_MODE_PROFILES.ask.tools).toEqual(["Read", "Grep", "Glob", "WebSearch", "WebFetch"]);
  expect(AGENT_MODE_PROFILES.plan.tools).toEqual([
    "Read",
    "Grep",
    "Glob",
    "WebSearch",
    "WebFetch",
    "TaskStop",
    "Agent",
    "AskUserQuestion",
  ]);
  expect(AGENT_MODE_PROFILES.build.tools).toEqual([
    ...AGENT_MODE_PROFILES.plan.tools,
    "Write",
    "Edit",
  ]);
});

test("plan mode cannot write files while build mode can", () => {
  expect(AGENT_MODE_PROFILES.plan.deniedTools).toEqual(["Write", "Edit"]);
  expect(AGENT_MODE_PROFILES.build.deniedTools).toEqual([]);
});

test("mode options replace the system prompt with the mode instructions", () => {
  const options = buildModeOptions("plan");
  expect(options.tools).toEqual(AGENT_MODE_PROFILES.plan.tools);
  expect(options.systemPrompt).toBe(AGENT_MODE_PROFILES.plan.instructions);
  expect(buildModeOptions("build").systemPrompt).not.toBe(options.systemPrompt);
});
