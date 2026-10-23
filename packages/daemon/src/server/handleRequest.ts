import type { RequestEvent, ResponseEvent } from "@claudin/events";
import { agentHandlers } from "../handlers/agentHandlers.ts";
import { optionsHandlers } from "../handlers/optionsHandlers.ts";
import { sessionHandlers } from "../handlers/sessionHandlers.ts";
import { workspaceHandlers } from "../handlers/workspaceHandlers.ts";
import type { DaemonContext } from "./daemonContext.ts";
import type { RequestHandler } from "./requestHandler.ts";

const handlers = { ...sessionHandlers, ...agentHandlers, ...workspaceHandlers, ...optionsHandlers };

const SESSION_SWITCH_TYPES = new Set<ResponseEvent["type"]>([
  "session.created",
  "session.restored",
  "session.forked",
]);

export async function* handleRequest(
  context: DaemonContext,
  request: RequestEvent,
): AsyncGenerator<ResponseEvent> {
  const origin = context.session;
  await origin.dispatch(request);
  const handler = handlers[request.type] as RequestHandler<RequestEvent["type"]>;
  for await (const response of handler(context, request)) {
    const target = SESSION_SWITCH_TYPES.has(response.type) ? context.session : origin;
    await target.dispatch(response);
    yield response;
  }
}
