import { z } from "zod";
import { agentRequestSchemas } from "./agentRequestEvents.ts";
import { daemonRequestSchemas } from "./daemonEvents.ts";
import { optionsRequestSchemas } from "./optionsEvents.ts";
import { sessionRequestSchemas } from "./sessionRequestEvents.ts";
import { workspaceRequestSchemas } from "./workspaceEvents.ts";

export const requestEventSchema = z.discriminatedUnion("type", [
  ...daemonRequestSchemas,
  ...sessionRequestSchemas,
  ...agentRequestSchemas,
  ...workspaceRequestSchemas,
  ...optionsRequestSchemas,
]);

export type RequestEvent = z.infer<typeof requestEventSchema>;
