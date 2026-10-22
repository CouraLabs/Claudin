import { once } from "node:events";
import { type ResponseEvent, requestEventSchema } from "@claudin/events";
import { type WebSocket, WebSocketServer } from "ws";
import { createDaemonContext, type DaemonContext } from "./daemonContext.ts";
import { handleRequest } from "./handleRequest.ts";

export const DEFAULT_PORT = 7777;

async function answerMessage(context: DaemonContext, socket: WebSocket, data: string) {
  const send = (response: ResponseEvent) => socket.send(JSON.stringify(response));
  try {
    const request = requestEventSchema.parse(JSON.parse(data));
    for await (const response of handleRequest(context, request)) send(response);
  } catch (error) {
    const failure: ResponseEvent = { type: "request.failed", reason: String(error) };
    await context.session.dispatch(failure);
    send(failure);
  }
}

export async function startDaemon(
  port = DEFAULT_PORT,
  context?: DaemonContext,
): Promise<WebSocketServer> {
  const daemonContext = context ?? (await createDaemonContext());
  const server = new WebSocketServer({ port });
  server.on("connection", (socket) => {
    socket.on("message", (data) => answerMessage(daemonContext, socket, data.toString()));
  });
  server.once("close", () => daemonContext.agents.closeAll());
  await once(server, "listening");
  return server;
}
