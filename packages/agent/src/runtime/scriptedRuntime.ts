import type {
  McpServerStatus,
  ModelInfo,
  Options,
  SDKControlGetUsageResponse,
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { pushable } from "it-pushable";
import type { AgentQuery, AgentRuntime, OpenQueryParams } from "./agentRuntime.ts";

export type ScriptedTurn = (
  input: SDKUserMessage,
  options: Options,
) => AsyncIterable<SDKMessage> | Iterable<SDKMessage>;

export const RESULT_MESSAGE = {
  type: "result",
  subtype: "success",
  is_error: false,
  duration_ms: 1,
  total_cost_usd: 0,
} as unknown as SDKMessage;

const EMPTY_USAGE: SDKControlGetUsageResponse = {
  session: {
    total_cost_usd: 0,
    total_api_duration_ms: 0,
    total_duration_ms: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
    model_usage: {},
  },
  subscription_type: null,
  rate_limits_available: false,
  rate_limits: null,
  behaviors: null,
};

export class ScriptedQuery implements AgentQuery {
  readonly calls: string[] = [];
  readonly serverStatuses: McpServerStatus[][] = [];
  loginUrl?: string;
  private output = pushable<SDKMessage>({ objectMode: true });

  constructor(
    prompt: AsyncIterable<SDKUserMessage>,
    readonly options: Options,
    private turn: ScriptedTurn,
    private models: ModelInfo[] = [],
  ) {
    void this.consume(prompt);
  }

  next() {
    return this.output.next();
  }

  async interrupt() {
    this.calls.push("interrupt");
    return undefined;
  }

  async setModel(model?: string) {
    this.calls.push(`setModel:${model}`);
  }

  async setPermissionMode(mode: string) {
    this.calls.push(`setPermissionMode:${mode}`);
  }

  async applyFlagSettings(settings: Record<string, unknown>) {
    this.calls.push(`applyFlagSettings:${JSON.stringify(settings)}`);
  }

  async mcpServerStatus() {
    return this.serverStatuses.shift() ?? [];
  }

  async mcpAuthenticate(serverName: string) {
    this.calls.push(`mcpAuthenticate:${serverName}`);
    return { authUrl: this.loginUrl ?? `https://auth.example/${serverName}` };
  }

  async supportedModels() {
    return this.models;
  }

  async supportedCommands() {
    return [];
  }

  async usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET() {
    return EMPTY_USAGE;
  }

  async rewindFiles(userMessageId: string, options?: { dryRun?: boolean }) {
    this.calls.push(`rewindFiles:${userMessageId}${options?.dryRun ? ":dry" : ""}`);
    return { canRewind: true, filesChanged: ["a.ts"], insertions: 1, deletions: 2 };
  }

  close() {
    this.calls.push("close");
    this.output.end();
  }

  private async consume(prompt: AsyncIterable<SDKUserMessage>) {
    for await (const input of prompt) {
      for await (const message of this.turn(input, this.options)) this.output.push(message);
    }
  }
}

export class ScriptedRuntime implements AgentRuntime {
  readonly queries: ScriptedQuery[] = [];
  readonly knownSessions = new Set<string>();
  models: ModelInfo[] = [];

  constructor(private turn: ScriptedTurn = () => [RESULT_MESSAGE]) {}

  open = ({ prompt, options }: OpenQueryParams) => {
    const scripted = new ScriptedQuery(prompt, options, this.turn, this.models);
    this.queries.push(scripted);
    return scripted;
  };

  getInfo = (async (sessionId: string) =>
    this.knownSessions.has(sessionId) ? { sessionId } : undefined) as AgentRuntime["getInfo"];

  getMessages = (async () => []) as AgentRuntime["getMessages"];

  fork = (async (sessionId: string) => ({
    sessionId: `${sessionId}-fork`,
  })) as AgentRuntime["fork"];
}
