import {
  forkSession,
  getSessionInfo,
  getSessionMessages,
  type Options,
  type Query,
  query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

export type AgentQuery = Pick<
  Query,
  | "next"
  | "interrupt"
  | "setModel"
  | "setPermissionMode"
  | "applyFlagSettings"
  | "mcpServerStatus"
  | "supportedModels"
  | "supportedCommands"
  | "usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET"
  | "close"
>;

export type OpenQueryParams = { prompt: AsyncIterable<SDKUserMessage>; options: Options };

export type AgentRuntime = {
  open(params: OpenQueryParams): AgentQuery;
  getInfo: typeof getSessionInfo;
  getMessages: typeof getSessionMessages;
  fork: typeof forkSession;
};

export const sdkRuntime: AgentRuntime = {
  open: query,
  getInfo: getSessionInfo,
  getMessages: getSessionMessages,
  fork: forkSession,
};
