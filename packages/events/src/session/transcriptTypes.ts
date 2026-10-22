export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "approval_required"
  | "answer_required"
  | "error";

export type ToolStatus =
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval"
  | "awaiting_answer";

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  expanded: boolean;
  startedAt: number;
  endedAt?: number;
  output?: string;
  error?: string;
};

export type TranscriptEntry =
  | { kind: "user"; id: string; at: number; text: string; checkpointId?: string }
  | {
      kind: "assistant";
      id: string;
      at: number;
      messageId: string;
      text: string;
      streaming: boolean;
    }
  | { kind: "notice"; id: string; at: number; text: string }
  | { kind: "thought"; id: string; at: number; durationMs: number }
  | { kind: "tools"; id: string; calls: ToolCall[] };

export type ToolsEntry = Extract<TranscriptEntry, { kind: "tools" }>;

export type UserEntry = Extract<TranscriptEntry, { kind: "user" }>;

export type TokenUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  maxContext: number;
};

export type RateWindow = { utilization: number; resetsAt: number };

export type RateLimits = { fiveHour?: RateWindow; sevenDay?: RateWindow };

export type LastRun = { durationMs: number; toolCount: number };
