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

const subagentMessage = (model: string) =>
  ({
    type: "assistant",
    parent_tool_use_id: "call1",
    message: { id: "m1", model, content: [], usage: {} },
  }) as unknown as SDKMessage;

const agentCall = {
  type: "assistant",
  parent_tool_use_id: null,
  message: {
    id: "m0",
    content: [{ type: "tool_use", id: "call1", name: "Agent", input: { model: "haiku" } }],
    usage: {},
  },
} as unknown as SDKMessage;

const startedFromCall = system("task_started", { description: "Check", tool_use_id: "call1" });

test("a task starts with the model its Agent call requested", () => {
  const state = [agentCall, startedFromCall].reduce(reduceAgentMessage, createSessionState(""));
  expect(state.tasks[0]).toMatchObject({ toolUseId: "call1", model: "haiku" });
});

test("the subagent's own messages set the model it runs on", () => {
  const messages = [agentCall, startedFromCall, subagentMessage("claude-haiku-4-5")];
  const state = messages.reduce(reduceAgentMessage, createSessionState(""));
  expect(state.tasks[0]?.model).toBe("claude-haiku-4-5");
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
  const state = reduceAgentMessage(
    reduceAgentMessage(createSessionState(""), started),
    notification,
  );
  expect(state.tasks).toEqual([]);
  expect(JSON.stringify(state.transcript)).toContain("Task stopped: Stopped it");
});

test("a notification notice is flagged as markdown", () => {
  const notification = system("task_notification", { status: "completed", summary: "**Done**" });
  const state = reduceAgentMessage(createSessionState(""), notification);
  expect(state.transcript[0]).toMatchObject({ kind: "notice", markdown: true });
});

test("the subagent's latest tool call is kept with its input", () => {
  const toolUse = {
    type: "assistant",
    parent_tool_use_id: "call1",
    message: {
      id: "m2",
      model: "m",
      content: [{ type: "tool_use", id: "x", name: "Read", input: { file_path: "a.ts" } }],
      usage: {},
    },
  } as unknown as SDKMessage;
  const state = [agentCall, startedFromCall, toolUse].reduce(
    reduceAgentMessage,
    createSessionState(""),
  );
  expect(state.tasks[0]?.lastToolCall).toEqual({ name: "Read", input: { file_path: "a.ts" } });
});
