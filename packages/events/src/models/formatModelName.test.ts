import { expect, test } from "vitest";
import { formatModelName } from "./formatModelName.ts";

test("formats claude model ids as readable names", () => {
  expect(formatModelName("claude-haiku-5-5")).toBe("Claude Haiku 5.5");
  expect(formatModelName("claude-haiku-4-5-20251001")).toBe("Claude Haiku 4.5");
  expect(formatModelName("claude-fable-5-1")).toBe("Claude Fable 5.1");
  expect(formatModelName("claude-sonnet-4-20250514")).toBe("Claude Sonnet 4");
  expect(formatModelName("claude-3-5-sonnet-20241022")).toBe("Claude Sonnet 3.5");
  expect(formatModelName("claude-opus-5-5[1m]")).toBe("Claude Opus 5.5");
});

test("leaves other names alone and labels an empty model", () => {
  expect(formatModelName("sonnet")).toBe("sonnet");
  expect(formatModelName("")).toBe("default");
});
