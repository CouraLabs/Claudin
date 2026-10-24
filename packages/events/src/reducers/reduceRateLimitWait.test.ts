import { expect, test } from "vitest";
import type { AppEvent } from "../session/appEvent.ts";
import { createSessionState } from "../session/sessionState.ts";
import { reduceTimedEvent } from "./reduceSessionState.ts";

const START = 1_700_000_000_000;
const RESET = START + 2 * 60 * 60 * 1000;

const timed = (event: unknown, at = START) =>
  reduceTimedEvent(createSessionState("s"), event as AppEvent, at);

const waitStart = (resetsAt: number) => ({
  type: "agent.rate_limit.wait.started",
  agentSessionId: "agent-1",
  resetsAt,
});
const waitEnd = (resumed: boolean) => ({
  type: "agent.rate_limit.wait.ended",
  agentSessionId: "agent-1",
  resumed,
});

test("a fresh wait shows the rate_limited status and reset time", () => {
  const state = timed(waitStart(RESET), START);
  expect(state.status).toBe("rate_limited");
  expect(state.rateLimitWait).toEqual({ resetsAt: RESET });
  expect(state.turnStartedAt).toBeUndefined();
  expect(state.transcript.at(-1)).toMatchObject({
    kind: "notice",
    text: expect.stringContaining("Usage limit reached"),
  });
});

test("a wait whose window already reset is ignored", () => {
  const state = timed(waitStart(START - 1000), START);
  expect(state.status).toBe("idle");
  expect(state.rateLimitWait).toBeUndefined();
});

test("a resumed wait flips back to thinking", () => {
  const start = timed(waitStart(RESET), START);
  const ended = reduceTimedEvent(start, waitEnd(true) as AppEvent, START + 1000);
  expect(ended.status).toBe("thinking");
  expect(ended.rateLimitWait).toBeUndefined();
  expect(ended.turnStartedAt).toBe(START + 1000);
  expect(ended.transcript.at(-1)).toMatchObject({
    kind: "notice",
    text: expect.stringContaining("Resuming execution"),
  });
});

test("a cancelled wait returns to idle", () => {
  const start = timed(waitStart(RESET), START);
  const ended = reduceTimedEvent(start, waitEnd(false) as AppEvent, START + 1000);
  expect(ended.status).toBe("idle");
  expect(ended.rateLimitWait).toBeUndefined();
  expect(ended.turnStartedAt).toBeUndefined();
});

test("a wait end without a start still resumes into thinking", () => {
  const state = timed(waitEnd(true), START);
  expect(state.status).toBe("thinking");
  expect(state.transcript.at(-1)).toMatchObject({
    kind: "notice",
    text: expect.stringContaining("Resuming execution"),
  });
});
