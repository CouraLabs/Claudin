import { expect, test } from "vitest";
import { AgentSessionManager, buildUserMessage } from "./index.ts";

test("builds user message with priority", () => {
  const message = buildUserMessage("hi", "now");
  expect(message).toMatchObject({ type: "user", priority: "now" });
  expect(message.message.content).toBe("hi");
});

test("rejects unknown sessions", () => {
  const manager = new AgentSessionManager();
  expect(() => manager.requireSession("missing")).toThrow("Unknown agent session");
  expect(manager.hasSession("missing")).toBe(false);
});
