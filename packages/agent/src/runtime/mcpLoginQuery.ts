import type { Query } from "@anthropic-ai/claude-agent-sdk";

export type McpLoginStart = {
  authUrl?: string;
  requiresUserAction?: boolean;
  callbackExpected?: boolean;
};

export type McpLoginQuery = {
  mcpAuthenticate(serverName: string): Promise<McpLoginStart>;
};

export type LoginCapableQuery = Query & McpLoginQuery;
