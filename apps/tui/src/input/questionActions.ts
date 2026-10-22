import { buildDraftAnswer, isLastQuestion, readCurrentQuestion } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { requestAgent } from "./agentRequest.ts";

function sendAnswers(store: AppStore, answers: Record<string, string>): void {
  const { question } = store.state.ui;
  if (question)
    requestAgent(store, {
      type: "agent.question.answered",
      toolUseId: question.toolUseId,
      answers,
    });
}

export function confirmQuestion(store: AppStore): void {
  const { question } = store.state.ui;
  const current = question && readCurrentQuestion(question);
  if (!question || !current) return;
  const answer = buildDraftAnswer(question);
  if (!answer) return;
  if (isLastQuestion(question)) {
    sendAnswers(store, { ...question.answers, [current.question]: answer });
    return;
  }
  store.emit({ type: "ui.question.recorded", question: current.question, answer });
}

export const dismissQuestion = (store: AppStore): void => sendAnswers(store, {});
