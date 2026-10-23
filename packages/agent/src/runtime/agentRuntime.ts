import {
  forkSession,
  getSessionInfo,
  getSessionMessages,
  type Options,
  type Query,
  query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { LoginCapableQuery, McpLoginQuery } from "./mcpLoginQuery.ts";
import { muteShadowedWarning } from "./muteShadowedWarning.ts";

export type AgentQuery = McpLoginQuery &
  Pick<
    Query,
    | "next"
    | "interrupt"
    | "stopTask"
    | "setModel"
    | "setPermissionMode"
    | "applyFlagSettings"
    | "mcpServerStatus"
    | "supportedModels"
    | "supportedCommands"
    | "usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET"
    | "rewindFiles"
    | "close"
  >;

export type OpenQueryParams = { prompt: AsyncIterable<SDKUserMessage>; options: Options };

export type AgentRuntime = {
  open(params: OpenQueryParams): AgentQuery;
  getInfo: typeof getSessionInfo;
  getMessages: typeof getSessionMessages;
  fork: typeof forkSession;
};

muteShadowedWarning();

export const sdkRuntime: AgentRuntime = {
  open: (params) => query(params) as LoginCapableQuery,
  getInfo: getSessionInfo,
  getMessages: getSessionMessages,
  fork: forkSession,
};
