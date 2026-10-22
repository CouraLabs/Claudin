import type { RequestEvent, ResponseEvent } from "@claudin/events";
import type { DaemonContext } from "./daemonContext.ts";

export type RequestHandler<K extends RequestEvent["type"]> = (
  context: DaemonContext,
  request: Extract<RequestEvent, { type: K }>,
) => AsyncIterable<ResponseEvent>;

export type RequestHandlers = { [K in RequestEvent["type"]]: RequestHandler<K> };
