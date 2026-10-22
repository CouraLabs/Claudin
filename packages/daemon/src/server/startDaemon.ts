import { once } from "node:events";
import { type ResponseEvent, requestEventSchema } from "@claudin/events";
import { type WebSocket, WebSocketServer } from "ws";
import { createDaemonContext, type DaemonContext } from "./daemonContext.ts";
import { handleRequest } from "./handleRequest.ts";
import { publishEvent } from "./publishEvent.ts";

export const DEFAULT_PORT = 7777;

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
    const failure: ResponseEvent = { type: "request.failed", reason: String(error) };
    await context.session.dispatch(failure);
    publishEvent(server.clients, socket, failure);
  }
}

export async function startDaemon(
  port = DEFAULT_PORT,
  context?: DaemonContext,
): Promise<WebSocketServer> {
  const daemonContext = context ?? (await createDaemonContext());
  const server = new WebSocketServer({ port });
  server.on("connection", (socket) => {
    socket.on("message", (data) => answerMessage(daemonContext, server, socket, data.toString()));
  });
  server.once("close", () => daemonContext.agents.closeAll());
  await once(server, "listening");
  return server;
}
