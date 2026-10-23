import type { RunningTask } from "@claudin/events";
import { formatDuration, formatTokenCount } from "./formatMetrics.ts";
import { SEPARATOR } from "./glyphs.ts";

export const MAX_TASK_ROWS = 5;

export type TaskRow = {
  taskId: string;
  kind: string;
  title: string;
  stats: string;
  detail: string;
};

const readDetail = ({ summary, lastToolName, paused }: RunningTask): string => {
  if (paused) return "Paused";
  return summary ?? lastToolName ?? "Starting...";
};

export const buildTaskRow = (task: RunningTask, now: number): TaskRow => ({
  taskId: task.id,
  kind: task.kind,
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
