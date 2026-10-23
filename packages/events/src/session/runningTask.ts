export type RunningTask = {
  id: string;
  kind: string;
  description: string;
  startedAt: number;
  lastToolName?: string;
  summary?: string;
  tokens: number;
  paused: boolean;
};
