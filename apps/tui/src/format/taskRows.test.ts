import type { RunningTask } from "@claudin/events";
import { expect, test } from "vitest";
import { buildTaskRow, buildTaskRows, countHiddenTasks, MAX_TASK_ROWS } from "./taskRows.ts";

const task = (id: string, extra: Partial<RunningTask> = {}): RunningTask => ({
  id,
  kind: "explore",
  description: "Check",
  startedAt: 0,
  tokens: 0,
  paused: false,
  ...extra,
});

test("a fresh task shows the starting detail", () => {
  expect(buildTaskRow(task("a"), 1000).detail).toBe("Starting...");
});

test("the detail prefers the summary over the last tool", () => {
  const row = buildTaskRow(task("a", { summary: "Reading", lastToolName: "Grep" }), 0);
  expect(row.detail).toBe("Reading");
  expect(buildTaskRow(task("a", { lastToolName: "Grep" }), 0).detail).toBe("Grep");
});

test("a paused task says so", () => {
  expect(buildTaskRow(task("a", { paused: true }), 0).detail).toBe("Paused");
});

test("rows are capped and the rest is counted", () => {
  const tasks = Array.from({ length: MAX_TASK_ROWS + 2 }, (_, index) => task(`t${index}`));
  expect(buildTaskRows(tasks, 0)).toHaveLength(MAX_TASK_ROWS);
  expect(countHiddenTasks(tasks)).toBe(2);
});
