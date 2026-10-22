import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore } from "@claudin/events";
import { expect, test } from "vitest";
import { type AgentResponseEvent, DaemonClient } from "./daemonClient.ts";
import { createDaemonContext } from "../server/daemonContext.ts";
import { startDaemon } from "../server/startDaemon.ts";

test("client receives responses and failures from the daemon", async () => {
  const directory = await mkdtemp(join(tmpdir(), "claudin-"));
  const context = await createDaemonContext(new FileSessionStore(directory));
  const server = await startDaemon(0, context);
  const { port } = server.address() as { port: number };
  const client = await DaemonClient.connect(`ws://localhost:${port}`);

  const received: AgentResponseEvent[] = [];
  const done = new Promise<void>((resolve) => {
    client.subscribe((response) => {
      received.push(response);
      if (received.length === 2) resolve();
    });
  });
  client.send({ type: "session.create.requested" });
  client.send({ type: "agent.prompt.queue.requested", agentSessionId: "missing", content: "hi" });
  await done;

  expect(received.map((response) => response.type).sort()).toEqual([
    "request.failed",
    "session.created",
  ]);
  client.close();
  server.close();
});
