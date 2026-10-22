import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentSessionManager, ScriptedRuntime } from "@claudin/agent";
import { FileSessionStore, type RequestEvent, startSession } from "@claudin/events";
import { expect, test } from "vitest";
import { createDaemonContext, type DaemonContext } from "../server/daemonContext.ts";
import { handleRequest } from "../server/handleRequest.ts";

async function collect(context: DaemonContext, request: RequestEvent) {
  const responses = [];
  for await (const response of handleRequest(context, request)) responses.push(response);
  return responses;
}

async function createContext() {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const context = await createDaemonContext(store);
  context.cwd = await mkdtemp(join(tmpdir(), "claudin-ws-"));
  return { store, context };
}

test("fork copies the session log into a new session and closes agents", async () => {
  const { store, context } = await createContext();
  const runtime = new ScriptedRuntime();
  context.agents = new AgentSessionManager(runtime);
  context.agents.createSession({ sessionId: "a1" });
  await context.session.dispatch({ type: "agent.session.created", agentSessionId: "a1" });
  const original = context.session.id;

  const [forked] = await collect(context, { type: "session.fork.requested" });

  expect(context.session.id).not.toBe(original);
  expect(forked).toMatchObject({ type: "session.forked", sessionId: context.session.id });
  expect(context.session.state.agentSessionId).toBe("a1");
  expect(runtime.queries[0]?.calls).toContain("close");
  const copied = (await store.read(context.session.id)).map(({ event }) => event.type);
  expect(copied).toContain("agent.session.created");
});

test("sync returns the live session events", async () => {
  const { context } = await createContext();
  await context.session.dispatch({ type: "agent.session.created", agentSessionId: "a1" });
  const [synced] = await collect(context, { type: "session.sync.requested" });
  expect(synced).toMatchObject({
    type: "session.synced",
    sessionId: context.session.id,
    agentLive: false,
  });
  const types = synced?.type === "session.synced" ? synced.events.map((s) => s.event.type) : [];
  expect(types).toContain("agent.session.created");
});

test("export writes the transcript as markdown inside the working directory", async () => {
  const { context } = await createContext();
  await context.session.dispatch({
    type: "agent.prompt.requested",
    agentSessionId: "a1",
    content: "Add login",
  });
  const [exported] = await collect(context, { type: "session.export.requested", path: "t.md" });
  const path = join(context.cwd, "t.md");
  expect(exported).toEqual({ type: "session.exported", path });
  expect(await readFile(path, "utf8")).toContain("## You\n\nAdd login");
});

test("search finds stored sessions by prompt text with a snippet", async () => {
  const { store, context } = await createContext();
  const stored = await startSession(store);
  await stored.dispatch({
    type: "agent.prompt.requested",
    agentSessionId: "x",
    content: "Fix the flaky payment webhook test",
  });
  const [found] = await collect(context, { type: "session.search.requested", query: "WEBHOOK" });
  expect(found).toMatchObject({
    type: "session.search.received",
    query: "WEBHOOK",
    sessions: [{ id: stored.id, title: "Fix the flaky payment webhook test" }],
  });
});
