import { expect, test } from "vitest";
import { AgentSessionManager, buildUserMessage } from "./index.ts";

test("builds a user message that keeps the prompt content", () => {
  expect(buildUserMessage("hi").message.content).toBe("hi");
});

test("delivers prompts verbatim except slash commands", () => {
  expect(buildUserMessage("see @a.ts").client_composed).toBe(true);
  expect(buildUserMessage([{ type: "text", text: "hello" }]).client_composed).toBe(true);
  expect(buildUserMessage("/commit").client_composed).toBeUndefined();
});

test("rejects unknown sessions", () => {
  const manager = new AgentSessionManager();
  expect(() => manager.requireSession("missing")).toThrow("Unknown agent session");
  expect(manager.hasSession("missing")).toBe(false);
});
