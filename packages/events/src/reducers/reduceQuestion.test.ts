import { expect, test } from "vitest";
import type { AppEvent } from "../session/appEvent.ts";
import { buildDraftAnswer, isCustomRow, isLastQuestion } from "../models/questionDraft.ts";
import { reduceSessionState } from "./reduceSessionState.ts";
import { createSessionState } from "../session/sessionState.ts";
import { findQuestionCalls } from "./toolGroups.ts";

const play = (events: unknown[]) =>
  (events as AppEvent[]).reduce(reduceSessionState, createSessionState("s"));

const options = [
  { label: "A", description: "first" },
  { label: "B", description: "second" },
];
const questions = [
  { question: "One?", header: "One", options },
  { question: "Many?", header: "Many", multiSelect: true, options },
];
const required = {
  type: "agent.question.required",
  agentSessionId: "a",
  toolUseId: "q1",
  questions,
};

test("a question waits for an answer and opens a draft", () => {
  const state = play([required]);
  expect(state.status).toBe("answer_required");
  expect(findQuestionCalls(state)).toHaveLength(1);
  expect(state.ui.question).toMatchObject({ toolUseId: "q1", index: 0, cursor: 0 });
});

test("the draft moves, toggles, and records answers question by question", () => {
  const first = play([required, { type: "ui.question.moved", delta: 1 }]);
  expect(buildDraftAnswer(first.ui.question!)).toBe("B");
  const second = play([
    required,
    { type: "ui.question.moved", delta: 1 },
    { type: "ui.question.recorded", question: "One?", answer: "B" },
    { type: "ui.question.toggled" },
    { type: "ui.question.moved", delta: 1 },
    { type: "ui.question.toggled" },
  ]);
  const draft = second.ui.question!;
  expect(draft).toMatchObject({ index: 1, answers: { "One?": "B" }, picks: ["A", "B"] });
  expect(isLastQuestion(draft)).toBe(true);
  expect(buildDraftAnswer(draft)).toBe("A, B");
});

test("single select ignores toggles and the cursor wraps", () => {
  const state = play([
    required,
    { type: "ui.question.toggled" },
    { type: "ui.question.moved", delta: -1 },
  ]);
  expect(state.ui.question).toMatchObject({ picks: [], cursor: 2 });
});

test("answering resumes the tool and clears the draft", () => {
  const state = play([
    required,
    { type: "agent.question.resolved", toolUseId: "q1", answered: true },
  ]);
  expect(state.ui.question).toBeNull();
  expect(state.status).toBe("executing");
});

test("dismissing fails the tool call", () => {
  const state = play([
    required,
    { type: "agent.question.resolved", toolUseId: "q1", answered: false },
  ]);
  expect(state.ui.question).toBeNull();
  expect(state.transcript[0]).toMatchObject({ calls: [{ status: "failed" }] });
});

test("a result message records the session cost", () => {
  const state = play([
    {
      type: "agent.message.received",
      message: { type: "result", is_error: false, total_cost_usd: 0.42, modelUsage: {} },
    },
  ]);
  expect(state.costUsd).toBe(0.42);
});

test("the last row takes a custom typed answer", () => {
  const state = play([
    required,
    { type: "ui.question.moved", delta: -1 },
    { type: "ui.question.custom.changed", text: " my own " },
  ]);
  const draft = state.ui.question!;
  expect(isCustomRow(draft)).toBe(true);
  expect(buildDraftAnswer(draft)).toBe("my own");
  const multi = play([
    required,
    { type: "ui.question.recorded", question: "One?", answer: "A" },
    { type: "ui.question.toggled" },
    { type: "ui.question.moved", delta: -1 },
    { type: "ui.question.custom.changed", text: "extra" },
  ]);
  expect(buildDraftAnswer(multi.ui.question!)).toBe("A, extra");
});

test("a finished turn records its duration and tool count", () => {
  const state = play([
    { type: "agent.prompt.requested", agentSessionId: "a", content: "hi" },
    required,
    { type: "agent.question.resolved", toolUseId: "q1", answered: true },
    {
      type: "agent.message.received",
      message: { type: "result", is_error: false, duration_ms: 1500, modelUsage: {} },
    },
  ]);
  expect(state.lastRun).toEqual({ durationMs: 1500, toolCount: 1 });
});
