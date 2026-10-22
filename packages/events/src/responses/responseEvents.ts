import { z } from "zod";
import { optionsResponseSchemas } from "../requests/optionsEvents.ts";
import { workspaceResponseSchemas } from "../requests/workspaceEvents.ts";
import type { SessionSummary, StoredEvent } from "../session/sessionSummary.ts";
import { agentResponseSchemas } from "./agentResponseEvents.ts";

export const responseEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.created"), sessionId: z.string() }),
  z.object({
    type: z.literal("session.restored"),
    sessionId: z.string(),
    events: z.custom<StoredEvent[]>(),
  }),
  z.object({
    type: z.literal("session.forked"),
    sessionId: z.string(),
    events: z.custom<StoredEvent[]>(),
  }),
  z.object({
    type: z.literal("session.synced"),
    sessionId: z.string(),
    events: z.custom<StoredEvent[]>(),
    agentLive: z.boolean(),
  }),
  z.object({
    type: z.literal("session.list.received"),
    sessions: z.custom<SessionSummary[]>(),
  }),
  z.object({
    type: z.literal("session.search.received"),
    query: z.string(),
    sessions: z.custom<SessionSummary[]>(),
  }),
  z.object({ type: z.literal("session.exported"), path: z.string() }),
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
