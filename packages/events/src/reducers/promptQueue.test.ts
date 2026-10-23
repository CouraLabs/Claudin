import { expect, test } from "vitest";
import type { AppEvent } from "../session/appEvent.ts";
import { createSessionState } from "../session/sessionState.ts";
import { reduceSessionState } from "./reduceSessionState.ts";

const play = (events: AppEvent[]) => events.reduce(reduceSessionState, createSessionState("s"));

const image = {
  type: "image" as const,
  source: { type: "base64" as const, media_type: "image/png" as const, data: "AA==" },
};

test("a queued prompt waits in the queue and is not added to the transcript", () => {
  const state = play([
    { type: "agent.prompt.requested", agentSessionId: "a", content: "first" },
    { type: "ui.prompt.queued", content: "second" },
  ]);
  expect(state.queuedPrompts).toEqual(["second"]);
  expect(state.transcript.filter((entry) => entry.kind === "user")).toHaveLength(1);
  expect(state.queuedTurns).toBe(0);
});

test("a queued prompt keeps its attachments", () => {
  const content = [{ type: "text" as const, text: "look" }, image];
  const state = play([{ type: "ui.prompt.queued", content }]);
  expect(state.queuedPrompts).toEqual([content]);
});

test("dequeuing removes the oldest queued prompt first", () => {
  const state = play([
    { type: "ui.prompt.queued", content: "one" },
    { type: "ui.prompt.queued", content: "two" },
    { type: "ui.prompt.dequeued" },
  ]);
  expect(state.queuedPrompts).toEqual(["two"]);
});
