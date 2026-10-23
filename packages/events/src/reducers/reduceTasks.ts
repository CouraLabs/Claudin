import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunningTask } from "../session/runningTask.ts";
import type { SessionState } from "../session/sessionState.ts";

type SystemMessage<Subtype extends string> = Extract<SDKMessage, { subtype: Subtype }>;
type TaskMessage =
  | SystemMessage<"task_started">
  | SystemMessage<"task_progress">
  | SystemMessage<"task_updated">
  | SystemMessage<"task_notification">;

const FINISHED_STATUSES = ["completed", "failed", "killed"];

export const isTaskMessage = (message: SDKMessage): message is TaskMessage =>
  message.type === "system" &&
  ["task_started", "task_progress", "task_updated", "task_notification"].includes(message.subtype);

const patchTask = (
  tasks: RunningTask[],
  id: string,
  patch: (task: RunningTask) => RunningTask,
): RunningTask[] => tasks.map((task) => (task.id === id ? patch(task) : task));

const startTask = (state: SessionState, message: SystemMessage<"task_started">): RunningTask[] => {
  if (message.ambient || message.skip_transcript) return state.tasks;
  const task: RunningTask = {
    id: message.task_id,
    kind: message.subagent_type ?? message.task_type ?? "task",
    description: message.description,
    startedAt: state.now,
    tokens: 0,
    paused: false,
  };
  return [...state.tasks.filter(({ id }) => id !== task.id), task];
};

const updateTask = (tasks: RunningTask[], message: SystemMessage<"task_updated">) => {
  const { status, description } = message.patch;
  if (status && FINISHED_STATUSES.includes(status)) {
    return tasks.filter(({ id }) => id !== message.task_id);
  }
  return patchTask(tasks, message.task_id, (task) => ({
    ...task,
    description: description ?? task.description,
    paused: status ? status === "paused" : task.paused,
  }));
};

const readTasks = (state: SessionState, message: TaskMessage): RunningTask[] => {
  switch (message.subtype) {
    case "task_started":
      return startTask(state, message);
    case "task_progress":
      return patchTask(state.tasks, message.task_id, (task) => ({
        ...task,
        lastToolName: message.last_tool_name ?? task.lastToolName,
        summary: message.summary ?? task.summary,
        tokens: message.usage.total_tokens,
      }));
    case "task_updated":
      return updateTask(state.tasks, message);
    case "task_notification":
      return state.tasks.filter(({ id }) => id !== message.task_id);
  }
};

export const reduceTasks = (state: SessionState, message: TaskMessage): SessionState => ({
  ...state,
  tasks: readTasks(state, message),
});
