import { once } from "node:events";
import { type DaemonMessage, type ResponseEvent, requestEventSchema } from "@kraude-kode/events";
import { type WebSocket, WebSocketServer } from "ws";
import { checkConnection, readRunId } from "../auth/checkConnection.ts";
import { createDaemonContext, type DaemonContext } from "./daemonContext.ts";
import type { ConnectionMode } from "./daemonHub.ts";
import { DaemonHub } from "./daemonHub.ts";
import { handleRequest } from "./handleRequest.ts";
import { publishEvent } from "./publishEvent.ts";
import type { HandledRequest } from "./requestHandler.ts";
import { readRequestParam } from "./requestParams.ts";

export const DEFAULT_PORT = 7777;

const LOOPBACK_HOST = "127.0.0.1";

const readMode = (request: { url?: string }): ConnectionMode =>
  readRequestParam(request, "mode") === "attach" ? "attach" : "own";

async function reportFailure(
  context: DaemonContext | undefined,
  origin: WebSocket,
  error: unknown,
) {
  const failure: ResponseEvent = { type: "request.failed", reason: String(error) };
  if (context) await context.session.dispatch(failure).catch(() => {});
  publishEvent([origin], origin, failure);
}

async function answerStatus(hub: DaemonHub, origin: WebSocket): Promise<void> {
  const status: ResponseEvent = {
    type: "daemon.status.received",
    clients: hub.clientIds(),
    pid: process.pid,
  };
  publishEvent([origin], origin, status);
}

async function streamResponses(
  hub: DaemonHub,
  socket: WebSocket,
  context: DaemonContext,
  request: HandledRequest,
): Promise<void> {
  try {
    for await (const response of handleRequest(context, request)) {
      publishEvent(hub.socketsOf(context), socket, response);
    }
  } catch (error) {
    await reportFailure(context, socket, error);
  }
}

async function acceptMessage(hub: DaemonHub, socket: WebSocket, data: string): Promise<void> {
  try {
    const request = requestEventSchema.parse(JSON.parse(data));
    if (request.type === "daemon.status.requested") return answerStatus(hub, socket);
    const context = await hub.contextFor(socket);
    publishEvent(hub.socketsOf(context), socket, request, false);
    void streamResponses(hub, socket, context, request);
  } catch (error) {
    await reportFailure(await maybeContext(hub, socket), socket, error);
  }
}

const maybeContext = async (
  hub: DaemonHub,
  socket: WebSocket,
): Promise<DaemonContext | undefined> => {
  try {
    return await hub.contextFor(socket);
  } catch {
    return undefined;
  }
};

export async function startDaemon(
  port: number,
  token: string,
  hub: DaemonHub = new DaemonHub(() => createDaemonContext()),
): Promise<WebSocketServer> {
  const server = new WebSocketServer({
    port,
    host: LOOPBACK_HOST,
    verifyClient: ({ req }, respond) => {
      const rejection = checkConnection(req, token, new Set(hub.clientIds()));
      if (rejection) respond(false, rejection.status, rejection.reason);
      else respond(true);
    },
  });
  const failure = new Promise<never>((_, reject) => server.once("error", reject));
  server.on("connection", (socket, request) => {
    const runId = readRunId(request) ?? "";
    hub.admit(socket, {
      runId,
      mode: readMode(request),
      cwd: readRequestParam(request, "cwd"),
    });
    let accepting = Promise.resolve();
    socket.on("message", (data) => {
      accepting = accepting.then(() => acceptMessage(hub, socket, data.toString())).catch(() => {});
    });
    socket.once("close", () => hub.release(socket));
  });
  server.once("close", () => hub.closeAllAgents());
  await Promise.race([once(server, "listening"), failure]);
  server.on("error", () => {});
  return server;
}
