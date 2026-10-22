import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk";
import { AGENT_MODE_LABELS, type AgentMode } from "../models/agentMode.ts";
import { appendNotice } from "./appendEntry.ts";
import { readModelLabel } from "../models/modelLabel.ts";
import type { SessionState } from "../session/sessionState.ts";

export const describeServers = (servers: McpServerStatus[]): string =>
  servers.length === 0
    ? "No MCP servers configured"
    : `MCP servers: ${servers.map((s) => `${s.name} (${s.status})`).join(", ")}`;

export function reduceModelChanged(state: SessionState, model: string): SessionState {
  const changed = { ...state, model };
  return appendNotice(changed, `Model set to ${readModelLabel(changed)}`);
}

export const reduceEffortChanged = (state: SessionState, effort: string): SessionState =>
  appendNotice({ ...state, effort }, `Effort set to ${effort}`);

export const reduceModeChanged = (state: SessionState, mode: string): SessionState =>
  appendNotice({ ...state, permissionMode: mode }, `Permission mode: ${mode}`);

export const reduceAgentModeChanged = (state: SessionState, mode: AgentMode): SessionState =>
  appendNotice({ ...state, agentMode: mode }, `Agent mode: ${AGENT_MODE_LABELS[mode]}`);
