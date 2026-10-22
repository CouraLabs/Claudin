import { z } from "zod";

export const agentModeSchema = z.enum(["ask", "plan", "build"]);

export type AgentMode = z.infer<typeof agentModeSchema>;

export const DEFAULT_AGENT_MODE: AgentMode = "build";

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  ask: "Ask",
  plan: "Plan",
  build: "Build",
};
