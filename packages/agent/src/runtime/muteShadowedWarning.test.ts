import { afterEach, expect, test } from "vitest";
import { muteShadowedWarning } from "./muteShadowedWarning.ts";

const originalEmit = process.emitWarning;

afterEach(() => {
  process.emitWarning = originalEmit;
});

function collectWarnings() {
  const received: unknown[] = [];
  process.emitWarning = ((warning: unknown) => {
    received.push(warning);
  }) as typeof process.emitWarning;
  muteShadowedWarning();
  return received;
}

test("drops the shadowed canUseTool warning", () => {
  const received = collectWarnings();
  process.emitWarning("shadowed", { code: "CLAUDE_SDK_CAN_USE_TOOL_SHADOWED" });
  process.emitWarning("shadowed", "Warning", "CLAUDE_SDK_CAN_USE_TOOL_SHADOWED");
  expect(received).toEqual([]);
});

test("passes other warnings through", () => {
  const received = collectWarnings();
  process.emitWarning("other", { code: "SOMETHING_ELSE" });
  process.emitWarning("plain");
  expect(received).toEqual(["other", "plain"]);
});
