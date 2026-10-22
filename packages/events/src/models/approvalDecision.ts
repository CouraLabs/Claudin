import type { z } from "zod";
import type { approvalDecisionSchema } from "../requests/agentRequestEvents.ts";

export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
