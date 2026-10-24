import type { RequestEvent, ResponseEvent } from "@kraude-kode/events";
import type { DaemonContext } from "./daemonContext.ts";

export type HandledRequest = Exclude<RequestEvent, { type: "daemon.status.requested" }>;

export type HandledRequestType = HandledRequest["type"];

export type RequestHandler<K extends HandledRequestType> = (
  context: DaemonContext,
  request: Extract<RequestEvent, { type: K }>,
) => AsyncIterable<ResponseEvent>;

export type RequestHandlers = { [K in HandledRequestType]: RequestHandler<K> };
