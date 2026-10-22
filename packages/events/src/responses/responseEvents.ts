import { z } from "zod";
import { agentResponseSchemas } from "./agentResponseEvents.ts";
import { optionsResponseSchemas } from "../requests/optionsEvents.ts";
import type { SessionSummary, StoredEvent } from "../session/sessionSummary.ts";
import { workspaceResponseSchemas } from "../requests/workspaceEvents.ts";

export const responseEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.created"), sessionId: z.string() }),
  z.object({
    type: z.literal("session.restored"),
    sessionId: z.string(),
    events: z.custom<StoredEvent[]>(),
  }),
  z.object({
    type: z.literal("session.list.received"),
    sessions: z.custom<SessionSummary[]>(),
  }),
  z.object({ type: z.literal("request.failed"), reason: z.string() }),
  ...agentResponseSchemas,
  ...workspaceResponseSchemas,
  ...optionsResponseSchemas,
]);

type ParsedResponseEvent = z.infer<typeof responseEventSchema>;
type MessageEvent = Extract<ParsedResponseEvent, { type: "agent.message.received" }>;

export type ResponseEvent<T = unknown> =
  | Exclude<ParsedResponseEvent, MessageEvent>
  | (Omit<MessageEvent, "message"> & { message: T });
