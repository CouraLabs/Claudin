import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ResponseEvent } from "@kraude-kode/events";
import { expect, test } from "vitest";
import {
  MAX_RATE_LIMIT_RESUMES,
  RATE_LIMIT_RESUME_BUFFER_MS,
  type Sleep,
} from "../ratelimit/rateLimitResume.ts";
import { RESULT_MESSAGE, ScriptedRuntime, type ScriptedTurn } from "../runtime/scriptedRuntime.ts";
import { AgentSessionManager } from "./agentSessionManager.ts";

const note = (text: string) => ({ type: "system", subtype: "note", text }) as unknown as SDKMessage;

const rejectionEvent = (resetsAtMs: number) =>
  ({
    type: "rate_limit_event",
    rate_limit_info: { status: "rejected", resetsAt: Math.floor(resetsAtMs / 1000) },
  }) as unknown as SDKMessage;

const allowedEvent = (resetsAtMs: number) =>
  ({
    type: "rate_limit_event",
    rate_limit_info: { status: "allowed", resetsAt: Math.floor(resetsAtMs / 1000) },
  }) as unknown as SDKMessage;

const ERROR_RESULT = {
  ...RESULT_MESSAGE,
  subtype: "error_during_execution",
  is_error: true,
  errors: ["You have reached your usage limit"],
} as unknown as SDKMessage;

async function collect(turn: AsyncGenerator<ResponseEvent>) {
  const events: ResponseEvent[] = [];
  for await (const event of turn) events.push(event);
  return events;
}

const instantSleep: Sleep = () => Promise.resolve(true);

const abortableSleep: Sleep = (_ms, signal) =>
  new Promise<boolean>((resolve) =>
    signal.addEventListener("abort", () => resolve(false), { once: true }),
  );

function createFixture(turn: ScriptedTurn, sleep: Sleep = instantSleep) {
  const runtime = new ScriptedRuntime(turn);
  const manager = new AgentSessionManager(runtime, sleep);
  const id = manager.createSession({ cwd: "/work" });
  return { runtime, manager, id, session: manager.requireSession(id) };
}

const eventTypes = (events: ResponseEvent[]): string[] => events.map((event) => event.type);

const findEvent = <T extends ResponseEvent["type"]>(events: ResponseEvent[], type: T) =>
  events.find((event) => event.type === type) as Extract<ResponseEvent, { type: T }> | undefined;

const promptText = (message: SDKUserMessage): string => {
  const content = message.message.content;
  return typeof content === "string"
    ? content
    : (content.find((part) => part.type === "text") as { text?: string } | undefined)?.text ?? "";
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a rejected limit waits for the reset then re-sends the prompt", async () => {
  const inputs: SDKUserMessage[] = [];
  const sleeps: number[] = [];
  let rejectionResetsAt = 0;
  let turnCount = 0;
  const { session } = createFixture((input) => {
    turnCount += 1;
    inputs.push(input);
    return turnCount === 1
      ? [rejectionEvent((rejectionResetsAt = Date.now() + 2_000)), ERROR_RESULT]
      : [note("resumed"), RESULT_MESSAGE];
  }, (ms) => {
    sleeps.push(ms);
    return Promise.resolve(true);
  });
  const events = await collect(session.prompt("keep working"));
  expect(eventTypes(events)).toEqual([
    "agent.message.received",
    "agent.message.received",
    "agent.rate_limit.wait.started",
    "agent.rate_limit.wait.ended",
    "agent.message.received",
    "agent.message.received",
  ]);
  expect(findEvent(events, "agent.rate_limit.wait.started")).toMatchObject({
    resetsAt: Math.floor(rejectionResetsAt / 1000) * 1000,
  });
  expect(sleeps[0]).toBeGreaterThanOrEqual(2_000);
  expect(sleeps[0]).toBeLessThanOrEqual(2_000 + RATE_LIMIT_RESUME_BUFFER_MS);
  expect(findEvent(events, "agent.rate_limit.wait.ended")).toMatchObject({ resumed: true });
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toEqual(inputs[0]);
  expect(session.pendingTurns).toBe(0);
  expect(session.pumping).toBe(false);
});

test("a success after a rejection does not re-send the turn", async () => {
  const inputs: SDKUserMessage[] = [];
  const { session } = createFixture((input) => {
    inputs.push(input);
    return [
      rejectionEvent(Date.now() + 5_000),
      allowedEvent(Date.now() + 5_000),
      RESULT_MESSAGE,
    ];
  });
  const events = await collect(session.prompt("first try"));
  expect(eventTypes(events)).not.toContain("agent.rate_limit.wait.started");
  expect(eventTypes(events)).not.toContain("agent.rate_limit.wait.ended");
  expect(inputs).toHaveLength(1);
  expect(session.pendingTurns).toBe(0);
});

test("cancelling during the wait stops the resume", async () => {
  const inputs: SDKUserMessage[] = [];
  const { runtime, session } = createFixture((input) => {
    inputs.push(input);
    return [rejectionEvent(Date.now() + 60_000), ERROR_RESULT];
  }, abortableSleep);
  const query = runtime.queries[0];
  if (!query) throw new Error("query missing");
  query.emitsInterruptedResult = true;
  const events: ResponseEvent[] = [];
  let cancelled = false;
  for await (const event of session.prompt("long haul")) {
    events.push(event);
    if (event.type === "agent.rate_limit.wait.started" && !cancelled) {
      cancelled = true;
      await session.cancel();
    }
  }
  expect(cancelled).toBe(true);
  expect(findEvent(events, "agent.rate_limit.wait.ended")).toMatchObject({ resumed: false });
  expect(inputs).toHaveLength(1);
  expect(session.pumping).toBe(false);
  expect(inputs.every(Boolean)).toBe(true);
});

test("a prompt sent during the wait joins the resumed batch", async () => {
  let wake: ((resumed: boolean) => void) | undefined;
  const inputTexts: string[] = [];
  let calls = 0;
  const { session } = createFixture((input) => {
    calls += 1;
    inputTexts.push(promptText(input));
    if (calls === 1) return [rejectionEvent(Date.now() + 5_000), ERROR_RESULT];
    return [note(`turn ${calls}`), RESULT_MESSAGE];
  }, () => new Promise<boolean>((resolve) => (wake = resolve)));
  const collecting = collect(session.prompt("keep working"));
  await tick();
  await tick();
  expect(wake).toBeTypeOf("function");

  session.send("second question");
  await tick();
  expect(inputTexts).toEqual(["keep working"]);
  expect(session.pendingTurns).toBe(2);

  wake?.(true);
  const events = await collecting;
  expect(inputTexts).toEqual(["keep working", "keep working", "second question"]);
  expect(eventTypes(events)).toEqual([
    "agent.message.received",
    "agent.message.received",
    "agent.rate_limit.wait.started",
    "agent.rate_limit.wait.ended",
    "agent.message.received",
    "agent.message.received",
    "agent.message.received",
    "agent.message.received",
  ]);
  expect(session.pendingTurns).toBe(0);
  expect(session.pumping).toBe(false);
});

test("repeated rejections stop after the resume budget", async () => {
  const inputs: SDKUserMessage[] = [];
  const { session } = createFixture((input) => {
    inputs.push(input);
    return [rejectionEvent(Date.now() + 1_000), ERROR_RESULT];
  }, instantSleep);
  const events = await collect(session.prompt("stubborn task"));
  const starts = events.filter((event) => event.type === "agent.rate_limit.wait.started");
  const ends = events.filter((event) => event.type === "agent.rate_limit.wait.ended");
  expect(starts).toHaveLength(MAX_RATE_LIMIT_RESUMES);
  expect(ends).toHaveLength(MAX_RATE_LIMIT_RESUMES);
  expect(eventTypes(events).at(-1)).toBe("agent.message.received");
  expect(session.pumping).toBe(false);
});
