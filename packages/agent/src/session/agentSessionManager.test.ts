import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ResponseEvent } from "@claudin/events";
import { expect, test } from "vitest";
import { AgentSessionManager } from "./agentSessionManager.ts";
import { RESULT_MESSAGE, ScriptedRuntime, type ScriptedTurn } from "../runtime/scriptedRuntime.ts";

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
  const id = manager.createSession({ cwd: "/work" }, "build");
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

test("queue and steer deliver the prompt with their priority", async () => {
  const seen: Array<SDKUserMessage["priority"]> = [];
  const { session } = createFixture((input) => {
    seen.push(input.priority);
    return [RESULT_MESSAGE];
  });
  await collect(session.prompt("a", "later"));
  await collect(session.prompt("b", "now"));
  await collect(session.prompt("c"));
  expect(seen).toEqual(["later", "now", undefined]);
});

test("a second prompt during a turn joins the running turn", async () => {
  const { session } = createFixture(() => [RESULT_MESSAGE]);
  const first = session.prompt("one");
  const second = session.prompt("two", "later");
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

test("settings changes reach the query and are kept for a mode switch", async () => {
  const { runtime, manager, id, session } = createFixture();
  await session.setModel("haiku");
  await session.setPermissionMode("plan");
  await session.setEffort("max");
  expect(runtime.queries[0]?.calls).toEqual([
    "setModel:haiku",
    "setPermissionMode:plan",
    'applyFlagSettings:{"effortLevel":"max"}',
  ]);
  await collect(session.prompt("start"));
  manager.switchMode(id, "plan");
  const [before, after] = runtime.queries;
  expect(before?.calls.at(-1)).toBe("close");
  expect(after?.options).toMatchObject({
    model: "haiku",
    permissionMode: "plan",
    effort: "max",
    resume: id,
  });
  expect(after?.options).not.toHaveProperty("sessionId");
});

test("switching mode before any prompt keeps the session id instead of resuming", () => {
  const { runtime, manager, id } = createFixture();
  manager.switchMode(id, "ask");
  expect(runtime.queries[1]?.options).toMatchObject({ sessionId: id });
  expect(runtime.queries[1]?.options).not.toHaveProperty("resume");
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
