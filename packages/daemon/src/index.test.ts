import { mkdir, mkdtemp, readdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentSessionManager,
  RESULT_MESSAGE,
  ScriptedRuntime,
  type ScriptedTurn,
} from "@claudin/agent";
import { FileSessionStore, type RequestEvent, startSession } from "@claudin/events";
import { expect, test } from "vitest";
import { createDaemonContext, type DaemonContext } from "./server/daemonContext.ts";
import { handleRequest } from "./server/handleRequest.ts";

function useScriptedAgents(context: DaemonContext, turn?: ScriptedTurn) {
  const runtime = new ScriptedRuntime(turn);
  context.agents = new AgentSessionManager(runtime);
  return runtime;
}

const countClosed = (runtime: ScriptedRuntime) =>
  runtime.queries.filter((query) => query.calls.includes("close")).length;

test("session create request swaps the session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "claudin-"));
  const context = await createDaemonContext(new FileSessionStore(directory));
  const firstId = context.session.id;

  const responses = [];
  for await (const response of handleRequest(context, { type: "session.create.requested" })) {
    responses.push(response);
  }

  expect(context.session.id).not.toBe(firstId);
  expect(responses).toEqual([{ type: "session.created", sessionId: context.session.id }]);
  expect(await readdir(directory)).toHaveLength(2);
});

test("creating a session closes agent sessions and persists session.created once", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const context = await createDaemonContext(store);
  const runtime = useScriptedAgents(context);
  context.agents.createSession();

  await collect(context, { type: "session.create.requested" });

  expect(countClosed(runtime)).toBe(1);
  const created = (await store.read(context.session.id)).filter(
    ({ event }) => event.type === "session.created",
  );
  expect(created).toHaveLength(1);
});

test("queued prompts are accepted and then streamed with later priority", async () => {
  const context = await createDaemonContext(
    new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-"))),
  );
  const priorities: unknown[] = [];
  useScriptedAgents(context, (input) => {
    priorities.push(input.priority);
    return [RESULT_MESSAGE];
  });
  context.agents.createSession({ sessionId: "a" });

  const responses = await collect(context, {
    type: "agent.prompt.queue.requested",
    agentSessionId: "a",
    content: "hi",
  });

  expect(responses.map((response) => response.type)).toEqual([
    "agent.prompt.accepted",
    "agent.message.received",
  ]);
  expect(priorities).toEqual(["later"]);
});

test("cancel, approval and model requests reach the agent session", async () => {
  const context = await createDaemonContext(
    new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-"))),
  );
  const runtime = useScriptedAgents(context);
  context.agents.createSession({ sessionId: "a" });

  expect(
    await collect(context, { type: "agent.prompt.cancel.requested", agentSessionId: "a" }),
  ).toEqual([{ type: "agent.prompt.cancelled", agentSessionId: "a" }]);
  expect(
    await collect(context, {
      type: "agent.tool.approval.answered",
      agentSessionId: "a",
      toolUseId: "t1",
      decision: "approve_all",
    }),
  ).toEqual([]);
  expect(context.agents.requireSession("a").gate.approveAll).toBe(true);
  expect(
    await collect(context, {
      type: "agent.model.set.requested",
      agentSessionId: "a",
      model: "sonnet",
    }),
  ).toEqual([{ type: "agent.model.changed", model: "sonnet" }]);
  expect(runtime.queries[0]?.calls).toEqual(["interrupt", "setModel:sonnet"]);
});

test("restore request swaps in the stored session and replays its events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "claudin-"));
  const store = new FileSessionStore(directory);
  const stored = await startSession(store);
  await stored.dispatch({ type: "agent.session.created", agentSessionId: "a1" });
  const context = await createDaemonContext(store);

  const responses = [];
  const request = { type: "session.restore.requested", sessionId: stored.id } as const;
  for await (const response of handleRequest(context, request)) responses.push(response);

  expect(context.session.id).toBe(stored.id);
  expect(context.session.state.agentSessionId).toBe("a1");
  expect(responses).toMatchObject([{ type: "session.restored", sessionId: stored.id }]);
  expect(await store.read(stored.id)).toHaveLength(2);
});

test("a daemon context can start from a stored session", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const stored = await startSession(store);
  expect((await createDaemonContext(store, stored.id)).session.id).toBe(stored.id);
  await expect(createDaemonContext(store, "missing")).rejects.toThrow("Unknown session");
});

test("model cycle and command requests reach the agent session", async () => {
  const context = await createDaemonContext(
    new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-"))),
  );
  const runtime = useScriptedAgents(context);
  runtime.models = ["haiku", "sonnet"].map((value) => ({ value })) as ScriptedRuntime["models"];
  context.agents.createSession({ sessionId: "a", model: "haiku" });

  expect(
    await collect(context, { type: "agent.model.cycle.requested", agentSessionId: "a" }),
  ).toEqual([{ type: "agent.model.changed", model: "sonnet" }]);
  expect(runtime.queries[0]?.calls).toEqual(["setModel:sonnet"]);
  expect(await collect(context, { type: "agent.commands.requested", agentSessionId: "a" })).toEqual(
    [{ type: "agent.commands.received", commands: [] }],
  );
});

async function collect(
  context: Awaited<ReturnType<typeof createDaemonContext>>,
  request: RequestEvent,
) {
  const responses = [];
  for await (const response of handleRequest(context, request)) responses.push(response);
  return responses;
}

test("cd starts a fresh session in the new directory and closes agents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "claudin-"));
  const target = await realpath(await mkdtemp(join(tmpdir(), "claudin-cwd-")));
  await mkdir(join(target, "sub"));
  const context = await createDaemonContext(new FileSessionStore(directory));
  const runtime = useScriptedAgents(context);
  context.agents.createSession();
  const firstId = context.session.id;

  const responses = await collect(context, { type: "workspace.cwd.set.requested", path: target });
  expect(context.cwd).toBe(target);
  expect(context.session.id).not.toBe(firstId);
  expect(countClosed(runtime)).toBe(1);
  expect(responses).toMatchObject([
    { type: "session.created", sessionId: context.session.id },
    { type: "workspace.cwd.changed", cwd: target },
  ]);

  await collect(context, { type: "workspace.cwd.set.requested", path: "sub" });
  expect(context.cwd).toBe(join(target, "sub"));
});

test("cd rejects a path that is not a directory", async () => {
  const context = await createDaemonContext(
    new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-"))),
  );
  const before = context.cwd;
  await expect(
    collect(context, { type: "workspace.cwd.set.requested", path: "/definitely/not/here" }),
  ).rejects.toThrow("Not a directory");
  expect(context.cwd).toBe(before);
});

test("session list request returns the stored sessions", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const stored = await startSession(store);
  await stored.dispatch({ type: "agent.prompt.requested", agentSessionId: "a", content: "hello" });
  const context = await createDaemonContext(store);
  const [response] = await collect(context, { type: "session.list.requested" });
  expect(response).toMatchObject({
    type: "session.list.received",
    sessions: [{ id: stored.id, title: "hello" }],
  });
});

test("restoring a session also switches to its directory", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const target = await realpath(await mkdtemp(join(tmpdir(), "claudin-cwd-")));
  const stored = await startSession(store);
  await stored.dispatch({
    type: "workspace.info.received",
    cwd: target,
    gitBranch: "",
    gitStats: { additions: 0, deletions: 0 },
  });
  const context = await createDaemonContext(store);
  const runtime = useScriptedAgents(context);
  context.agents.createSession();

  await collect(context, { type: "session.restore.requested", sessionId: stored.id });
  expect(context.cwd).toBe(target);
  expect(countClosed(runtime)).toBe(1);
});

test("restoring fails when the session directory is gone", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const stored = await startSession(store);
  await stored.dispatch({
    type: "workspace.info.received",
    cwd: "/gone/dir",
    gitBranch: "",
    gitStats: { additions: 0, deletions: 0 },
  });
  const context = await createDaemonContext(store);
  await expect(
    collect(context, { type: "session.restore.requested", sessionId: stored.id }),
  ).rejects.toThrow("no longer exists");
});

test("agent sessions are created in the daemon working directory", async () => {
  const context = await createDaemonContext(
    new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-"))),
  );
  const runtime = useScriptedAgents(context);
  context.cwd = "/some/dir";
  const [created] = await collect(context, {
    type: "agent.session.create.requested",
    options: { model: "m" },
  });
  expect(created).toMatchObject({ type: "agent.session.created" });
  expect(runtime.queries[0]?.options).toMatchObject({ cwd: "/some/dir", model: "m" });
});
