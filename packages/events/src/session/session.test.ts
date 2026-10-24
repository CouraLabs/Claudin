import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { restoreSession, startSession } from "./session.ts";
import { FileSessionStore } from "./sessionStore.ts";

test("session persists events and holds state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kraude-"));
  const session = await startSession(new FileSessionStore(directory));
  await session.dispatch({ type: "agent.prompt.requested", agentSessionId: "a", content: "hi" });

  expect(session.state.prompts).toEqual(["hi"]);
  const lines = (await readFile(join(directory, `${session.id}.jsonl`), "utf8")).trim().split("\n");
  expect(lines).toHaveLength(2);
});

test("new sessions get distinct ids", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "kraude-")));
  const [first, second] = await Promise.all([startSession(store), startSession(store)]);
  expect(first.id).not.toBe(second.id);
});

test("a stored session restores its state without rewriting the log", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "kraude-")));
  const original = await startSession(store);
  await original.dispatch({ type: "agent.prompt.requested", agentSessionId: "a", content: "hi" });
  await original.dispatch({ type: "agent.session.created", agentSessionId: "a" });

  const { session, restored } = await restoreSession(store, original.id);
  expect(session.id).toBe(original.id);
  expect(session.state).toMatchObject({
    sessionId: original.id,
    agentSessionId: "a",
    status: "idle",
  });
  expect(session.state.prompts).toEqual(["hi"]);
  expect(restored.events).toHaveLength(3);
  expect(await store.read(original.id)).toHaveLength(3);
});

test("restoring an unknown session fails", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "kraude-")));
  await expect(restoreSession(store, "missing")).rejects.toThrow("Unknown session: missing");
});

test("listing summarises stored sessions with prompts, newest first", async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "kraude-")));
  const empty = await startSession(store);
  const older = await startSession(store);
  await older.dispatch({
    type: "workspace.info.received",
    cwd: "/a",
    gitBranch: "",
    gitStats: { additions: 0, deletions: 0 },
  });
  await older.dispatch({
    type: "agent.prompt.requested",
    agentSessionId: "x",
    content: "first\nprompt",
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const newer = await startSession(store);
  await newer.dispatch({
    type: "workspace.cwd.changed",
    cwd: "/b",
    gitBranch: "",
    gitStats: { additions: 0, deletions: 0 },
  });
  await newer.dispatch({ type: "agent.prompt.requested", agentSessionId: "y", content: "second" });

  const listed = await store.list();
  expect(listed.map((s) => s.id)).toEqual([newer.id, older.id]);
  expect(listed.map((s) => s.id)).not.toContain(empty.id);
  expect(listed[0]).toMatchObject({ title: "second", cwd: "/b" });
  expect(listed[1]).toMatchObject({ title: "first prompt", cwd: "/a" });
});

test("listing an empty store returns nothing", async () => {
  const store = new FileSessionStore(join(tmpdir(), "kraude-missing-dir"));
  expect(await store.list()).toEqual([]);
});
