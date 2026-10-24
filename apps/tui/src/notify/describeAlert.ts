import type { AppEvent } from "@kraude-kode/events";

type ResultLike = { type?: string; is_error?: boolean };

export function describeAlert(event: AppEvent): string | undefined {
  if (event.type === "agent.tool.approval.required") return `Approval needed: ${event.toolName}`;
  if (event.type === "agent.question.required") return "Claude has a question for you";
  if (event.type !== "agent.message.received") return undefined;
  const message = event.message as ResultLike | undefined;
  if (message?.type !== "result") return undefined;
  return message.is_error ? "Turn failed" : "Turn finished";
}
