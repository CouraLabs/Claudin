import { z } from "zod";

export const sessionRequestSchemas = [
  z.object({ type: z.literal("session.create.requested") }),
  z.object({ type: z.literal("session.restore.requested"), sessionId: z.string() }),
  z.object({ type: z.literal("session.list.requested") }),
] as const;
