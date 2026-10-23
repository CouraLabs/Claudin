import type { RunningTask } from "@claudin/events";
import { formatDuration, formatTokenCount } from "./formatMetrics.ts";
import { SEPARATOR } from "./glyphs.ts";
import { summarizeToolCall } from "./toolSummary.ts";

export const MAX_TASK_ROWS = 5;

const KIND_LABELS: Record<string, string> = { "general-purpose": "Agent", local_bash: "Bash" };

export type TaskRow = {
  taskId: string;
  kind: string;
  model: string;
  title: string;
  stats: string;
  detail: string;
};

const describeLastTool = ({ lastToolCall, lastToolName }: RunningTask): string | undefined => {
  if (!lastToolCall) return lastToolName;
  const { name, input } = lastToolCall;
  const summary = summarizeToolCall({
    id: "",
    name,
    input,
    status: "running",
    expanded: false,
    startedAt: 0,
  });
  return `${name} ${summary}`;
};

const readDetail = (task: RunningTask): string => {
  if (task.paused) return "Paused";
  return task.summary ?? describeLastTool(task) ?? "Starting...";
};

export const buildTaskRow = (task: RunningTask, now: number): TaskRow => ({
  taskId: task.id,
  kind: KIND_LABELS[task.kind] ?? task.kind,
  model: task.model ?? "",
  title: task.description,
  stats: [formatDuration(Math.max(now - task.startedAt, 0)), `↓${formatTokenCount(task.tokens)}`]
    .join(SEPARATOR)
    .trim(),
  detail: readDetail(task),
});

export const buildTaskRows = (tasks: RunningTask[], now: number): TaskRow[] =>
  tasks.slice(0, MAX_TASK_ROWS).map((task) => buildTaskRow(task, now));

export const buildTaskHeader = (tasks: RunningTask[]): string =>
  `Tasks${SEPARATOR}${tasks.length} running`;

export const countHiddenTasks = (tasks: RunningTask[]): number =>
  Math.max(tasks.length - MAX_TASK_ROWS, 0);
