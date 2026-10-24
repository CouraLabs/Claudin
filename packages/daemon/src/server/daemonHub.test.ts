import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentSessionManager, ScriptedRuntime } from "@kraude-kode/agent";
import { FileSessionStore } from "@kraude-kode/events";
import { expect, test } from "vitest";
import type { WebSocket } from "ws";
import { createDaemonContext, type DaemonContext } from "./daemonContext.ts";
import { DaemonHub } from "./daemonHub.ts";

const fakeSocket = (): WebSocket => ({}) as WebSocket;

const buildHub = async () => {
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "kraude-")));
  const runtime = new ScriptedRuntime();
  const created: DaemonContext[] = [];
  const hub = new DaemonHub(async () => {
    const context = await createDaemonContext(store);
    context.agents = new AgentSessionManager(runtime);
    created.push(context);
    return context;
  });
  return { hub, created, runtime };
};

const closeCount = (runtime: ScriptedRuntime) =>
  runtime.queries.filter((query) => query.calls.includes("close")).length;

test("own-mode admissions create one context per socket", async () => {
  const { hub, created } = await buildHub();
  const first = fakeSocket();
  const second = fakeSocket();
  hub.admit(first, { runId: "r1", mode: "own" });
  hub.admit(second, { runId: "r2", mode: "own" });
  const firstContext = await hub.contextFor(first);
  const secondContext = await hub.contextFor(second);
  expect(created).toHaveLength(2);
  expect(firstContext).not.toBe(secondContext);
  expect(await hub.contextFor(first)).toBe(firstContext);
  expect(hub.clientIds()).toEqual(["r1", "r2"]);
  expect(hub.socketsOf(firstContext)).toEqual([first]);
});

test("attach-mode admissions share the oldest live context", async () => {
  const { hub, created } = await buildHub();
  const primary = fakeSocket();
  const partner = fakeSocket();
  const outsider = fakeSocket();
  hub.admit(primary, { runId: "r1", mode: "own" });
  const primaryContext = await hub.contextFor(primary);
  hub.admit(partner, { runId: "r2", mode: "attach" });
  hub.admit(outsider, { runId: "r3", mode: "own" });
  expect(await hub.contextFor(partner)).toBe(primaryContext);
  expect(await hub.contextFor(outsider)).not.toBe(primaryContext);
  expect(created).toHaveLength(2);
  expect(hub.socketsOf(primaryContext)).toEqual([primary, partner]);
});

test("releasing a socket closes agents only when it was the context's last client", async () => {
  const { hub, runtime } = await buildHub();
  const primary = fakeSocket();
  const partner = fakeSocket();
  hub.admit(primary, { runId: "r1", mode: "own" });
  const context = await hub.contextFor(primary);
  context.agents.createSession();
  hub.admit(partner, { runId: "r2", mode: "attach" });
  expect(await hub.contextFor(partner)).toBe(context);

  hub.release(partner);
  expect(closeCount(runtime)).toBe(0);
  hub.release(primary);
  expect(closeCount(runtime)).toBe(1);
  expect(hub.clientIds()).toEqual([]);
});

test("own admissions adopt the requested working directory", async () => {
  const { hub, created } = await buildHub();
  const target = await mkdtemp(join(tmpdir(), "kraude-cwd-"));
  const rejected = fakeSocket();
  const adopted = fakeSocket();
  hub.admit(rejected, { runId: "r1", mode: "own", cwd: "/definitely/not/here" });
  hub.admit(adopted, { runId: "r2", mode: "own", cwd: target });
  await hub.contextFor(rejected);
  await hub.contextFor(adopted);
  expect(created[0]!.cwd).not.toBe("/definitely/not/here");
  expect(created[1]!.cwd).toBe(target);
  expect(created).toHaveLength(2);
});

test("root context backs attach when no clients are connected", async () => {
  const { hub, created } = await buildHub();
  const root = await createDaemonContext(
    new FileSessionStore(await mkdtemp(join(tmpdir(), "kraude-"))),
  );
  hub.setRoot(root);
  const attach = fakeSocket();
  hub.admit(attach, { runId: "r1", mode: "attach" });
  expect(await hub.contextFor(attach)).toBe(root);
  expect(created).toHaveLength(0);
});

test("attach admitted before the primary context exists still binds to it", async () => {
  const { hub, created } = await buildHub();
  const primary = fakeSocket();
  const partner = fakeSocket();
  hub.admit(primary, { runId: "r1", mode: "own" });
  hub.admit(partner, { runId: "r2", mode: "attach" });
  const primaryContext = await hub.contextFor(primary);
  expect(await hub.contextFor(partner)).toBe(primaryContext);
  expect(created).toHaveLength(1);
});

test("attach without any live context creates a shared fallback", async () => {
  const { hub, created } = await buildHub();
  const first = fakeSocket();
  const second = fakeSocket();
  hub.admit(first, { runId: "r1", mode: "attach" });
  hub.admit(second, { runId: "r2", mode: "attach" });
  const [firstContext, secondContext] = await Promise.all([
    hub.contextFor(first),
    hub.contextFor(second),
  ]);
  expect(firstContext).toBe(secondContext);
  expect(created).toHaveLength(1);
  const third = fakeSocket();
  hub.admit(third, { runId: "r3", mode: "attach" });
  expect(await hub.contextFor(third)).toBe(firstContext);
  expect(created).toHaveLength(1);
});
