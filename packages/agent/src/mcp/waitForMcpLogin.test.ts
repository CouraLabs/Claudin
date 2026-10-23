import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "vitest";
import { waitForMcpLogin } from "./waitForMcpLogin.ts";

const server = (status: McpServerStatus["status"]): McpServerStatus[] => [{ name: "docs", status }];

const fastWait = { intervalMs: 1, timeoutMs: 1_000 };

test("polling stops once the server leaves needs-auth", async () => {
  const polls = [server("needs-auth"), server("needs-auth"), server("connected")];
  const result = await waitForMcpLogin(async () => polls.shift() ?? [], "docs", fastWait);
  expect(result).toEqual(server("connected"));
  expect(polls).toHaveLength(0);
});

test("polling gives up at the timeout with the last status", async () => {
  let calls = 0;
  const result = await waitForMcpLogin(
    async () => {
      calls += 1;
      return server("needs-auth");
    },
    "docs",
    { intervalMs: 1, timeoutMs: 20 },
  );
  expect(result).toEqual(server("needs-auth"));
  expect(calls).toBeGreaterThan(1);
});
