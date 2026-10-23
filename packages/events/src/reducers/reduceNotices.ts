import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk";
import { readModelLabel } from "../models/modelLabel.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";

const LOGIN_HINT = "needs-auth: sign in with /mcp login <name>";

const describeServer = ({ name, status }: McpServerStatus): string =>
  `${name} (${status === "needs-auth" ? LOGIN_HINT.replace("<name>", name) : status})`;

export const describeServers = (servers: McpServerStatus[]): string =>
  servers.length === 0
    ? "No MCP servers configured"
    : `MCP servers: ${servers.map(describeServer).join(", ")}`;

export const describeLoginStarted = (serverName: string, authUrl: string): string =>
  `Signing in to ${serverName}. If the browser did not open, visit: ${authUrl}`;

export function reduceModelChanged(state: SessionState, model: string): SessionState {
  const changed = { ...state, model };
  return appendNotice(changed, `Model set to ${readModelLabel(changed)}`);
}

export const reduceEffortChanged = (state: SessionState, effort: string): SessionState =>
  appendNotice({ ...state, effort }, `Effort set to ${effort}`);

export const reduceModeChanged = (state: SessionState, mode: string): SessionState =>
  appendNotice({ ...state, permissionMode: mode }, `Permission mode: ${mode}`);
