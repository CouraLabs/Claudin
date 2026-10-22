import type {
  EffortLevel,
  McpServerStatus,
  ModelInfo,
  Options,
  PermissionMode,
  SDKUserMessage,
  SlashCommand,
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentMode, ApprovalDecision, PromptContent, ResponseEvent } from "@claudin/events";
import { type Pushable, pushable } from "it-pushable";
import { AGENT_MODE_PROFILES, buildModeOptions } from "../modes/agentModeProfiles.ts";
import type { AgentQuery, AgentRuntime } from "../runtime/agentRuntime.ts";
import { buildUserMessage, type PromptPriority } from "../runtime/buildUserMessage.ts";
import { PermissionGate } from "../permissions/permissionGate.ts";

type TurnEvent = ResponseEvent;

export class AgentSession {
  readonly input = pushable<SDKUserMessage>({ objectMode: true });
  readonly gate: PermissionGate;
  readonly query: AgentQuery;
  pendingTurns = 0;
  pumping = false;
  started: boolean;

  constructor(
    private agentSessionId: string,
    private baseOptions: Options,
    readonly mode: AgentMode,
    runtime: AgentRuntime,
    resumed = false,
  ) {
    this.started = resumed;
    this.gate = new PermissionGate(agentSessionId, AGENT_MODE_PROFILES[mode].deniedTools);
    this.query = runtime.open({
      prompt: this.input,
      options: {
        includePartialMessages: true,
        ...baseOptions,
        ...buildModeOptions(mode),
        canUseTool: this.gate.canUseTool,
      },
    });
  }

  get hasStarted(): boolean {
    return this.started;
  }

  buildSwitchOptions(): Options {
    const { sessionId: _created, ...rest } = this.baseOptions;
    return this.started ? { ...rest, resume: this.agentSessionId } : this.baseOptions;
  }

  prompt(content: PromptContent, priority?: PromptPriority): AsyncGenerator<TurnEvent> {
    this.send(content, priority);
    return this.streamTurn();
  }

  send(content: PromptContent, priority?: PromptPriority): void {
    this.started = true;
    this.pendingTurns += 1;
    this.input.push(buildUserMessage(content, priority));
  }

  async *streamTurn(): AsyncGenerator<TurnEvent> {
    if (this.pumping) return;
    this.pumping = true;
    const sink = pushable<TurnEvent>({ objectMode: true });
    this.gate.listen((event) => sink.push(event));
    this.pumpMessages(sink);
    try {
      yield* sink;
    } finally {
      this.pumping = false;
      this.gate.listen(() => {});
    }
  }

  answerApproval(toolUseId: string, decision: ApprovalDecision): void {
    this.gate.answerApproval(toolUseId, decision);
  }

  answerQuestion(toolUseId: string, answers: Record<string, string>): void {
    this.gate.answerQuestion(toolUseId, answers);
  }

  async cancel(): Promise<void> {
    this.gate.rejectAll();
    await this.query.interrupt();
  }

  async setModel(model: string): Promise<void> {
    await this.query.setModel(model);
    this.baseOptions = { ...this.baseOptions, model };
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    await this.query.setPermissionMode(mode);
    this.baseOptions = { ...this.baseOptions, permissionMode: mode };
  }

  async setEffort(effort: EffortLevel): Promise<void> {
    await this.query.applyFlagSettings({ effortLevel: effort });
    this.baseOptions = { ...this.baseOptions, effort };
  }

  fetchMcpStatus(): Promise<McpServerStatus[]> {
    return this.query.mcpServerStatus();
  }

  fetchModels(): Promise<ModelInfo[]> {
    return this.query.supportedModels();
  }

  fetchCommands(): Promise<SlashCommand[]> {
    return this.query.supportedCommands();
  }

  fetchUsage() {
    return this.query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({
      skipBehaviors: true,
    });
  }

  close(): void {
    this.gate.rejectAll();
    this.input.end();
    this.query.close();
  }

  async pumpMessages(sink: Pushable<TurnEvent>): Promise<void> {
    try {
      while (true) {
        const { done, value } = await this.query.next();
        if (done) break;
        sink.push({ type: "agent.message.received", message: value });
        if (value.type !== "result") continue;
        this.pendingTurns = Math.max(this.pendingTurns - 1, 0);
        if (this.pendingTurns === 0) break;
      }
      sink.end();
    } catch (error) {
      this.pendingTurns = 0;
      sink.end(error as Error);
    }
  }
}
