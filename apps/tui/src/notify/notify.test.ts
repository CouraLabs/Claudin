import { EventEmitter } from "node:events";
import type { CliRenderer } from "@opentui/core";
import { expect, test } from "vitest";
import { describeAlert } from "./describeAlert.ts";
import { TurnNotifier } from "./turnNotifier.ts";

const approval = {
  type: "agent.tool.approval.required",
  agentSessionId: "a",
  toolUseId: "t",
  toolName: "Write",
  input: {},
} as const;

test("alerts describe approvals, questions and finished turns", () => {
  expect(describeAlert(approval)).toBe("Approval needed: Write");
  const result = { type: "agent.message.received", message: { type: "result" } } as const;
  expect(describeAlert(result)).toBe("Turn finished");
  expect(describeAlert({ type: "ui.clock.ticked", now: 0 })).toBeUndefined();
});

test("notifications fire only while the terminal is unfocused", () => {
  const sent: string[] = [];
  const renderer = Object.assign(new EventEmitter(), {
    triggerNotification: (text: string) => sent.push(text) > 0,
  }) as unknown as CliRenderer;
  const notifier = new TurnNotifier(renderer);
  notifier.notify(approval);
  renderer.emit("blur");
  notifier.notify(approval);
  renderer.emit("focus");
  notifier.notify(approval);
  expect(sent).toEqual(["Approval needed: Write"]);
});
