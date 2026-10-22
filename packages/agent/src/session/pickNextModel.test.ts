import type { ModelInfo } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "vitest";
import { pickNextModel } from "./pickNextModel.ts";

const models = ["haiku", "sonnet", "opus"].map((value) => ({ value })) as ModelInfo[];

test("picks the model after the current one", () => {
  expect(pickNextModel(models, "haiku")).toBe("sonnet");
});

test("wraps around after the last model", () => {
  expect(pickNextModel(models, "opus")).toBe("haiku");
});

test("starts at the first model when the current one is unknown", () => {
  expect(pickNextModel(models, "other")).toBe("haiku");
  expect(pickNextModel(models)).toBe("haiku");
});

test("returns nothing without models", () => {
  expect(pickNextModel([], "haiku")).toBeUndefined();
});
