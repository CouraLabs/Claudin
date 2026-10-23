import type {
  EffortLevel,
  McpServerStatus,
  ModelInfo,
  Options,
  PermissionMode,
  RewindFilesResult,
  SDKUserMessage,
  SlashCommand,
} from "@anthropic-ai/claude-agent-sdk";
import type { ApprovalDecision, PromptContent, ResponseEvent } from "@claudin/events";
import { type Pushable, pushable } from "it-pushable";
import { type WaitForLoginOptions, waitForMcpLogin } from "../mcp/waitForMcpLogin.ts";
import { ElicitationGate } from "../permissions/elicitationGate.ts";
import { PermissionGate } from "../permissions/permissionGate.ts";
import { AGENT_PROFILE_OPTIONS } from "../profile/agentProfile.ts";
import type { AgentQuery, AgentRuntime } from "../runtime/agentRuntime.ts";
import { buildUserMessage, type PromptPriority } from "../runtime/buildUserMessage.ts";
import { readBackgroundTaskCount } from "./readBackgroundTaskCount.ts";

type TurnEvent = ResponseEvent;

function requireRewind(result: RewindFilesResult): RewindFilesResult {
  if (!result.canRewind) throw new Error(result.error ?? "Cannot rewind to this checkpoint");
  return result;
}

export class AgentSession {
  readonly input = pushable<SDKUserMessage>({ objectMode: true });
  readonly gate: PermissionGate;
  readonly elicitations: ElicitationGate;
  readonly query: AgentQuery;
  pendingTurns = 0;
  backgroundTaskCount = 0;
  pumping = false;

  constructor(
    agentSessionId: string,
    private baseOptions: Options,
    runtime: AgentRuntime,
  ) {
    this.gate = new PermissionGate(agentSessionId);
    this.elicitations = new ElicitationGate(agentSessionId);
    this.query = runtime.open({
      prompt: this.input,
      options: {
        ...baseOptions,
        ...AGENT_PROFILE_OPTIONS,
        canUseTool: this.gate.canUseTool,
        onElicitation: this.elicitations.handle,
      },
    });
  }

  prompt(content: PromptContent, priority?: PromptPriority): AsyncGenerator<TurnEvent> {
    this.send(content, priority);
    return this.streamTurn();
  }

  send(content: PromptContent, priority?: PromptPriority): void {
    this.pendingTurns += 1;
    this.input.push(buildUserMessage(content, priority));
  }

  async *streamTurn(): AsyncGenerator<TurnEvent> {
    if (this.pumping) return;
    this.pumping = true;
    const sink = pushable<TurnEvent>({ objectMode: true });
    this.listenGates((event) => sink.push(event));
    this.pumpMessages(sink);
    try {
      yield* sink;
    } finally {
      this.pumping = false;
      this.listenGates(() => {});
    }
  }

  answerApproval(toolUseId: string, decision: ApprovalDecision): void {
    this.gate.answerApproval(toolUseId, decision);
  }

  answerQuestion(toolUseId: string, answers: Record<string, string>): void {
    if (!this.elicitations.answer(toolUseId, answers)) this.gate.answerQuestion(toolUseId, answers);
  }

  async cancel(): Promise<void> {
    this.rejectAllPrompts();
    await this.query.interrupt();
  }

  async setModel(model: string): Promise<void> {
    await this.query.setModel(model);
    this.baseOptions = { ...this.baseOptions, model };
  }

  setPermissionMode(mode: PermissionMode): Promise<void> {
    return this.query.setPermissionMode(mode);
  }

  setEffort(effort: EffortLevel): Promise<void> {
    return this.query.applyFlagSettings({ effortLevel: effort });
  }

  fetchMcpStatus(): Promise<McpServerStatus[]> {
    return this.query.mcpServerStatus();
  }

  async startMcpLogin(serverName: string): Promise<string> {
    if (typeof this.query.mcpAuthenticate !== "function") {
      throw new Error("This Claude Agent SDK version does not support MCP login");
    }
    const { authUrl } = await this.query.mcpAuthenticate(serverName);
    if (!authUrl) throw new Error(`MCP server ${serverName} did not offer a login`);
    if (!/^https?:$/.test(new URL(authUrl).protocol)) {
      throw new Error(`MCP server ${serverName} offered an unsafe login link`);
    }
    return authUrl;
  }

  async submitMcpCallback(serverName: string, callbackUrl: string): Promise<void> {
    if (!/^https?:$/.test(new URL(callbackUrl).protocol)) {
      throw new Error("The callback must be an http(s) link");
    }
    await this.query.mcpSubmitOAuthCallbackUrl(serverName, callbackUrl);
  }

  awaitMcpLogin(serverName: string, wait?: WaitForLoginOptions): Promise<McpServerStatus[]> {
    return waitForMcpLogin(() => this.fetchMcpStatus(), serverName, wait);
  }

  fetchModels(): Promise<ModelInfo[]> {
    return this.query.supportedModels();
  }

  fetchCommands(): Promise<SlashCommand[]> {
    return this.query.supportedCommands();
  }

  async rewindFiles(userMessageId: string): Promise<RewindFilesResult> {
    const preview = requireRewind(await this.query.rewindFiles(userMessageId, { dryRun: true }));
    requireRewind(await this.query.rewindFiles(userMessageId));
    return preview;
  }

  fetchUsage() {
    return this.query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({
      skipBehaviors: true,
    });
  }

  close(): void {
    this.rejectAllPrompts();
    this.input.end();
    this.query.close();
  }

  private listenGates(emit: (event: TurnEvent) => void): void {
    this.gate.listen(emit);
    this.elicitations.listen(emit);
  }

  private rejectAllPrompts(): void {
    this.gate.rejectAll();
    this.elicitations.rejectAll();
  }

  async pumpMessages(sink: Pushable<TurnEvent>): Promise<void> {
    try {
      while (true) {
        const { done, value } = await this.query.next();
        if (done) break;
        sink.push({ type: "agent.message.received", message: value });
        this.backgroundTaskCount = readBackgroundTaskCount(value, this.backgroundTaskCount);
        if (value.type !== "result") continue;
        this.pendingTurns = Math.max(this.pendingTurns - 1, 0);
        if (this.pendingTurns === 0 && this.backgroundTaskCount === 0) break;
      }
      sink.end();
    } catch (error) {
      this.pendingTurns = 0;
      sink.end(error as Error);
    }
  }
}
