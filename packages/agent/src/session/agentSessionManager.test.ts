import type { ModelInfo, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ResponseEvent } from "@claudin/events";
import { expect, test } from "vitest";
import { AGENT_PROFILE_OPTIONS } from "../profile/agentProfile.ts";
import { RESULT_MESSAGE, ScriptedRuntime, type ScriptedTurn } from "../runtime/scriptedRuntime.ts";
import { AgentSessionManager } from "./agentSessionManager.ts";

const note = (text: string) => ({ type: "system", subtype: "note", text }) as unknown as SDKMessage;

const noteText = (events: ResponseEvent[]) =>
  events.flatMap((event) =>
    event.type === "agent.message.received" && (event.message as SDKMessage).type === "system"
      ? [(event.message as unknown as { text: string }).text]
      : [],
  );

async function collect(turn: AsyncGenerator<ResponseEvent>) {
  const events: ResponseEvent[] = [];
  for await (const event of turn) events.push(event);
  return events;
}

function createFixture(turn?: ScriptedTurn) {
  const runtime = new ScriptedRuntime(turn);
  const manager = new AgentSessionManager(runtime);
  const id = manager.createSession({ cwd: "/work" });
  return { runtime, manager, id, session: manager.requireSession(id) };
}

test("a prompt streams the turn until its result", async () => {
  const { session } = createFixture(() => [note("hello"), RESULT_MESSAGE]);
  const events = await collect(session.prompt("hi"));
  expect(noteText(events)).toEqual(["hello"]);
  expect(events.at(-1)).toMatchObject({ message: { type: "result" } });
  expect(session.pendingTurns).toBe(0);
  expect(session.pumping).toBe(false);
});

const tasksChanged = (count: number) =>
  ({
    type: "system",
    subtype: "background_tasks_changed",
    tasks: Array.from({ length: count }, (_, index) => ({ task_id: `t${index}` })),
  }) as unknown as SDKMessage;

test("a turn stays open until background tasks finish", async () => {
  const { session } = createFixture(() => [
    tasksChanged(1),
    RESULT_MESSAGE,
    tasksChanged(0),
    note("task done"),
    RESULT_MESSAGE,
  ]);
  const events = await collect(session.prompt("go"));
  expect(noteText(events)).toContain("task done");
  expect(session.liveTaskIds.size).toBe(0);
});

const taskEvent = (subtype: string, taskId: string) =>
  ({ type: "system", subtype, task_id: taskId, status: "completed" }) as unknown as SDKMessage;

test("a turn stays open for parallel subagents the tasks list has not reported", async () => {
  const { session } = createFixture(() => [
    taskEvent("task_started", "a"),
    taskEvent("task_started", "b"),
    RESULT_MESSAGE,
    taskEvent("task_notification", "a"),
    RESULT_MESSAGE,
    taskEvent("task_notification", "b"),
    note("all done"),
    RESULT_MESSAGE,
  ]);
  const events = await collect(session.prompt("fan out"));
  expect(noteText(events)).toContain("all done");
  expect(session.liveTaskIds.size).toBe(0);
});

test("ambient tasks do not hold the turn open", async () => {
  const { session } = createFixture(() => [
    { ...taskEvent("task_started", "w"), ambient: true } as SDKMessage,
    RESULT_MESSAGE,
  ]);
  const events = await collect(session.prompt("watch"));
  expect(events.at(-1)).toMatchObject({ message: { type: "result" } });
});

test("a second prompt during a turn joins the running turn", async () => {
  const { session } = createFixture(() => [RESULT_MESSAGE]);
  const first = session.prompt("one");
  const second = session.prompt("two");
  const [firstEvents, secondEvents] = await Promise.all([collect(first), collect(second)]);
  expect(secondEvents).toEqual([]);
  const results = firstEvents.filter(
    (event) =>
      event.type === "agent.message.received" && (event.message as SDKMessage).type === "result",
  );
  expect(results).toHaveLength(2);
});

const askBash: ScriptedTurn = async function* (_input, options) {
  const verdict = await options.canUseTool?.("Bash", { command: "ls" }, {
    signal: new AbortController().signal,
    toolUseID: "t1",
  } as never);
  yield note(`verdict:${verdict?.behavior}`);
  yield RESULT_MESSAGE;
};

test("an approval round trip flows through the turn", async () => {
  const { session } = createFixture(askBash);
  const events: ResponseEvent[] = [];
  for await (const event of session.prompt("run it")) {
    events.push(event);
    if (event.type === "agent.tool.approval.required") session.answerApproval("t1", "approve");
  }
  expect(noteText(events)).toEqual(["verdict:allow"]);
  expect(events.map((event) => event.type)).toContain("agent.tool.approval.resolved");
});

test("cancelling interrupts the query and rejects what is pending", async () => {
  const { runtime, session } = createFixture(askBash);
  const events: ResponseEvent[] = [];
  for await (const event of session.prompt("run it")) {
    events.push(event);
    if (event.type === "agent.tool.approval.required") await session.cancel();
  }
  expect(noteText(events)).toEqual(["verdict:deny"]);
  expect(runtime.queries[0]?.calls).toContain("interrupt");
});

test("settings changes reach the query", async () => {
  const { runtime, session } = createFixture();
  await session.setModel("haiku");
  await session.setPermissionMode("plan");
  await session.setEffort("max");
  expect(runtime.queries[0]?.calls).toEqual([
    "setModel:haiku",
    "setPermissionMode:plan",
    'applyFlagSettings:{"effortLevel":"max"}',
  ]);
});

test("stopping a task reaches the query", async () => {
  const { runtime, session } = createFixture();
  await session.stopTask("t1");
  expect(runtime.queries[0]?.calls).toContain("stopTask:t1");
});

test("every session uses the shared profile tools and system prompt", () => {
  const { runtime } = createFixture();
  expect(runtime.queries[0]?.options).toMatchObject(AGENT_PROFILE_OPTIONS);
});

test("resuming falls back to a new session when the agent does not know the id", async () => {
  const runtime = new ScriptedRuntime();
  runtime.knownSessions.add("known");
  const manager = new AgentSessionManager(runtime);
  await manager.resumeSession("known");
  await manager.resumeSession("unknown");
  expect(runtime.queries[0]?.options).toMatchObject({ resume: "known" });
  expect(runtime.queries[1]?.options).toMatchObject({ sessionId: "unknown" });
  expect(runtime.queries[1]?.options).not.toHaveProperty("resume");
});

test("forking resumes the forked session", async () => {
  const runtime = new ScriptedRuntime();
  runtime.knownSessions.add("base-fork");
  const manager = new AgentSessionManager(runtime);
  expect(await manager.forkSession("base")).toBe("base-fork");
  expect(runtime.queries[0]?.options).toMatchObject({ resume: "base-fork" });
});

test("closing all sessions closes every query", () => {
  const runtime = new ScriptedRuntime();
  const manager = new AgentSessionManager(runtime);
  manager.createSession();
  manager.createSession();
  manager.closeAll();
  expect(runtime.queries.map((query) => query.calls.at(-1))).toEqual(["close", "close"]);
  expect(manager.sessions.size).toBe(0);
});

test("starting an MCP login returns the sign-in link from the runtime", async () => {
  const { runtime, session } = createFixture();
  expect(await session.startMcpLogin("docs")).toBe("https://auth.example/docs");
  expect(runtime.queries[0]?.calls).toContain("mcpAuthenticate:docs");
});

test("MCP login reports an SDK without login support", async () => {
  const { runtime, session } = createFixture();
  Object.assign(runtime.queries[0]!, { mcpAuthenticate: undefined });
  await expect(session.startMcpLogin("docs")).rejects.toThrow("does not support MCP login");
});

test("an MCP login link with an unsafe scheme is refused", async () => {
  const { runtime, session } = createFixture();
  runtime.queries[0]!.loginUrl = "file:///etc/passwd";
  await expect(session.startMcpLogin("docs")).rejects.toThrow("unsafe login link");
});

test("question answers reach a pending elicitation before the permission gate", async () => {
  const { runtime, session } = createFixture();
  const events: ResponseEvent[] = [];
  session.elicitations.listen((event) => events.push(event));
  const onElicitation = runtime.queries[0]!.options.onElicitation!;
  const pending = onElicitation(
    { serverName: "docs", message: "Sure?", mode: "form" },
    { signal: new AbortController().signal, requestId: "e1" },
  );
  session.answerQuestion("elicitation:e1", { "Sure?": "Accept" });
  expect(await pending).toEqual({ action: "accept", content: {} });
});

test("submitting an MCP callback forwards it to the sdk", async () => {
  const { runtime, session } = createFixture();
  await session.submitMcpCallback("docs", "http://localhost:1/callback?code=x");
  expect(runtime.queries[0]?.calls).toContain(
    "mcpCallback:docs:http://localhost:1/callback?code=x",
  );
  await expect(session.submitMcpCallback("docs", "file:///x")).rejects.toThrow("http(s)");
});
