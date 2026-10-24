import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentSessionManager,
  RESULT_MESSAGE,
  ScriptedRuntime,
  type ScriptedTurn,
} from "@kraude-kode/agent";
import { FileSessionStore } from "@kraude-kode/events";
import { afterEach, expect, test } from "vitest";
import type { WebSocketServer } from "ws";
import { createRunId } from "../auth/connectionCredentials.ts";
import { createDaemonContext } from "../server/daemonContext.ts";
import { DaemonHub } from "../server/daemonHub.ts";
import { startDaemon } from "../server/startDaemon.ts";
import { DaemonClient, type DaemonEvent } from "./daemonClient.ts";

const TOKEN = "test-token";

type Received = { event: DaemonEvent; peer: boolean };

let server: WebSocketServer | undefined;
const clients: DaemonClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  server?.close();
});

async function startServer() {
  const directory = await mkdtemp(join(tmpdir(), "kraude-"));
  const hub = new DaemonHub(() => createDaemonContext(new FileSessionStore(directory)));
  server = await startDaemon(0, TOKEN, hub);
  return (server.address() as { port: number }).port;
}

async function connect(port: number, mode: "own" | "attach" = "own") {
  const client = await DaemonClient.connect(`ws://127.0.0.1:${port}`, {
    token: TOKEN,
    runId: createRunId(),
    mode,
  });
  clients.push(client);
  const received: Received[] = [];
  client.subscribe((event: DaemonEvent, peer) => received.push({ event, peer }));
  return { client, received };
}

const waitFor = async (check: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !check(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const note = (text: string) => ({ type: "system", subtype: "note", text }) as never;

const askApproval: ScriptedTurn = async function* (_input, options) {
  const verdict = await options.canUseTool?.("Bash", { command: "ls" }, {
    signal: new AbortController().signal,
    toolUseID: "t1",
  } as never);
  yield note(`verdict:${verdict?.behavior}`);
  yield RESULT_MESSAGE;
};

const isMessage = (event: DaemonEvent, type: string): boolean =>
  event.type === "agent.message.received" &&
  ((event as { message?: { type?: string } }).message?.type ?? "") === type;

const systemNotes = (received: Received[]): (string | undefined)[] =>
  received
    .filter(({ event }) => isMessage(event, "system"))
    .map(({ event }) => (event as { message?: { text?: string } }).message?.text);

test("client receives responses and failures from the daemon", async () => {
  const { client, received } = await connect(await startServer());
  client.send({ type: "session.create.requested" });
  client.send({ type: "agent.prompt.requested", agentSessionId: "missing", content: "hi" });
  await waitFor(() => received.length === 2);
  expect(received.map(({ event }) => event.type).sort()).toEqual([
    "request.failed",
    "session.created",
  ]);
  expect(received.every(({ peer }) => !peer)).toBe(true);
});

test("own-mode clients get isolated sessions on one daemon", async () => {
  const port = await startServer();
  const first = await connect(port);
  const second = await connect(port);
  first.client.send({ type: "session.create.requested" });
  second.client.send({ type: "session.create.requested" });
  await waitFor(() => first.received.length === 1 && second.received.length === 1);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(first.received.map(({ event }) => event.type)).toEqual(["session.created"]);
  expect(second.received.map(({ event }) => event.type)).toEqual(["session.created"]);
  expect(first.received.every(({ peer }) => !peer)).toBe(true);
  expect(second.received.every(({ peer }) => !peer)).toBe(true);
  const sessionId = (event: DaemonEvent): string => (event as { sessionId: string }).sessionId;
  expect(sessionId(first.received[0]!.event)).not.toBe(sessionId(second.received[0]!.event));
});

test("shared events reach attached peers while private ones stay with the origin", async () => {
  const port = await startServer();
  const origin = await connect(port);
  origin.client.send({ type: "session.list.requested" });
  await waitFor(() => origin.received.length === 1);
  const peer = await connect(port, "attach");
  origin.client.send({ type: "session.create.requested" });
  await waitFor(() => peer.received.length === 2 && origin.received.length === 2);
  expect(peer.received.map(({ event, peer }) => ({ type: event.type, peer }))).toEqual([
    { type: "session.create.requested", peer: true },
    { type: "session.created", peer: true },
  ]);
  expect(origin.received).toHaveLength(2);
  expect(origin.received.map(({ event, peer }) => ({ type: event.type, peer }))).toEqual(
    expect.arrayContaining([
      { type: "session.list.received", peer: false },
      { type: "session.created", peer: false },
    ]),
  );
});

test("status request reports connected clients and stays private", async () => {
  const port = await startServer();
  const first = await connect(port);
  const second = await connect(port);
  first.client.send({ type: "daemon.status.requested" });
  await waitFor(() => first.received.length === 1);
  expect(second.received).toEqual([]);
  expect(first.received.map(({ event }) => event.type)).toEqual(["daemon.status.received"]);
  expect(first.received[0]!.peer).toBe(false);
  const reported = first.received[0]!.event as { clients: string[]; pid: number };
  expect(reported.clients).toHaveLength(2);
  expect(reported.pid).toBeGreaterThan(0);
});

test("same-socket approval unblocks a prompt paused mid-turn", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kraude-"));
  const hub = new DaemonHub(async () => {
    const context = await createDaemonContext(new FileSessionStore(directory));
    context.agents = new AgentSessionManager(new ScriptedRuntime(askApproval));
    return context;
  });
  server = await startDaemon(0, TOKEN, hub);
  const { client, received } = await connect((server.address() as { port: number }).port);

  client.send({ type: "agent.session.create.requested" });
  await waitFor(() => received.some(({ event }) => event.type === "agent.session.created"));
  const created = received.find(({ event }) => event.type === "agent.session.created")!.event as {
    agentSessionId: string;
  };

  client.send({
    type: "agent.prompt.requested",
    agentSessionId: created.agentSessionId,
    content: "run it",
  });
  await waitFor(() => received.some(({ event }) => event.type === "agent.tool.approval.required"));
  expect(received.some(({ event }) => event.type === "agent.tool.approval.required")).toBe(true);

  client.send({
    type: "agent.tool.approval.answered",
    agentSessionId: created.agentSessionId,
    toolUseId: "t1",
    decision: "approve",
  });
  await waitFor(() => received.some(({ event }) => isMessage(event, "result")));
  expect(received.some(({ event }) => isMessage(event, "result"))).toBe(true);
  expect(systemNotes(received)).toContain("verdict:allow");
});

const rejectionOf = (port: number, query: string) =>
  new Promise<string>((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/?${query}`);
    socket.addEventListener("open", () => resolve("opened"));
    socket.addEventListener("error", () => resolve("rejected"));
  });

test("daemon refuses missing or wrong tokens and duplicate run ids", async () => {
  const port = await startServer();
  expect(await rejectionOf(port, "runId=a")).toBe("rejected");
  expect(await rejectionOf(port, `token=wrong&runId=a`)).toBe("rejected");
  expect(await rejectionOf(port, `token=${TOKEN}`)).toBe("rejected");
  const first = await DaemonClient.connect(`ws://127.0.0.1:${port}`, {
    token: TOKEN,
    runId: "same",
  });
  clients.push(first);
  expect(await rejectionOf(port, `token=${TOKEN}&runId=same`)).toBe("rejected");
});
