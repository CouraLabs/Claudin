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
import type { ApprovalDecision, PromptContent, ResponseEvent } from "@kraude-kode/events";
import { type Pushable, pushable } from "it-pushable";
import { type WaitForLoginOptions, waitForMcpLogin } from "../mcp/waitForMcpLogin.ts";
import { ElicitationGate } from "../permissions/elicitationGate.ts";
import { PermissionGate } from "../permissions/permissionGate.ts";
import { AGENT_PROFILE_OPTIONS } from "../profile/agentProfile.ts";
import {
  MAX_RATE_LIMIT_RESUMES,
  RATE_LIMIT_RESUME_BUFFER_MS,
  type RejectedRateLimit,
  rateLimitWaitMs,
  readRejectedRateLimit,
  type Sleep,
  waitOutSleep,
} from "../ratelimit/rateLimitResume.ts";
import type { AgentQuery, AgentRuntime } from "../runtime/agentRuntime.ts";
import { buildUserMessage } from "../runtime/buildUserMessage.ts";
import { readLiveTaskIds } from "./readLiveTaskIds.ts";

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
  liveTaskIds: ReadonlySet<string> = new Set();
  pumping = false;
  rateLimitRejection?: RejectedRateLimit;
  resumeBudget = MAX_RATE_LIMIT_RESUMES;
  private sentMessages: SDKUserMessage[] = [];
  private waitAbort?: AbortController;

  constructor(
    readonly agentSessionId: string,
    private baseOptions: Options,
    runtime: AgentRuntime,
    private sleep: Sleep = waitOutSleep,
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

  prompt(content: PromptContent): AsyncGenerator<TurnEvent> {
    this.send(content);
    return this.streamTurn();
  }

  send(content: PromptContent): void {
    this.resumeBudget = MAX_RATE_LIMIT_RESUMES;
    this.pendingTurns += 1;
    const message = buildUserMessage(content);
    this.sentMessages.push(message);
    if (!this.waitAbort) this.input.push(message);
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
    this.waitAbort?.abort();
    this.rateLimitRejection = undefined;
    this.rejectAllPrompts();
    await this.query.interrupt();
  }

  stopTask(taskId: string): Promise<void> {
    return this.query.stopTask(taskId);
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
    this.waitAbort?.abort();
    this.rateLimitRejection = undefined;
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
        if (done) {
          const rejection = this.rateLimitRejection;
          this.rateLimitRejection = undefined;
          if (rejection || this.sentMessages.length > 0) {
            sink.push({
              type: "request.failed",
              reason: "Agent stream ended while prompts were still pending; resend to continue.",
            });
          }
          break;
        }
        if (value.type === "rate_limit_event") {
          const rejection = readRejectedRateLimit(value);
          if (rejection) this.rateLimitRejection = rejection;
        }
        sink.push({ type: "agent.message.received", message: value });
        this.liveTaskIds = readLiveTaskIds(value, this.liveTaskIds);
        if (value.type !== "result") continue;
        const rejection = this.rateLimitRejection;
        this.rateLimitRejection = undefined;
        if (rejection && value.is_error && (await this.resumeAfterLimit(sink, rejection))) continue;
        this.pendingTurns = Math.max(this.pendingTurns - 1, 0);
        this.sentMessages.shift();
        if (this.pendingTurns === 0 && this.liveTaskIds.size === 0) break;
      }
      this.pumping = false;
      sink.end();
    } catch (error) {
      this.pendingTurns = 0;
      this.sentMessages = [];
      this.rateLimitRejection = undefined;
      this.pumping = false;
      sink.end(error as Error);
    }
  }

  private async resumeAfterLimit(
    sink: Pushable<TurnEvent>,
    rejection: RejectedRateLimit,
  ): Promise<boolean> {
    this.rateLimitRejection = undefined;
    if (this.sentMessages.length === 0 || this.resumeBudget <= 0) return false;
    this.resumeBudget -= 1;
    const abort = new AbortController();
    this.waitAbort = abort;
    sink.push({
      type: "agent.rate_limit.wait.started",
      agentSessionId: this.agentSessionId,
      resetsAt: rejection.resetsAt,
    });
    const resumed = await this.sleep(
      rateLimitWaitMs(rejection, Date.now(), RATE_LIMIT_RESUME_BUFFER_MS),
      abort.signal,
    );
    if (this.waitAbort === abort) this.waitAbort = undefined;
    sink.push({
      type: "agent.rate_limit.wait.ended",
      agentSessionId: this.agentSessionId,
      resumed,
    });
    if (!resumed) return false;
    for (const message of this.sentMessages) this.input.push(message);
    this.pendingTurns = this.sentMessages.length;
    return true;
  }
}
