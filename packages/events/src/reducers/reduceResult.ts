import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";
import { countTurnTools, settleOpenCalls } from "./toolGroups.ts";

type ResultMessage = Extract<SDKMessage, { type: "result" }>;

const CANCEL_SUBTYPE = "error_during_execution";

export const stopStreaming = (state: SessionState): SessionState => ({
  ...state,
  streamingMessageId: undefined,
  thinkingStartedAt: undefined,
  turnStartedAt: undefined,
  transcript: state.transcript.map((entry) =>
    entry.kind === "assistant" ? { ...entry, streaming: false } : entry,
  ),
});

function readContextWindow(message: ResultMessage, fallback: number): number {
  const windows = Object.values(message.modelUsage ?? {}).map((usage) => usage.contextWindow);
  return windows.find((size) => size > 0) ?? fallback;
}

const endTurn = (settled: SessionState, previous: SessionState): SessionState =>
  previous.queuedTurns > 0
    ? {
        ...settled,
        status: "thinking",
        queuedTurns: previous.queuedTurns - 1,
        turnStartedAt: settled.now,
      }
    : { ...settled, status: "idle" };

function endResult(state: SessionState, message: ResultMessage): SessionState {
  const withWindow = {
    ...stopStreaming(state),
    costUsd: message.total_cost_usd ?? state.costUsd,
    tokens: { ...state.tokens, maxContext: readContextWindow(message, state.tokens.maxContext) },
  };
  if (!message.is_error) return endTurn(withWindow, state);
  const settled = settleOpenCalls(withWindow, "Cancelled");
  if (message.subtype === CANCEL_SUBTYPE) return endTurn(settled, state);
  const details = "errors" in message ? message.errors.join("; ") : "";
  const failed = appendNotice(settled, `Error: ${message.subtype} ${details}`.trim());
  return { ...failed, status: "error", queuedTurns: 0 };
}

export const reduceResult = (state: SessionState, message: ResultMessage): SessionState => ({
  ...endResult(state, message),
  lastRun: { durationMs: message.duration_ms ?? 0, toolCount: countTurnTools(state) },
});
