import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

type TaskIds = ReadonlySet<string>;

const FINISHED_STATUSES = ["completed", "failed", "killed"];

const withTask = (current: TaskIds, id: string): TaskIds => new Set([...current, id]);

const withoutTask = (current: TaskIds, id: string): TaskIds =>
  new Set([...current].filter((taskId) => taskId !== id));

export function readLiveTaskIds(message: SDKMessage, current: TaskIds): TaskIds {
  if (message.type !== "system") return current;
  switch (message.subtype) {
    case "background_tasks_changed":
      return new Set(message.tasks.filter((task) => !task.ambient).map((task) => task.task_id));
    case "task_started":
      return message.ambient ? current : withTask(current, message.task_id);
    case "task_updated":
      return FINISHED_STATUSES.includes(message.patch.status ?? "")
        ? withoutTask(current, message.task_id)
        : current;
    case "task_notification":
      return withoutTask(current, message.task_id);
    default:
      return current;
  }
}
