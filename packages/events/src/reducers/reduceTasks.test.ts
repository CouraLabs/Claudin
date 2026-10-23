import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "vitest";
import { createSessionState } from "../session/sessionState.ts";
import { reduceAgentMessage } from "./reduceAgentMessage.ts";

const system = (subtype: string, fields: object) =>
  ({ type: "system", subtype, task_id: "t1", ...fields }) as unknown as SDKMessage;

const started = system("task_started", { description: "Check", subagent_type: "explore" });

test("a started task is listed with its kind", () => {
  const state = reduceAgentMessage(createSessionState(""), started);
  expect(state.tasks).toMatchObject([{ id: "t1", kind: "explore", description: "Check" }]);
});

test("ambient tasks are not listed", () => {
  const ambient = system("task_started", { description: "Watch", ambient: true });
  expect(reduceAgentMessage(createSessionState(""), ambient).tasks).toEqual([]);
});

test("progress updates the task row", () => {
  const progress = system("task_progress", {
    description: "Check",
    last_tool_name: "Grep",
    usage: { total_tokens: 40, tool_uses: 1, duration_ms: 5 },
  });
  const state = reduceAgentMessage(reduceAgentMessage(createSessionState(""), started), progress);
  expect(state.tasks[0]).toMatchObject({ lastToolName: "Grep", tokens: 40 });
});

test("a finished status patch removes the task", () => {
  const done = system("task_updated", { patch: { status: "completed" } });
  const state = reduceAgentMessage(reduceAgentMessage(createSessionState(""), started), done);
  expect(state.tasks).toEqual([]);
});

test("a notification removes the task and keeps the notice", () => {
  const notification = system("task_notification", { status: "stopped", summary: "Stopped it" });
  const state = reduceAgentMessage(reduceAgentMessage(createSessionState(""), started), notification);
  expect(state.tasks).toEqual([]);
  expect(JSON.stringify(state.transcript)).toContain("Task stopped: Stopped it");
});
