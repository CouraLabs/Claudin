import { z } from "zod";
import { requestEventSchema } from "../requests/requestEvents.ts";
import { responseEventSchema } from "../responses/responseEvents.ts";
import type { AppEvent } from "./appEvent.ts";

const PRIVATE_TYPES = new Set<string>([
  "session.list.requested",
  "session.list.received",
  "session.search.requested",
  "session.search.received",
  "session.sync.requested",
  "session.synced",
  "session.export.requested",
  "session.exported",
  "workspace.info.requested",
  "workspace.files.requested",
  "workspace.files.received",
  "workspace.diff.requested",
  "workspace.diff.received",
  "agent.session.info.requested",
  "agent.session.info.received",
  "agent.session.messages.requested",
  "agent.session.messages.received",
  "agent.models.requested",
  "agent.models.received",
  "agent.commands.requested",
  "agent.mcp.status.requested",
  "agent.mcp.status.received",
  "agent.usage.requested",
  "agent.usage.received",
  "agent.rate_limit.requested",
  "agent.rate_limit.cached.requested",
  "options.load.requested",
  "options.loaded",
  "request.failed",
]);

export const isSharedEvent = (event: AppEvent): boolean => !PRIVATE_TYPES.has(event.type);

export const daemonMessageSchema = z.object({
  event: z.union([requestEventSchema, responseEventSchema]),
  peer: z.boolean(),
});

export type DaemonMessage = { event: AppEvent; peer: boolean };
