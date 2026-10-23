import { once } from "node:events";
import { type ResponseEvent, requestEventSchema } from "@claudin/events";
import { type WebSocket, WebSocketServer } from "ws";
import { checkConnection, readRunId } from "../auth/checkConnection.ts";
import { createDaemonContext, type DaemonContext } from "./daemonContext.ts";
import { handleRequest } from "./handleRequest.ts";
import { publishEvent } from "./publishEvent.ts";

export const DEFAULT_PORT = 7777;

const LOOPBACK_HOST = "127.0.0.1";

async function reportFailure(
  context: DaemonContext,
  server: WebSocketServer,
  socket: WebSocket,
  error: unknown,
) {
  const failure: ResponseEvent = { type: "request.failed", reason: String(error) };
  await context.session.dispatch(failure).catch(() => {});
  publishEvent(server.clients, socket, failure);
}

async function answerMessage(
  context: DaemonContext,
  server: WebSocketServer,
  socket: WebSocket,
  data: string,
) {
  try {
    const request = requestEventSchema.parse(JSON.parse(data));
    publishEvent(server.clients, socket, request, false);
    for await (const response of handleRequest(context, request)) {
      publishEvent(server.clients, socket, response);
    }
  } catch (error) {
    await reportFailure(context, server, socket, error);
  }
}

export async function startDaemon(
  port: number,
  token: string,
  context?: DaemonContext,
): Promise<WebSocketServer> {
  const daemonContext = context ?? (await createDaemonContext());
  const liveRunIds = new Set<string>();
  const server = new WebSocketServer({
    port,
    host: LOOPBACK_HOST,
    verifyClient: ({ req }, respond) => {
      const rejection = checkConnection(req, token, liveRunIds);
      if (rejection) respond(false, rejection.status, rejection.reason);
      else respond(true);
    },
  });
  server.on("connection", (socket, request) => {
    const runId = readRunId(request) ?? "";
    liveRunIds.add(runId);
    socket.once("close", () => liveRunIds.delete(runId));
    socket.on("message", (data) => answerMessage(daemonContext, server, socket, data.toString()));
  });
  server.once("close", () => daemonContext.agents.closeAll());
  await once(server, "listening");
  return server;
}
