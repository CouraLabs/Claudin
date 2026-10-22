import type { RequestEvent, ResponseEvent } from "@claudin/events";
import { agentHandlers } from "../handlers/agentHandlers.ts";
import type { DaemonContext } from "./daemonContext.ts";
import { optionsHandlers } from "../handlers/optionsHandlers.ts";
import type { RequestHandler } from "./requestHandler.ts";
import { sessionHandlers } from "../handlers/sessionHandlers.ts";
import { workspaceHandlers } from "../handlers/workspaceHandlers.ts";

const handlers = { ...sessionHandlers, ...agentHandlers, ...workspaceHandlers, ...optionsHandlers };

export async function* handleRequest(
  context: DaemonContext,
  request: RequestEvent,
): AsyncGenerator<ResponseEvent> {
  await context.session.dispatch(request);
  const handler = handlers[request.type] as RequestHandler<RequestEvent["type"]>;
  for await (const response of handler(context, request)) {
    await context.session.dispatch(response);
    yield response;
  }
}
