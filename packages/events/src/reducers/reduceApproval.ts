import type { ApprovalDecision } from "../models/approvalDecision.ts";
import type { SessionState } from "../session/sessionState.ts";
import { pickToolStatus, updateToolCall, upsertToolCall } from "./toolGroups.ts";

type ApprovalRequired = {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
};

export function reduceApprovalRequired(state: SessionState, event: ApprovalRequired): SessionState {
  const withCall = upsertToolCall(state, {
    id: event.toolUseId,
    name: event.toolName,
    input: event.input,
  });
  const waiting = updateToolCall(withCall, event.toolUseId, (call) => ({
    ...call,
    status: "awaiting_approval",
  }));
  return { ...waiting, status: "approval_required" };
}

export function reduceApprovalResolved(
  state: SessionState,
  event: { toolUseId: string; decision: ApprovalDecision },
): SessionState {
  const rejected = event.decision === "reject";
  const settled = updateToolCall(state, event.toolUseId, (call) =>
    rejected
      ? { ...call, status: "failed", error: "Rejected by user" }
      : { ...call, status: "running" },
  );
  return { ...settled, status: pickToolStatus(settled) };
}
