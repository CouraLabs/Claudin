import { z } from "zod";

export const daemonRequestSchemas = [
  z.object({ type: z.literal("daemon.status.requested") }),
] as const;

export const daemonResponseSchemas = [
  z.object({
    type: z.literal("daemon.status.received"),
    clients: z.array(z.string()),
    pid: z.number(),
  }),
] as const;
