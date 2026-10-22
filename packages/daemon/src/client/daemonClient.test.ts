import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore } from "@claudin/events";
import { afterEach, expect, test } from "vitest";
import type { WebSocketServer } from "ws";
import { createDaemonContext } from "../server/daemonContext.ts";
import { startDaemon } from "../server/startDaemon.ts";
import { DaemonClient, type DaemonEvent } from "./daemonClient.ts";

type Received = { type: string; peer: boolean };

let server: WebSocketServer | undefined;
const clients: DaemonClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  server?.close();
});

async function startServer() {
  const directory = await mkdtemp(join(tmpdir(), "claudin-"));
  server = await startDaemon(0, await createDaemonContext(new FileSessionStore(directory)));
  return (server.address() as { port: number }).port;
}

async function connect(port: number) {
  const client = await DaemonClient.connect(`ws://localhost:${port}`);
  clients.push(client);
  const received: Received[] = [];
  client.subscribe((event: DaemonEvent, peer) => received.push({ type: event.type, peer }));
  return { client, received };
}

const waitFor = async (check: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !check(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

test("client receives responses and failures from the daemon", async () => {
  const { client, received } = await connect(await startServer());
  client.send({ type: "session.create.requested" });
  client.send({ type: "agent.prompt.queue.requested", agentSessionId: "missing", content: "hi" });
  await waitFor(() => received.length === 2);
  expect(received.map(({ type }) => type).sort()).toEqual(["request.failed", "session.created"]);
  expect(received.every(({ peer }) => !peer)).toBe(true);
});

test("shared events reach attached peers while private ones stay with the origin", async () => {
  const port = await startServer();
  const origin = await connect(port);
  const peer = await connect(port);
  origin.client.send({ type: "session.list.requested" });
  origin.client.send({ type: "session.create.requested" });
  await waitFor(() => peer.received.length === 2 && origin.received.length === 2);
  expect(peer.received).toEqual([
    { type: "session.create.requested", peer: true },
    { type: "session.created", peer: true },
  ]);
  expect(origin.received).toEqual([
    { type: "session.list.received", peer: false },
    { type: "session.created", peer: false },
  ]);
});
