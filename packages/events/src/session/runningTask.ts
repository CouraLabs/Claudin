export type RunningTask = {
  id: string;
  kind: string;
  description: string;
  startedAt: number;
  toolUseId?: string;
  model?: string;
  lastToolName?: string;
  lastToolCall?: { name: string; input: Record<string, unknown> };
  summary?: string;
  tokens: number;
  paused: boolean;
};
