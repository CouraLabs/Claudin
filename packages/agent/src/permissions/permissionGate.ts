import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { type ApprovalDecision, askedQuestionsSchema, type ResponseEvent } from "@claudin/events";
import { allowTool, denyTool } from "./permissionResults.ts";

export const ASK_TOOL_NAME = "AskUserQuestion";

const SAFE_TOOLS = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch", "TodoWrite", "Agent"]);

const REJECTED_MESSAGE = "The user rejected this tool call.";
const INVALID_MESSAGE = "The questions were malformed. Ask the user directly in plain text.";
const DECLINED_MESSAGE =
  "The user dismissed the questions. Ask the user directly in plain text and wait for their reply.";

type PromptKind = "approval" | "question";

type Pending = {
  kind: PromptKind;
  input: Record<string, unknown>;
  settle: (result: PermissionResult) => void;
};

type Emit = (event: ResponseEvent) => void;

export class PermissionGate {
  readonly pending = new Map<string, Pending>();
  approveAll = false;
  emit: Emit = () => {};

  constructor(private agentSessionId: string) {}

  listen(emit: Emit): void {
    this.emit = emit;
  }

  readonly canUseTool: CanUseTool = (toolName, input, { toolUseID, signal }) =>
    toolName === ASK_TOOL_NAME
      ? this.askQuestions(input, toolUseID, signal)
      : this.askApproval(toolName, input, toolUseID, signal);

  answerApproval(toolUseId: string, decision: ApprovalDecision): void {
    if (decision === "approve_all") this.approveAll = true;
    const targets = decision === "approve_all" ? this.listIds("approval") : [toolUseId];
    for (const id of targets) this.settleApproval(id, decision === "reject" ? "reject" : "approve");
  }

  answerQuestion(toolUseId: string, answers: Record<string, string>): void {
    const pending = this.take("question", toolUseId);
    if (!pending) return;
    const answered = Object.keys(answers).length > 0;
    pending.settle(
      answered ? allowTool({ ...pending.input, answers }) : denyTool(DECLINED_MESSAGE),
    );
    this.emit({ type: "agent.question.resolved", toolUseId, answered });
  }

  rejectAll(): void {
    for (const [id, { kind }] of [...this.pending]) this.dismiss(kind, id);
  }

  private askApproval(
    toolName: string,
    input: Record<string, unknown>,
    toolUseId: string,
    signal: AbortSignal,
  ): Promise<PermissionResult> {
    if (SAFE_TOOLS.has(toolName) || this.approveAll) return Promise.resolve(allowTool(input));
    return this.open("approval", toolUseId, input, signal, {
      type: "agent.tool.approval.required",
      agentSessionId: this.agentSessionId,
      toolUseId,
      toolName,
      input,
    });
  }

  private askQuestions(
    input: Record<string, unknown>,
    toolUseId: string,
    signal: AbortSignal,
  ): Promise<PermissionResult> {
    const parsed = askedQuestionsSchema.safeParse(input.questions);
    if (!parsed.success) return Promise.resolve(denyTool(INVALID_MESSAGE));
    return this.open("question", toolUseId, input, signal, {
      type: "agent.question.required",
      agentSessionId: this.agentSessionId,
      toolUseId,
      questions: parsed.data,
    });
  }

  private open(
    kind: PromptKind,
    toolUseId: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
    announcement: ResponseEvent,
  ): Promise<PermissionResult> {
    return new Promise((settle) => {
      this.pending.set(toolUseId, { kind, input, settle });
      signal.addEventListener("abort", () => this.dismiss(kind, toolUseId), { once: true });
      this.emit(announcement);
    });
  }

  private dismiss(kind: PromptKind, toolUseId: string): void {
    if (kind === "approval") this.settleApproval(toolUseId, "reject");
    else this.answerQuestion(toolUseId, {});
  }

  private take(kind: PromptKind, toolUseId: string): Pending | undefined {
    const pending = this.pending.get(toolUseId);
    if (pending?.kind !== kind) return undefined;
    this.pending.delete(toolUseId);
    return pending;
  }

  private listIds(kind: PromptKind): string[] {
    return [...this.pending].filter(([, pending]) => pending.kind === kind).map(([id]) => id);
  }

  private settleApproval(toolUseId: string, decision: ApprovalDecision): void {
    const pending = this.take("approval", toolUseId);
    if (!pending) return;
    pending.settle(decision === "reject" ? denyTool(REJECTED_MESSAGE) : allowTool(pending.input));
    this.emit({ type: "agent.tool.approval.resolved", toolUseId, decision });
  }
}
