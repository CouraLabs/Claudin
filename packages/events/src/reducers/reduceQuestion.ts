import type { AskedQuestion, QuestionDraft } from "../models/askedQuestion.ts";
import { readCurrentQuestion } from "../models/questionDraft.ts";
import type { SessionState } from "../session/sessionState.ts";
import { pickToolStatus, updateToolCall, upsertToolCall } from "./toolGroups.ts";

const QUESTION_TOOL_NAME = "AskUserQuestion";

const withDraft = (state: SessionState, question: QuestionDraft | null): SessionState => ({
  ...state,
  ui: { ...state.ui, question },
});

export function reduceQuestionRequired(
  state: SessionState,
  event: { toolUseId: string; questions: AskedQuestion[] },
): SessionState {
  const withCall = upsertToolCall(state, {
    id: event.toolUseId,
    name: QUESTION_TOOL_NAME,
    input: { questions: event.questions },
  });
  const waiting = updateToolCall(withCall, event.toolUseId, (call) => ({
    ...call,
    status: "awaiting_answer",
  }));
  return withDraft(
    { ...waiting, status: "answer_required" },
    { ...event, index: 0, cursor: 0, picks: [], custom: "", answers: {} },
  );
}

export function reduceQuestionResolved(
  state: SessionState,
  event: { toolUseId: string; answered: boolean },
): SessionState {
  const settled = updateToolCall(state, event.toolUseId, (call) =>
    event.answered
      ? { ...call, status: "running" }
      : { ...call, status: "failed", error: "Dismissed by user" },
  );
  return withDraft({ ...settled, status: pickToolStatus(settled) }, null);
}

export function moveQuestionCursor(state: SessionState, delta: 1 | -1): SessionState {
  const { question } = state.ui;
  const current = question ? readCurrentQuestion(question) : undefined;
  const size = current ? current.options.length + 1 : 0;
  if (!question || size === 0) return state;
  return withDraft(state, { ...question, cursor: (question.cursor + delta + size) % size });
}

export function toggleQuestionPick(state: SessionState): SessionState {
  const { question } = state.ui;
  const current = question ? readCurrentQuestion(question) : undefined;
  const label = question ? current?.options[question.cursor]?.label : undefined;
  if (!question || !current?.multiSelect || !label) return state;
  const picks = question.picks.includes(label)
    ? question.picks.filter((pick) => pick !== label)
    : [...question.picks, label];
  return withDraft(state, { ...question, picks });
}

export function recordQuestionAnswer(
  state: SessionState,
  event: { question: string; answer: string },
): SessionState {
  const { question } = state.ui;
  if (!question) return state;
  return withDraft(state, {
    ...question,
    index: question.index + 1,
    cursor: 0,
    picks: [],
    custom: "",
    answers: { ...question.answers, [event.question]: event.answer },
  });
}

export function changeQuestionCustom(state: SessionState, text: string): SessionState {
  const { question } = state.ui;
  return question ? withDraft(state, { ...question, custom: text }) : state;
}
